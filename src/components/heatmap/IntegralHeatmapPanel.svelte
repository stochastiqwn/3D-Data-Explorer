<script lang="ts">
  import { onMount } from 'svelte';
  import { dataStore } from '../../lib/stores/dataStore.svelte';
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
  let computing = $state(false);
  let uLabel = $state('');
  let vLabel = $state('');

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
      // Only render the latest request — discard stale results
      if (result.id !== requestId) return;
      computing = false;
      if (!ctx) return;

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
    };

    return () => { worker?.terminate(); worker = null; };
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
    <ColorLegend min={dataMin} max={dataMax} label="integral({variable})" />
  </div>
  <div class="heatmap-body">
    <canvas bind:this={canvas} class="heatmap-canvas"></canvas>
    {#if computing}
      <span class="computing-badge">Computing...</span>
    {/if}
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

  .computing-badge {
    position: absolute;
    top: 4px;
    left: 4px;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 3px;
    background: var(--bg-panel);
    color: var(--text-primary);
    z-index: 5;
    pointer-events: none;
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
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
