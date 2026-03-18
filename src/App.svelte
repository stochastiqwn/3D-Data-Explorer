<script lang="ts">
  import Toolbar from './components/layout/Toolbar.svelte';
  import PanelGrid from './components/layout/PanelGrid.svelte';
  import { dataStore } from './lib/stores/dataStore.svelte';
  import { panelStore } from './lib/stores/panelStore.svelte';
  import './lib/data/jsonLoader';
  import { getLoader } from './lib/data/loader';
  import { onMount } from 'svelte';

  let loading = $state(false);

  async function loadSampleData() {
    loading = true;
    const loader = getLoader('sample.json');
    if (!loader) {
      console.warn('No loader found for sample.json');
      loading = false;
      return;
    }

    for await (const grid of loader.load('/sample-data/weather-sample.json')) {
      dataStore.grid = grid;
      break;
    }

    // Initialize slice plane at ATL airport
    if (dataStore.grid) {
      const anchor = dataStore.anchorLLA;
      dataStore.slicePlane = {
        origin: [...anchor],
        normal: [0, 0, 1],
      };
      dataStore.notifySliceChanged();
    }

    loading = false;
  }

  onMount(() => {
    // Open default panels: globe, slicer, heatmap, integral
    panelStore.addPanel('cesium');
    panelStore.addPanel('slicer');
    panelStore.addPanel('heatmap');
    panelStore.addPanel('integral');
    loadSampleData();
  });
</script>

<div class="app">
  <Toolbar />
  {#if loading}
    <div class="status-bar">
      <span class="loading">Loading data...</span>
    </div>
  {/if}
  <PanelGrid />
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .status-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 4px 16px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .loading {
    font-size: 12px;
    color: var(--accent);
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>
