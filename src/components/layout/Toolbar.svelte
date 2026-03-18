<script lang="ts">
  import { panelStore } from '../../lib/stores/panelStore.svelte';
  import { themeStore } from '../../lib/stores/themeStore.svelte';
  import type { PanelType } from '../../lib/types/panels';

  function addPanel(type: PanelType) {
    panelStore.addPanel(type);
  }
</script>

<header class="toolbar">
  <h1 class="title">3D Data Explorer</h1>
  <nav class="actions">
    <button class="btn" onclick={() => addPanel('cesium')}>+ Globe View</button>
    <button class="btn" onclick={() => addPanel('slicer')}>+ Data Slicer</button>
    <button class="btn" onclick={() => addPanel('heatmap')}>+ Heat Map</button>
    <button class="btn" onclick={() => addPanel('integral')}>+ Integral Map</button>
    <span class="sep"></span>
    <button class="btn" onclick={() => panelStore.tileAll()} title="Re-tile all panels">Tile</button>
    <button class="btn theme-toggle" onclick={() => themeStore.toggle()} title="Toggle theme">
      {themeStore.theme === 'dark' ? 'Light' : 'Dark'}
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
    gap: 6px;
    align-items: center;
  }

  .sep {
    width: 1px;
    height: 20px;
    background: var(--border);
    margin: 0 4px;
  }

  .btn {
    padding: 5px 12px;
    border-radius: 4px;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    font-size: 12px;
    transition: background 0.15s, color 0.15s;
    white-space: nowrap;
  }

  .btn:hover {
    background: var(--accent);
    color: #fff;
  }
</style>
