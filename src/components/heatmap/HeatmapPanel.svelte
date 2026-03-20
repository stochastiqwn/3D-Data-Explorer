<script lang="ts">
  import { onMount } from 'svelte';
  import { dataStore } from '../../lib/stores/dataStore.svelte';
  import { sliceGrid } from '../../lib/data/slicer';
  import { valuesToImageData } from '../../lib/color/scales';
  import { ALL_VARIABLES, type DataVariable } from '../../lib/types/weather';
  import ColorLegend from '../shared/ColorLegend.svelte';
  import type { Vec3 } from '../../lib/utils/math';

  const labels: Record<DataVariable, string> = {
    humidity: 'Humidity',
    wind_speed: 'Wind Speed',
    wind_direction: 'Wind Direction',
    pressure: 'Pressure',
  };

  const CORNER_CSS = ['#ef4444', '#22c55e', '#3b82f6', '#eab308'];

  function dominantAxis(v: Vec3): string {
    const abs = [Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])];
    return ['Lon', 'Lat', 'Alt'][abs.indexOf(Math.max(...abs))];
  }

  let canvas: HTMLCanvasElement;
  let ctx = $state<CanvasRenderingContext2D | null>(null);
  let variable = $state<DataVariable>('humidity');
  let dataMin = $state(0);
  let dataMax = $state(1);
  let uLabel = $state('');
  let vLabel = $state('');

  onMount(() => { ctx = canvas.getContext('2d'); });

  function onVarChange(e: Event) {
    variable = (e.target as HTMLSelectElement).value as DataVariable;
  }

  $effect(() => {
    const grid = dataStore.grid;
    const plane = dataStore.slicePlane;
    const v = variable;
    if (!ctx || !grid) return;

    const result = sliceGrid(grid, plane, v, 64);
    if (!result) return;

    canvas.width = result.width;
    canvas.height = result.height;

    uLabel = dominantAxis(result.uAxis);
    vLabel = dominantAxis(result.vAxis);

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
    ctx.putImageData(valuesToImageData(result.values, result.width, result.height, [min, max], 'turbo'), 0, 0);
  });
</script>

<div class="heatmap-panel">
  <div class="heatmap-toolbar">
    <select class="var-select" value={variable} onchange={onVarChange}>
      {#each ALL_VARIABLES as v}
        <option value={v}>{labels[v]}</option>
      {/each}
    </select>
    <ColorLegend min={dataMin} max={dataMax} label={variable} />
  </div>
  <div class="heatmap-body">
    <canvas bind:this={canvas} class="heatmap-canvas"></canvas>
    <div class="corner tl" style="background:{CORNER_CSS[0]}"></div>
    <div class="corner tr" style="background:{CORNER_CSS[1]}"></div>
    <div class="corner br" style="background:{CORNER_CSS[2]}"></div>
    <div class="corner bl" style="background:{CORNER_CSS[3]}"></div>
    {#if uLabel}<span class="axis-lbl bottom">{uLabel}</span>{/if}
    {#if vLabel}<span class="axis-lbl left">{vLabel}</span>{/if}
  </div>
</div>

<style>
  .heatmap-panel { width: 100%; height: 100%; display: flex; flex-direction: column; }

  .heatmap-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: var(--bg-panel);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    overflow: hidden;
  }

  .var-select {
    padding: 3px 6px;
    border-radius: 4px;
    background: var(--bg-input);
    color: var(--text-primary);
    border: 1px solid var(--border);
    font-size: 12px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .heatmap-body {
    flex: 1;
    display: flex;
    align-items: stretch;
    justify-content: stretch;
    overflow: hidden;
    position: relative;
  }

  .heatmap-canvas {
    width: 100%;
    height: 100%;
    object-fit: fill;
    image-rendering: pixelated;
  }

  .corner {
    position: absolute;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    z-index: 2;
    pointer-events: none;
  }
  .corner.tl { top: 3px; left: 3px; }
  .corner.tr { top: 3px; right: 3px; }
  .corner.br { bottom: 3px; right: 3px; }
  .corner.bl { bottom: 3px; left: 3px; }

  .axis-lbl {
    position: absolute;
    font-size: 10px;
    font-weight: 600;
    color: var(--text-secondary);
    pointer-events: none;
    z-index: 2;
    background: var(--bg-panel);
    padding: 0 3px;
    border-radius: 2px;
    opacity: 0.85;
  }
  .axis-lbl.bottom { bottom: 4px; left: 50%; transform: translateX(-50%); }
  .axis-lbl.left { left: 4px; top: 50%; transform: translateY(-50%) rotate(-90deg); }
</style>
