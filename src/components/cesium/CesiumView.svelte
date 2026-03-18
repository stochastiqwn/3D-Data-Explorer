<script lang="ts">
  import { onMount } from 'svelte';
  import { createCesiumViewer } from './cesiumConfig';
  import { WeatherLayer } from './WeatherLayer';
  import { dataStore } from '../../lib/stores/dataStore.svelte';
  import { ALL_VARIABLES, type DataVariable } from '../../lib/types/weather';
  import type { Viewer } from 'cesium';

  const labels: Record<DataVariable, string> = {
    humidity: 'Humidity',
    wind_speed: 'Wind Speed',
    wind_direction: 'Wind Direction',
    pressure: 'Pressure',
  };

  let container: HTMLElement;
  let viewer: Viewer | undefined;
  let weatherLayer: WeatherLayer | undefined;
  let variable = $state<DataVariable>('humidity');

  function onVarChange(e: Event) {
    variable = (e.target as HTMLSelectElement).value as DataVariable;
  }

  onMount(() => {
    viewer = createCesiumViewer({ container });
    weatherLayer = new WeatherLayer(viewer);

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

  // Update weather layer when data or variable changes
  $effect(() => {
    const grid = dataStore.grid;
    const v = variable;
    if (weatherLayer && grid) {
      weatherLayer.update(grid, v);
    }
  });
</script>

<div class="cesium-panel">
  <div class="cesium-toolbar">
    <select class="var-select" value={variable} onchange={onVarChange}>
      {#each ALL_VARIABLES as v}
        <option value={v}>{labels[v]}</option>
      {/each}
    </select>
  </div>
  <div class="cesium-container" bind:this={container}></div>
</div>

<style>
  .cesium-panel {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .cesium-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 10px;
    background: var(--bg-panel);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .var-select {
    padding: 3px 6px;
    border-radius: 4px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border);
    font-size: 12px;
    cursor: pointer;
  }

  .var-select:focus {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .cesium-container {
    flex: 1;
    overflow: hidden;
  }

  .cesium-container :global(.cesium-widget),
  .cesium-container :global(.cesium-widget canvas) {
    width: 100% !important;
    height: 100% !important;
  }
</style>
