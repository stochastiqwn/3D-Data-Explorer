<script lang="ts">
  import { panelStore } from '../../lib/stores/panelStore.svelte';
  import PanelWrapper from './PanelWrapper.svelte';
  import CesiumView from '../cesium/CesiumView.svelte';
  import SlicerView from '../slicer/SlicerView.svelte';

  const panelComponent: Record<string, typeof CesiumView | typeof SlicerView> = {
    cesium: CesiumView,
    slicer: SlicerView,
  };
</script>

<div class="panel-grid">
  {#each panelStore.panels as panel (panel.id)}
    <div
      class="grid-cell"
      style="
        grid-column: {panel.col + 1} / span {panel.colSpan};
        grid-row: {panel.row + 1} / span {panel.rowSpan};
      "
    >
      <PanelWrapper {panel}>
        {#if panel.type === 'cesium'}
          <CesiumView />
        {:else if panel.type === 'slicer'}
          <SlicerView />
        {/if}
      </PanelWrapper>
    </div>
  {/each}

  {#if panelStore.panels.length === 0}
    <div class="empty-state">
      <p>No panels open. Click <strong>+ Globe View</strong> or <strong>+ Data Slicer</strong> above to add a visualization.</p>
    </div>
  {/if}
</div>

<style>
  .panel-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: var(--panel-gap);
    padding: var(--panel-gap);
    flex: 1;
    overflow: hidden;
  }

  .grid-cell {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .empty-state {
    grid-column: 1 / span 2;
    grid-row: 1 / span 2;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: var(--text-secondary);
    font-size: 16px;
    padding: 40px;
  }
</style>
