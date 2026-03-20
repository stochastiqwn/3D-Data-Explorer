<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
  import { dataStore } from '../../lib/stores/dataStore.svelte';
  import { buildTangentBasis, type Vec3 } from '../../lib/utils/math';

  let container: HTMLElement;
  let renderer: THREE.WebGLRenderer;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let controls: OrbitControls;
  let sliceMesh = $state<THREE.Mesh | null>(null);
  let anchorSphere = $state<THREE.Mesh | null>(null);
  let boundingBox: THREE.LineSegments;
  let axisLabels: THREE.Sprite[] = [];
  let normalArrow: THREE.ArrowHelper | null = null;
  let orientGroup: THREE.Group | null = null;
  let animFrameId: number;

  let elevation = $state(0);
  let azimuth = $state(0);
  let inputLat = $state('33.6407');
  let inputLon = $state('-84.4277');
  let inputAlt = $state('2500');

  // Corner colors: Red, Green, Blue, Yellow (matching Cesium & heatmaps)
  const CC = [0xef4444, 0x22c55e, 0x3b82f6, 0xeab308];
  const CP: [number, number, number][] = [[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]];

  /**
   * Normal from elevation/azimuth in real-world metric space.
   * X=lon, Y=lat, Z=alt.
   * Elevation 0° = horizontal, 90° = vertical.
   * Azimuth 0° = tilt toward +Y (lat), 90° = tilt toward +X (lon).
   */
  function normalFromAngles(elevDeg: number, azDeg: number): Vec3 {
    const el = (elevDeg * Math.PI) / 180;
    const az = (azDeg * Math.PI) / 180;
    return [Math.sin(el) * Math.sin(az), Math.sin(el) * Math.cos(az), Math.cos(el)];
  }

  function makeSprite(text: string, color = '#94a3b8', w = 0.18, h = 0.09): THREE.Sprite {
    const cv = document.createElement('canvas');
    const cx = cv.getContext('2d')!;
    cv.width = 128; cv.height = 64;
    cx.font = 'bold 28px monospace';
    cx.fillStyle = color;
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText(text, 64, 32);
    const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false });
    const s = new THREE.Sprite(mat);
    s.scale.set(w, h, 1);
    return s;
  }

  function createOrientSphere(): THREE.Group {
    const g = new THREE.Group();
    const r = 0.12;

    // Wireframe sphere
    g.add(new THREE.Mesh(
      new THREE.SphereGeometry(r, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0x666666, wireframe: true, transparent: true, opacity: 0.25 }),
    ));

    // Equator circle (XY = lat-lon plane)
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
    }
    g.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0xaaaaaa }),
    ));

    // Azimuth labels & ticks: 0°=+Y, 90°=+X, ±180°=-Y, -90°=-X
    for (const [deg, label] of [[0, '0°'], [90, '90°'], [180, '±180°'], [-90, '-90°']] as [number, string][]) {
      const rad = (deg * Math.PI) / 180;
      const x = Math.sin(rad), y = Math.cos(rad);
      const spr = makeSprite(label, '#aaaaaa', 0.10, 0.05);
      spr.position.set(x * (r + 0.06), y * (r + 0.06), 0);
      g.add(spr);
      g.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x * r * 0.9, y * r * 0.9, 0),
          new THREE.Vector3(x * r * 1.1, y * r * 1.1, 0),
        ]),
        new THREE.LineBasicMaterial({ color: 0xaaaaaa }),
      ));
    }

    // Normal arrow (updated in $effect)
    normalArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0),
      r * 1.3, 0xff6600, r * 0.3, r * 0.15,
    );
    g.add(normalArrow);
    return g;
  }

  function createScene(w: number, h: number) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111827);

    camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    camera.up.set(0, 0, 1); // Z (altitude) points up
    camera.position.set(1.5, -0.8, 0.8);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.target.set(0.5, 0.5, 0.06);

    // Bounding box
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    boundingBox = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x3b82f6 }));
    boundingBox.position.set(0.5, 0.5, 0.5);
    scene.add(boundingBox);

    // Axis labels
    const lonL = makeSprite('Lon', '#ef4444');
    const latL = makeSprite('Lat', '#22c55e');
    const altL = makeSprite('Alt', '#3b82f6');
    axisLabels = [lonL, latL, altL];
    axisLabels.forEach((l) => scene.add(l));

    // Slice plane mesh with colored corners & edges
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6, transparent: true, opacity: 0.25, side: THREE.DoubleSide,
    });
    sliceMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), planeMat);
    for (let i = 0; i < 4; i++) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 8),
        new THREE.MeshBasicMaterial({ color: CC[i] }),
      );
      dot.position.set(CP[i][0], CP[i][1], CP[i][2]);
      sliceMesh.add(dot);
      const j = (i + 1) % 4;
      sliceMesh.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(...CP[i]), new THREE.Vector3(...CP[j]),
        ]),
        new THREE.LineBasicMaterial({ color: CC[i], linewidth: 2 }),
      ));
    }
    scene.add(sliceMesh);

    // Anchor sphere
    anchorSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xef4444 }),
    );
    scene.add(anchorSphere);

    // Orientation sphere
    orientGroup = createOrientSphere();
    scene.add(orientGroup);

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
      renderer.domElement.parentElement?.removeChild(renderer.domElement);
    };
  });

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

    // Normal in real-world metric space
    const nMetric = normalFromAngles(el, az);

    dataStore.anchorLLA = [lon, lat, alt];

    // Metric scale for scene proportions
    const { bounds } = grid;
    const DEG_TO_M_LAT = 111320;
    const cosLat = Math.cos(((bounds.lat[0] + bounds.lat[1]) / 2 * Math.PI) / 180);
    const DEG_TO_M_LON = DEG_TO_M_LAT * cosLat;
    const lonM = (bounds.lon[1] - bounds.lon[0]) * DEG_TO_M_LON;
    const latM = (bounds.lat[1] - bounds.lat[0]) * DEG_TO_M_LAT;
    const altM = bounds.alt[1] - bounds.alt[0];
    const maxM = Math.max(lonM, latM, altM);
    const sx = lonM / maxM, sy = latM / maxM, sz = altM / maxM;

    // Transform metric normal → normalized [0,1]³ for slicer: n_norm = normalize(n_metric * [lonM, latM, altM])
    const nRaw: Vec3 = [nMetric[0] * lonM, nMetric[1] * latM, nMetric[2] * altM];
    const nLen = Math.sqrt(nRaw[0] ** 2 + nRaw[1] ** 2 + nRaw[2] ** 2) || 1;
    const normal: Vec3 = [nRaw[0] / nLen, nRaw[1] / nLen, nRaw[2] / nLen];

    // Scale bounding box
    boundingBox.scale.set(sx, sy, sz);
    boundingBox.position.set(sx / 2, sy / 2, sz / 2);

    // Axis labels at ends of each axis
    if (axisLabels.length === 3) {
      axisLabels[0].position.set(sx + 0.05, sy / 2, 0);
      axisLabels[1].position.set(sx / 2, sy + 0.05, 0);
      axisLabels[2].position.set(0, 0, sz + 0.05);
    }

    controls.target.set(sx / 2, sy / 2, sz / 2);

    // Orientation sphere
    if (orientGroup) {
      orientGroup.position.set(sx + 0.35, sy / 2, sz + 0.15);
      normalArrow?.setDirection(new THREE.Vector3(...nMetric).normalize());
    }

    // Anchor and plane positions in scaled scene
    const normPos = new THREE.Vector3(
      ((lon - bounds.lon[0]) / (bounds.lon[1] - bounds.lon[0])) * sx,
      ((lat - bounds.lat[0]) / (bounds.lat[1] - bounds.lat[0])) * sy,
      ((alt - bounds.alt[0]) / (bounds.alt[1] - bounds.alt[0])) * sz,
    );
    sphere.position.copy(normPos);
    mesh.position.copy(normPos);

    // Orient plane using the slicer's tangent basis (so corners match heatmap & Cesium)
    const [uN, vN] = buildTangentBasis(normal);
    const col0 = new THREE.Vector3(uN[0] * sx, uN[1] * sy, uN[2] * sz).normalize();
    let col1 = new THREE.Vector3(vN[0] * sx, vN[1] * sy, vN[2] * sz);
    col1.sub(col0.clone().multiplyScalar(col1.dot(col0))).normalize(); // Gram-Schmidt
    const col2 = new THREE.Vector3().crossVectors(col0, col1).normalize();
    const m = new THREE.Matrix4();
    m.makeBasis(col0, col1, col2);
    mesh.setRotationFromMatrix(m);

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
        <input type="range" min="0" max="90" step="1" bind:value={elevation} />
        <span class="value">{elevation}&deg;</span>
      </label>
      <label class="slider-label">
        Azimuth
        <input type="range" min="-180" max="180" step="1" bind:value={azimuth} />
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

  .scene { flex: 1; overflow: hidden; }

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

  .control-section { display: flex; flex-direction: column; gap: 4px; }

  .section-title {
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-size: 10px;
  }

  .lla-row { display: flex; gap: 6px; }

  .lla-field {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    color: var(--text-secondary);
    font-size: 10px;
  }

  .lla-field input { width: 100%; font-size: 11px; }

  .slider-label {
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .slider-label input[type='range'] { flex: 1; min-width: 0; }

  .value {
    min-width: 36px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
