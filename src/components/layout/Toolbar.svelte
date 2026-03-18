<script lang="ts">
  import { panelStore } from '../../lib/stores/panelStore.svelte';
  import type { PanelType } from '../../lib/types/panels';

  function addPanel(type: PanelType) {
    panelStore.addPanel(type);
  }
</script>

<header class="toolbar">
  <h1 class="title">3D Data Explorer</h1>
  <nav class="actions">
    <button class="btn" onclick={() => addPanel('cesium')}>
      + Globe View
    </button>
    <button class="btn" onclick={() => addPanel('slicer')}>
      + Data Slicer
    </button>
    <button class="btn" onclick={() => addPanel('heatmap')}>
      + Heat Map
    </button>
  </nav>
</header>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--toolbar-height);
    padding: 0 16px;
    background: var(--bg-toolbar);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .title {
    font-size: 16px;
    font-weight: 600;
    color: var(--accent);
  }

  .actions {
    display: flex;
    gap: 8px;
  }

  .btn {
    padding: 6px 14px;
    border-radius: 4px;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    font-size: 13px;
    transition: background 0.15s;
  }

  .btn:hover {
    background: var(--accent);
    color: #fff;
  }
</style>
