<script lang="ts">
  import Toolbar from './components/layout/Toolbar.svelte';
  import PanelGrid from './components/layout/PanelGrid.svelte';
  import VariableSelector from './components/shared/VariableSelector.svelte';
  import ColorLegend from './components/shared/ColorLegend.svelte';
  import { dataStore } from './lib/stores/dataStore.svelte';
  import { panelStore } from './lib/stores/panelStore.svelte';
  import './lib/data/jsonLoader'; // register the JSON loader
  import { getLoader } from './lib/data/loader';
  import { onMount } from 'svelte';

  let dataMin = $state(0);
  let dataMax = $state(1);
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

      // Compute domain for current variable
      const data = grid.variables.get(dataStore.activeVariable);
      if (data) {
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < data.length; i++) {
          if (!isNaN(data[i])) {
            if (data[i] < min) min = data[i];
            if (data[i] > max) max = data[i];
          }
        }
        dataMin = min;
        dataMax = max;
      }
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
    }

    loading = false;
  }

  // Recompute domain when variable changes
  $effect(() => {
    const grid = dataStore.grid;
    const variable = dataStore.activeVariable;
    if (!grid) return;
    const data = grid.variables.get(variable);
    if (!data) return;
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < data.length; i++) {
      if (!isNaN(data[i])) {
        if (data[i] < min) min = data[i];
        if (data[i] > max) max = data[i];
      }
    }
    dataMin = min;
    dataMax = max;
  });

  onMount(() => {
    // Auto-open both panels on start
    panelStore.addPanel('cesium');
    panelStore.addPanel('slicer');
    loadSampleData();
  });
</script>

<div class="app">
  <Toolbar />
  <div class="status-bar">
    <VariableSelector />
    <ColorLegend min={dataMin} max={dataMax} label={dataStore.activeVariable} />
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
