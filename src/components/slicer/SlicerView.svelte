<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
  import { dataStore } from '../../lib/stores/dataStore.svelte';
  import type { Vec3 } from '../../lib/utils/math';

  let container: HTMLElement;
  let renderer: THREE.WebGLRenderer;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let controls: OrbitControls;
  let sliceMesh: THREE.Mesh;
  let anchorSphere: THREE.Mesh;
  let boundingBox: THREE.LineSegments;
  let animFrameId: number;

  // Slice controls
  let pitch = $state(0);
  let yaw = $state(0);

  // LLA inputs (lon, lat, alt) — default = ATL airport center altitude
  let inputLat = $state('33.6407');
  let inputLon = $state('-84.4277');
  let inputAlt = $state('2500');

  function normalFromAngles(pitchDeg: number, yawDeg: number): Vec3 {
    const p = (pitchDeg * Math.PI) / 180;
    const y = (yawDeg * Math.PI) / 180;
    const nx = Math.sin(y) * Math.cos(p);
    const ny = -Math.sin(p);
    const nz = Math.cos(y) * Math.cos(p);
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    return [nx / len, ny / len, nz / len];
  }

  /** Convert a world-space LLA to normalized [0,1] position in the grid */
  function worldToNorm(lon: number, lat: number, alt: number) {
    const grid = untrack(() => dataStore.grid);
    if (!grid) return new THREE.Vector3(0.5, 0.5, 0.5);
    const { bounds } = grid;
    return new THREE.Vector3(
      (lon - bounds.lon[0]) / (bounds.lon[1] - bounds.lon[0]),
      (lat - bounds.lat[0]) / (bounds.lat[1] - bounds.lat[0]),
      (alt - bounds.alt[0]) / (bounds.alt[1] - bounds.alt[0]),
    );
  }

  function createScene(width: number, height: number) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111827);

    camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(1.6, 1.2, 1.6);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.target.set(0.5, 0.5, 0.5);

    // Bounding box — unit cube [0,1]^3
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const edges = new THREE.EdgesGeometry(boxGeo);
    boundingBox = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x3b82f6 }));
    boundingBox.position.set(0.5, 0.5, 0.5);
    scene.add(boundingBox);

    // Slice plane mesh
    const planeGeo = new THREE.PlaneGeometry(2, 2);
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    sliceMesh = new THREE.Mesh(planeGeo, planeMat);
    scene.add(sliceMesh);

    // Anchor point sphere
    const sphereGeo = new THREE.SphereGeometry(0.02, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    anchorSphere = new THREE.Mesh(sphereGeo, sphereMat);
    scene.add(anchorSphere);

    // Axes: R=X(lon) G=Y(lat) B=Z(alt)
    scene.add(new THREE.AxesHelper(0.3));
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  }

  function updateSlicePlane() {
    const grid = untrack(() => dataStore.grid);
    if (!grid) return;

    const lon = parseFloat(inputLon) || -84.4277;
    const lat = parseFloat(inputLat) || 33.6407;
    const alt = parseFloat(inputAlt) || 2500;
    const normal = normalFromAngles(pitch, yaw);

    // Update anchor in store
    dataStore.anchorLLA = [lon, lat, alt];

    // Position the visual elements in normalized [0,1] space
    const normPos = worldToNorm(lon, lat, alt);

    if (anchorSphere) anchorSphere.position.copy(normPos);

    if (sliceMesh) {
      sliceMesh.position.copy(normPos);
      const normalVec = new THREE.Vector3(...normal);
      sliceMesh.lookAt(normPos.clone().add(normalVec));
    }

    // Update the data store — plane in world coordinates
    dataStore.slicePlane = { origin: [lon, lat, alt], normal };
    dataStore.notifySliceChanged();
  }

  function onLLAChange() {
    updateSlicePlane();
  }

  function animate() {
    animFrameId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  onMount(() => {
    const rect = container.getBoundingClientRect();
    createScene(rect.width || 400, rect.height || 300);
    animate();

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(animFrameId);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  });

  // React to grid load
  $effect(() => {
    const grid = dataStore.grid;
    if (grid && boundingBox) {
      untrack(() => updateSlicePlane());
    }
  });
</script>

<div class="slicer-container">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="scene" bind:this={container}></div>

  <div class="slicer-controls">
    <div class="control-section">
      <span class="section-title">Anchor Point (LLA)</span>
      <div class="lla-row">
        <label class="lla-field">
          Lat
          <input type="number" step="0.001" bind:value={inputLat} onchange={onLLAChange} />
        </label>
        <label class="lla-field">
          Lon
          <input type="number" step="0.001" bind:value={inputLon} onchange={onLLAChange} />
        </label>
        <label class="lla-field">
          Alt (m)
          <input type="number" step="100" bind:value={inputAlt} onchange={onLLAChange} />
        </label>
      </div>
    </div>

    <div class="control-section">
      <span class="section-title">Plane Orientation</span>
      <label class="slider-label">
        Pitch
        <input type="range" min="-90" max="90" step="1"
          bind:value={pitch}
          oninput={() => updateSlicePlane()} />
        <span class="value">{pitch}&deg;</span>
      </label>
      <label class="slider-label">
        Yaw
        <input type="range" min="-90" max="90" step="1"
          bind:value={yaw}
          oninput={() => updateSlicePlane()} />
        <span class="value">{yaw}&deg;</span>
      </label>
    </div>
  </div>
</div>

<style>
  .slicer-container {
    width: 100%;
    height: 100%;
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .scene {
    flex: 1;
    overflow: hidden;
  }

  .slicer-controls {
    position: absolute;
    bottom: 8px;
    left: 8px;
    right: 8px;
    background: color-mix(in srgb, var(--bg-panel) 90%, transparent);
    backdrop-filter: blur(6px);
    padding: 8px 10px;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 10;
    font-size: 11px;
  }

  .control-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .section-title {
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-size: 10px;
  }

  .lla-row {
    display: flex;
    gap: 6px;
  }

  .lla-field {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    color: var(--text-secondary);
    font-size: 10px;
  }

  .lla-field input {
    width: 100%;
    font-size: 11px;
  }

  .slider-label {
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .slider-label input[type='range'] {
    flex: 1;
    min-width: 0;
  }

  .value {
    min-width: 36px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
