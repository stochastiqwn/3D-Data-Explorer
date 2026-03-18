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
  let boundingBox: THREE.LineSegments;
  let animFrameId: number;

  // Plane controls: position along normal (0-1), pitch and yaw in degrees
  let planeOffset = $state(0.5);
  let pitch = $state(0);   // rotation around the local X axis (degrees)
  let yaw = $state(0);     // rotation around the local Y axis (degrees)

  function normalFromAngles(pitchDeg: number, yawDeg: number): Vec3 {
    const p = (pitchDeg * Math.PI) / 180;
    const y = (yawDeg * Math.PI) / 180;
    // Start with [0,0,1] (horizontal slice), rotate by pitch then yaw
    const nx = Math.sin(y) * Math.cos(p);
    const ny = -Math.sin(p);
    const nz = Math.cos(y) * Math.cos(p);
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    return [nx / len, ny / len, nz / len];
  }

  function createScene(width: number, height: number) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(1.8, 1.8, 1.8);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;

    // Bounding box wireframe — unit cube centered at origin
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const edges = new THREE.EdgesGeometry(boxGeo);
    boundingBox = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x00b4d8 }));
    scene.add(boundingBox);

    // Slice plane mesh — sized to cover the unit cube diagonal
    const planeGeo = new THREE.PlaneGeometry(1.8, 1.8);
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0x00b4d8,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    sliceMesh = new THREE.Mesh(planeGeo, planeMat);
    scene.add(sliceMesh);

    // Axes helper (R=X/lon, G=Y/lat, B=Z/alt)
    const axes = new THREE.AxesHelper(0.5);
    scene.add(axes);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  }

  function updateSlicePlane() {
    const grid = untrack(() => dataStore.grid);
    if (!grid) return;

    const { bounds } = grid;
    const normal = normalFromAngles(pitch, yaw);
    const normalVec = new THREE.Vector3(...normal);

    // Position in normalized scene space
    const scenePos = normalVec.clone().multiplyScalar(planeOffset - 0.5);

    if (sliceMesh) {
      sliceMesh.position.copy(scenePos);
      sliceMesh.lookAt(scenePos.clone().add(normalVec));
    }

    // Convert normalized offset to world coordinates
    const center: Vec3 = [
      (bounds.lon[0] + bounds.lon[1]) / 2,
      (bounds.lat[0] + bounds.lat[1]) / 2,
      (bounds.alt[0] + bounds.alt[1]) / 2,
    ];
    const halfSize: Vec3 = [
      (bounds.lon[1] - bounds.lon[0]) / 2,
      (bounds.lat[1] - bounds.lat[0]) / 2,
      (bounds.alt[1] - bounds.alt[0]) / 2,
    ];

    // Offset the origin along the normal in world space
    const t = planeOffset - 0.5; // -0.5 to 0.5
    const origin: Vec3 = [
      center[0] + normal[0] * halfSize[0] * 2 * t,
      center[1] + normal[1] * halfSize[1] * 2 * t,
      center[2] + normal[2] * halfSize[2] * 2 * t,
    ];

    dataStore.slicePlane = { origin, normal };
    dataStore.notifySliceChanged();
  }

  function animate() {
    animFrameId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  function onWheel(e: WheelEvent) {
    if (e.shiftKey) {
      e.preventDefault();
      planeOffset = Math.max(0, Math.min(1, planeOffset + e.deltaY * 0.001));
      updateSlicePlane();
    }
  }

  onMount(() => {
    const rect = container.getBoundingClientRect();
    createScene(rect.width, rect.height);
    animate();

    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animFrameId);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  });

  // React to grid changes
  $effect(() => {
    const grid = dataStore.grid;
    if (grid && boundingBox) {
      untrack(() => updateSlicePlane());
    }
  });
</script>

<div class="slicer-container">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="scene" bind:this={container} onwheel={onWheel}></div>
  <div class="slicer-controls">
    <label class="slider-label">
      Position
      <input type="range" min="0" max="1" step="0.01"
        bind:value={planeOffset}
        oninput={() => updateSlicePlane()} />
    </label>
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
    <span class="hint">Shift+Scroll to move slice plane</span>
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
    background: rgba(15, 52, 96, 0.85);
    padding: 8px 12px;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    z-index: 10;
  }

  .slider-label {
    font-size: 11px;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .slider-label input {
    width: 120px;
  }

  .value {
    min-width: 36px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .hint {
    font-size: 10px;
    color: var(--text-secondary);
    opacity: 0.7;
  }
</style>
