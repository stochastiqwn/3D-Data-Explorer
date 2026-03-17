<script lang="ts">
  import { onMount } from 'svelte';
  import { createCesiumViewer } from './cesiumConfig';
  import { WeatherLayer } from './WeatherLayer';
  import { dataStore } from '../../lib/stores/dataStore.svelte';
  import type { Viewer } from 'cesium';

  let container: HTMLElement;
  let viewer: Viewer | undefined;
  let weatherLayer: WeatherLayer | undefined;

  onMount(() => {
    viewer = createCesiumViewer({ container });
    weatherLayer = new WeatherLayer(viewer);

    // ResizeObserver to keep Cesium in sync with panel resizes
    const resizeObserver = new ResizeObserver(() => {
      if (viewer && !viewer.isDestroyed()) {
        viewer.resize();
        viewer.scene.requestRender();
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      weatherLayer?.destroy();
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy();
      }
    };
  });

  // Update weather layer when data changes
  $effect(() => {
    const grid = dataStore.grid;
    const variable = dataStore.activeVariable;
    if (weatherLayer && grid) {
      weatherLayer.update(grid, variable);
    }
  });
</script>

<div class="cesium-container" bind:this={container}></div>

<style>
  .cesium-container {
    width: 100%;
    height: 100%;
  }

  .cesium-container :global(.cesium-widget),
  .cesium-container :global(.cesium-widget canvas) {
    width: 100% !important;
    height: 100% !important;
  }
</style>
