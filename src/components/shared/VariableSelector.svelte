<script lang="ts">
  import { dataStore } from '../../lib/stores/dataStore';
  import { ALL_VARIABLES, type DataVariable } from '../../lib/types/weather';

  const labels: Record<DataVariable, string> = {
    humidity: 'Humidity',
    wind_speed: 'Wind Speed',
    wind_direction: 'Wind Direction',
    pressure: 'Pressure',
  };

  function onChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    dataStore.activeVariable = select.value as DataVariable;
  }
</script>

<select class="var-select" value={dataStore.activeVariable} onchange={onChange}>
  {#each ALL_VARIABLES as v}
    <option value={v}>{labels[v]}</option>
  {/each}
</select>

<style>
  .var-select {
    padding: 4px 8px;
    border-radius: 4px;
    background: var(--bg-panel);
    color: var(--text-primary);
    border: 1px solid var(--border);
    font-size: 13px;
    cursor: pointer;
  }

  .var-select:focus {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
</style>
