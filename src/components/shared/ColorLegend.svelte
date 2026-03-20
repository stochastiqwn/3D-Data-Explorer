<script lang="ts">
  import { onMount } from 'svelte';
  import { createColorScale, colorStringToRGB, type ColorScaleName } from '../../lib/color/scales';

  let {
    min = 0,
    max = 1,
    label = '',
    scaleName = 'turbo' as ColorScaleName,
  } = $props();

  let canvas: HTMLCanvasElement;

  function draw() {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvas;
    const scale = createColorScale(scaleName, [0, width]);
    for (let x = 0; x < width; x++) {
      const [r, g, b] = colorStringToRGB(scale(x));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, 0, 1, height);
    }
  }

  onMount(() => draw());

  $effect(() => {
    scaleName;
    if (canvas) draw();
  });
</script>

<div class="legend">
  {#if label}
    <span class="legend-label">{label}</span>
  {/if}
  <div class="legend-bar">
    <canvas bind:this={canvas} width="200" height="12"></canvas>
    <div class="legend-ticks">
      <span>{min.toFixed(1)}</span>
      <span>{max.toFixed(1)}</span>
    </div>
  </div>
</div>

<style>
  .legend {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-secondary);
    min-width: 0;
    flex: 1;
    overflow: hidden;
  }

  .legend-label {
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }

  .legend-bar {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 60px;
  }

  .legend-bar canvas {
    border-radius: 2px;
    width: 100%;
    height: 12px;
  }

  .legend-ticks {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
  }
</style>
