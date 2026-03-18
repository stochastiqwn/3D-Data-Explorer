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
  let ctx: CanvasRenderingContext2D | null = null;
  let variable = $state<DataVariable>('humidity');
  let dataMin = $state(0);
  let dataMax = $state(1);

  onMount(() => {
    ctx = canvas.getContext('2d');
  });

  function onVarChange(e: Event) {
    variable = (e.target as HTMLSelectElement).value as DataVariable;
  }

  $effect(() => {
    const _version = dataStore.sliceVersion;
    const v = variable;
    if (!ctx) return;

    const result = dataStore.computeIntegral(v);
    if (!result) return;

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
  });
</script>

<div class="heatmap-panel">
  <div class="heatmap-toolbar">
    <select class="var-select" value={variable} onchange={onVarChange}>
      {#each ALL_VARIABLES as v}
        <option value={v}>{labels[v]}</option>
      {/each}
    </select>
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
