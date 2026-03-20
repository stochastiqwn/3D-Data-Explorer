<script lang="ts">
  import { onMount } from 'svelte';
  import { dataStore } from '../../lib/stores/dataStore.svelte';
  import { valuesToImageData } from '../../lib/color/scales';
  import { ALL_VARIABLES, type DataVariable } from '../../lib/types/weather';
  import ColorLegend from '../shared/ColorLegend.svelte';

  const labels: Record<DataVariable, string> = {
    humidity: 'Humidity',
    wind_speed: 'Wind Speed',
    wind_direction: 'Wind Direction',
    pressure: 'Pressure',
  };

  let canvas: HTMLCanvasElement;
  let ctx = $state<CanvasRenderingContext2D | null>(null);
  let variable = $state<DataVariable>('humidity');
  let dataMin = $state(0);
  let dataMax = $state(1);
  let computing = $state(false);

  let worker: Worker | null = null;
  let requestId = 0;

  onMount(() => {
    ctx = canvas.getContext('2d');
    worker = new Worker(
      new URL('../../lib/workers/slicerWorker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (e) => {
      const result = e.data;
      computing = false;
      if (!ctx) return;

      canvas.width = result.width;
      canvas.height = result.height;

      let min = Infinity, max = -Infinity;
      for (let i = 0; i < result.values.length; i++) {
        const val = result.values[i];
        if (!isNaN(val)) {
          if (val < min) min = val;
          if (val > max) max = val;
        }
      }
      if (!isFinite(min)) return;

      dataMin = min;
      dataMax = max;

      const imageData = valuesToImageData(result.values, result.width, result.height, [min, max], 'turbo');
      ctx.putImageData(imageData, 0, 0);
    };

    return () => {
      worker?.terminate();
      worker = null;
    };
  });

  function onVarChange(e: Event) {
    variable = (e.target as HTMLSelectElement).value as DataVariable;
  }

  $effect(() => {
    const grid = dataStore.grid;
    const plane = dataStore.slicePlane;
    const v = variable;
    if (!worker || !grid) return;

    const varData = grid.variables.get(v);
    if (!varData) return;

    requestId++;
    computing = true;

    // Copy data into plain objects/arrays so postMessage can clone them
    const dataCopy = new Float32Array(varData);
    worker.postMessage({
      id: requestId,
      type: 'integral',
      dimensions: { x: grid.dimensions.x, y: grid.dimensions.y, z: grid.dimensions.z },
      bounds: {
        lat: [grid.bounds.lat[0], grid.bounds.lat[1]],
        lon: [grid.bounds.lon[0], grid.bounds.lon[1]],
        alt: [grid.bounds.alt[0], grid.bounds.alt[1]],
      },
      variableData: dataCopy,
      origin: [plane.origin[0], plane.origin[1], plane.origin[2]],
      normal: [plane.normal[0], plane.normal[1], plane.normal[2]],
      variable: v,
      resolution: 64,
      numSteps: 48,
    }, [dataCopy.buffer]);
  });
</script>

<div class="heatmap-panel">
  <div class="heatmap-toolbar">
    <select class="var-select" value={variable} onchange={onVarChange}>
      {#each ALL_VARIABLES as v}
        <option value={v}>{labels[v]}</option>
      {/each}
    </select>
    {#if computing}
      <span class="computing">Computing...</span>
    {/if}
    <ColorLegend min={dataMin} max={dataMax} label="integral({variable})" />
  </div>
  <div class="heatmap-body">
    <canvas bind:this={canvas} class="heatmap-canvas"></canvas>
  </div>
</div>

<style>
  .heatmap-panel {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .heatmap-toolbar {
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
    background: var(--bg-input);
    color: var(--text-primary);
    border: 1px solid var(--border);
    font-size: 12px;
    cursor: pointer;
  }

  .computing {
    font-size: 11px;
    color: var(--accent);
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .heatmap-body {
    flex: 1;
    display: flex;
    align-items: stretch;
    justify-content: stretch;
    overflow: hidden;
  }

  .heatmap-canvas {
    width: 100%;
    height: 100%;
    object-fit: fill;
    image-rendering: pixelated;
  }
</style>
