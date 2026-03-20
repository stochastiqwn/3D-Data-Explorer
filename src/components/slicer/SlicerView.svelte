<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
  import { dataStore } from '../../lib/stores/dataStore.svelte';
  import type { Vec3 } from '../../lib/utils/math';

  let container: HTMLElement;
  let renderer: THREE.WebGLRenderer;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let controls: OrbitControls;
  let sliceMesh = $state<THREE.Mesh | null>(null);
  let anchorSphere = $state<THREE.Mesh | null>(null);
  let boundingBox: THREE.LineSegments;
  let axisLabels: THREE.Sprite[] = [];
  let animFrameId: number;

  // Slice controls
  let elevation = $state(0);
  let azimuth = $state(0);

  // LLA inputs (lon, lat, alt) — default = ATL airport center altitude
  let inputLat = $state('33.6407');
  let inputLon = $state('-84.4277');
  let inputAlt = $state('2500');

  /**
   * Compute plane normal from elevation and azimuth angles.
   * Coordinate system: X=lon, Y=lat, Z=alt.
   *
   * Elevation (0–90°): tilt from horizontal. 0° = flat, 90° = vertical.
   * Azimuth (-180–180°): rotation around Z (alt) axis. 0° = tilt toward +Y (lat).
   */
  function normalFromAngles(elevDeg: number, azDeg: number): Vec3 {
    const el = (elevDeg * Math.PI) / 180;
    const az = (azDeg * Math.PI) / 180;
    const nx = Math.sin(el) * Math.sin(az);
    const ny = Math.sin(el) * Math.cos(az);
    const nz = Math.cos(el);
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    return [nx / len, ny / len, nz / len];
  }

  function createTextSprite(text: string, color: string = '#94a3b8'): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = 128;
    canvas.height = 64;
    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 32);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.18, 0.09, 1);
    return sprite;
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

    // Bounding box (scaled to real-world proportions when grid loads)
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const edges = new THREE.EdgesGeometry(boxGeo);
    boundingBox = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x3b82f6 }));
    boundingBox.position.set(0.5, 0.5, 0.5);
    scene.add(boundingBox);

    // Axis labels (positioned when grid loads)
    const lonLabel = createTextSprite('Lon', '#ef4444');
    const latLabel = createTextSprite('Lat', '#22c55e');
    const altLabel = createTextSprite('Alt', '#3b82f6');
    axisLabels = [lonLabel, latLabel, altLabel];
    axisLabels.forEach((l) => scene.add(l));

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

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
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

  // React to any slicer input change (elevation, azimuth, LLA, or grid load)
  $effect(() => {
    const grid = dataStore.grid;
    const el = elevation;
    const az = azimuth;
    const lonStr = inputLon;
    const latStr = inputLat;
    const altStr = inputAlt;
    const mesh = sliceMesh;
    const sphere = anchorSphere;
    if (!grid || !mesh || !sphere) return;

    const lon = parseFloat(lonStr) || -84.4277;
    const lat = parseFloat(latStr) || 33.6407;
    const alt = parseFloat(altStr) || 2500;
    const normal = normalFromAngles(el, az);

    // Update anchor in store
    dataStore.anchorLLA = [lon, lat, alt];

    // Compute metric scale so the box matches real-world proportions
    const { bounds } = grid;
    const DEG_TO_M_LAT = 111320;
    const midLat = (bounds.lat[0] + bounds.lat[1]) / 2;
    const cosLat = Math.cos((midLat * Math.PI) / 180);
    const DEG_TO_M_LON = DEG_TO_M_LAT * cosLat;
    const lonM = (bounds.lon[1] - bounds.lon[0]) * DEG_TO_M_LON;
    const latM = (bounds.lat[1] - bounds.lat[0]) * DEG_TO_M_LAT;
    const altM = bounds.alt[1] - bounds.alt[0];
    const maxM = Math.max(lonM, latM, altM);
    const sx = lonM / maxM;
    const sy = latM / maxM;
    const sz = altM / maxM;

    // Scale bounding box to real-world proportions
    boundingBox.scale.set(sx, sy, sz);
    boundingBox.position.set(sx / 2, sy / 2, sz / 2);

    // Position axis labels at the midpoint of each axis edge, offset outward
    if (axisLabels.length === 3) {
      axisLabels[0].position.set(sx / 2, -0.07, -0.07); // Lon (X)
      axisLabels[1].position.set(-0.07, sy / 2, -0.07); // Lat (Y)
      axisLabels[2].position.set(-0.07, -0.07, sz / 2); // Alt (Z)
    }

    // Center orbit controls on the scaled box
    controls.target.set(sx / 2, sy / 2, sz / 2);

    // Position visual elements in metric-scaled space
    const normPos = new THREE.Vector3(
      ((lon - bounds.lon[0]) / (bounds.lon[1] - bounds.lon[0])) * sx,
      ((lat - bounds.lat[0]) / (bounds.lat[1] - bounds.lat[0])) * sy,
      ((alt - bounds.alt[0]) / (bounds.alt[1] - bounds.alt[0])) * sz,
    );

    sphere.position.copy(normPos);
    mesh.position.copy(normPos);

    // Transform plane normal from isotropic [0,1]³ to the scaled scene
    // (inverse-transpose of the scaling: divide by scale factors)
    const normalVec = new THREE.Vector3(
      normal[0] / sx,
      normal[1] / sy,
      normal[2] / sz,
    ).normalize();
    mesh.lookAt(normPos.clone().add(normalVec));

    // Update the data store — plane in world coordinates
    dataStore.slicePlane = { origin: [lon, lat, alt], normal };
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
          <input type="number" step="0.001" bind:value={inputLat} />
        </label>
        <label class="lla-field">
          Lon
          <input type="number" step="0.001" bind:value={inputLon} />
        </label>
        <label class="lla-field">
          Alt (m)
          <input type="number" step="100" bind:value={inputAlt} />
        </label>
      </div>
    </div>

    <div class="control-section">
      <span class="section-title">Plane Orientation</span>
      <label class="slider-label">
        Elevation
        <input type="range" min="0" max="90" step="1"
          bind:value={elevation} />
        <span class="value">{elevation}&deg;</span>
      </label>
      <label class="slider-label">
        Azimuth
        <input type="range" min="-180" max="180" step="1"
          bind:value={azimuth} />
        <span class="value">{azimuth}&deg;</span>
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
    background: var(--bg-panel);
    opacity: 0.95;
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
