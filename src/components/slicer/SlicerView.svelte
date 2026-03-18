<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
  import { dataStore } from '../../lib/stores/dataStore.svelte';
  import HeatmapOverlay from './HeatmapOverlay.svelte';
  import type { Vec3 } from '../../lib/utils/math';

  let container: HTMLElement;
  let renderer: THREE.WebGLRenderer;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let controls: OrbitControls;
  let sliceMesh: THREE.Mesh;
  let boundingBox: THREE.LineSegments;
  let animFrameId: number;

  // Plane interaction state
  let planeOffset = $state(0.5); // 0-1 normalized position along normal

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

    // Bounding box wireframe — always a unit cube centered at origin
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const edges = new THREE.EdgesGeometry(boxGeo);
    boundingBox = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x00b4d8 }));
    scene.add(boundingBox);

    // Slice plane mesh — sized to cover the unit cube
    const planeGeo = new THREE.PlaneGeometry(1.5, 1.5);
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0x00b4d8,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    sliceMesh = new THREE.Mesh(planeGeo, planeMat);
    scene.add(sliceMesh);

    // Axes helper
    const axes = new THREE.AxesHelper(0.5);
    scene.add(axes);

    // Ambient light
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  }

  function updateSlicePlane() {
    const grid = untrack(() => dataStore.grid);
    if (!grid) return;

    const { bounds } = grid;
    const normal = untrack(() => dataStore.slicePlane.normal);
    const normalVec = new THREE.Vector3(...normal).normalize();

    // In the 3D scene, the bounding box is a unit cube from -0.5 to 0.5.
    // planeOffset 0→1 maps to -0.5→0.5 along the normal axis.
    const scenePos = normalVec.clone().multiplyScalar(planeOffset - 0.5);

    if (sliceMesh) {
      sliceMesh.position.copy(scenePos);
      sliceMesh.lookAt(scenePos.clone().add(normalVec));
    }

    // Convert normalized offset to world coordinates for the data slicer
    const worldOrigin: Vec3 = [
      bounds.lon[0] + planeOffset * (bounds.lon[1] - bounds.lon[0]),
      bounds.lat[0] + planeOffset * (bounds.lat[1] - bounds.lat[0]),
      bounds.alt[0] + planeOffset * (bounds.alt[1] - bounds.alt[0]),
    ];

    // For a single-axis normal, only the relevant axis changes with offset.
    // The others stay at center.
    const center: Vec3 = [
      (bounds.lon[0] + bounds.lon[1]) / 2,
      (bounds.lat[0] + bounds.lat[1]) / 2,
      (bounds.alt[0] + bounds.alt[1]) / 2,
    ];

    const origin: Vec3 = [
      normal[0] !== 0 ? bounds.lon[0] + planeOffset * (bounds.lon[1] - bounds.lon[0]) : center[0],
      normal[1] !== 0 ? bounds.lat[0] + planeOffset * (bounds.lat[1] - bounds.lat[0]) : center[1],
      normal[2] !== 0 ? bounds.alt[0] + planeOffset * (bounds.alt[1] - bounds.alt[0]) : center[2],
    ];

    dataStore.slicePlane = { origin, normal: [...normal] as Vec3 };
    dataStore.computeSlice();
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

  // React to grid changes — trigger slice update
  $effect(() => {
    const grid = dataStore.grid;
    if (grid && boundingBox) {
      untrack(() => {
        updateSlicePlane();
      });
    }
  });
</script>

<div class="slicer-container">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="scene" bind:this={container} onwheel={onWheel}></div>
  <div class="slicer-controls">
    <label class="slider-label">
      Slice Position
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        bind:value={planeOffset}
        oninput={() => updateSlicePlane()}
      />
    </label>
    <span class="hint">Shift+Scroll to move slice plane</span>
  </div>
  <div class="heatmap-inset">
    <HeatmapOverlay />
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
    gap: 4px;
    z-index: 10;
  }

  .slider-label {
    font-size: 11px;
    color: var(--text-secondary);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .slider-label input {
    width: 140px;
  }

  .hint {
    font-size: 10px;
    color: var(--text-secondary);
    opacity: 0.7;
  }

  .heatmap-inset {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 200px;
    height: 200px;
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: hidden;
    z-index: 10;
    background: var(--bg-secondary);
  }
</style>
