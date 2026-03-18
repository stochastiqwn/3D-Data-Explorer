<script lang="ts">
  import Toolbar from './components/layout/Toolbar.svelte';
  import PanelGrid from './components/layout/PanelGrid.svelte';
  import { dataStore } from './lib/stores/dataStore.svelte';
  import { panelStore } from './lib/stores/panelStore.svelte';
  import './lib/data/jsonLoader'; // register the JSON loader
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
      break; // single timestep for now
    }

    // Initialize slice plane at center of grid
    if (dataStore.grid) {
      const { bounds } = dataStore.grid;
      dataStore.slicePlane = {
        origin: [
          (bounds.lon[0] + bounds.lon[1]) / 2,
          (bounds.lat[0] + bounds.lat[1]) / 2,
          (bounds.alt[0] + bounds.alt[1]) / 2,
        ],
        normal: [0, 0, 1],
      };
      dataStore.notifySliceChanged();
    }

    loading = false;
  }

  onMount(() => {
    panelStore.addPanel('slicer');
    panelStore.addPanel('heatmap');
    loadSampleData();
  });
</script>

<div class="app">
  <Toolbar />
  <div class="status-bar">
    {#if loading}
      <span class="loading">Loading data...</span>
    {/if}
    <button class="load-btn" onclick={loadSampleData} disabled={loading}>
      Load Sample Data
    </button>
  </div>
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
    padding: 6px 16px;
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

  .load-btn {
    margin-left: auto;
    padding: 4px 12px;
    border-radius: 4px;
    background: var(--accent);
    color: #fff;
    font-size: 12px;
    transition: background 0.15s;
  }

  .load-btn:hover:not(:disabled) {
    background: var(--accent-hover);
  }

  .load-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
