<script lang="ts">
  import { onMount } from 'svelte';
  import { dataStore } from '../../lib/stores/dataStore.svelte';
  import { valuesToImageData } from '../../lib/color/scales';

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;

  onMount(() => {
    ctx = canvas.getContext('2d');
  });

  $effect(() => {
    const result = dataStore.sliceResult;
    if (!ctx || !result) return;

    canvas.width = result.width;
    canvas.height = result.height;

    // Compute domain from values
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < result.values.length; i++) {
      const v = result.values[i];
      if (!isNaN(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (!isFinite(min)) return;

    const imageData = valuesToImageData(result.values, result.width, result.height, [min, max], 'turbo');
    ctx.putImageData(imageData, 0, 0);
  });
</script>

<canvas bind:this={canvas} class="heatmap-canvas"></canvas>

<style>
  .heatmap-canvas {
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }
</style>
