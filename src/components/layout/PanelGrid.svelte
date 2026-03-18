<script lang="ts">
  import { onMount } from 'svelte';
  import { panelStore } from '../../lib/stores/panelStore.svelte';
  import PanelWrapper from './PanelWrapper.svelte';
  import CesiumView from '../cesium/CesiumView.svelte';
  import SlicerView from '../slicer/SlicerView.svelte';
  import HeatmapPanel from '../heatmap/HeatmapPanel.svelte';
  import IntegralHeatmapPanel from '../heatmap/IntegralHeatmapPanel.svelte';

  let container: HTMLElement;

  onMount(() => {
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        panelStore.setContainerSize(width, height);
        panelStore.tileAll();
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  });
</script>

<div class="panel-container" bind:this={container}>
  {#each panelStore.panels as panel (panel.id)}
    <div
      class="floating-panel"
      style="
        left: {panel.x}px;
        top: {panel.y}px;
        width: {panel.w}px;
        height: {panel.minimized ? 32 : panel.h}px;
        z-index: {panel.zIndex};
      "
    >
      <PanelWrapper {panel}>
        {#if panel.type === 'cesium'}
          <CesiumView />
        {:else if panel.type === 'slicer'}
          <SlicerView />
        {:else if panel.type === 'heatmap'}
          <HeatmapPanel />
        {:else if panel.type === 'integral'}
          <IntegralHeatmapPanel />
        {/if}
      </PanelWrapper>
    </div>
  {/each}

  {#if panelStore.panels.length === 0}
    <div class="empty-state">
      <p>No panels open. Use the toolbar buttons to add panels.</p>
    </div>
  {/if}
</div>

<style>
  .panel-container {
    position: relative;
    flex: 1;
    overflow: hidden;
    background: var(--bg-primary);
  }

  .floating-panel {
    position: absolute;
  }

  .empty-state {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: var(--text-secondary);
    font-size: 16px;
    padding: 40px;
  }
</style>
