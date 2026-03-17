import type { DataVariable, WeatherGrid, SlicePlane, SliceResult } from '../types/weather';
import { sliceGrid } from '../data/slicer';

function createDataStore() {
  let grid = $state<WeatherGrid | null>(null);
  let activeVariable = $state<DataVariable>('humidity');
  let slicePlane = $state<SlicePlane>({
    origin: [0, 0, 0],
    normal: [0, 0, 1],
  });
  let sliceResolution = $state(64);
  let sliceResult = $state<SliceResult | null>(null);

  function computeSlice() {
    sliceResult = grid ? sliceGrid(grid, slicePlane, activeVariable, sliceResolution) : null;
  }

  return {
    get grid() { return grid; },
    set grid(g: WeatherGrid | null) { grid = g; },

    get activeVariable() { return activeVariable; },
    set activeVariable(v: DataVariable) { activeVariable = v; },

    get slicePlane() { return slicePlane; },
    set slicePlane(p: SlicePlane) { slicePlane = p; },

    get sliceResolution() { return sliceResolution; },
    set sliceResolution(r: number) { sliceResolution = r; },

    get sliceResult() { return sliceResult; },

    /** Call explicitly to recompute the slice — avoids reactive loops */
    computeSlice,
  };
}

export const dataStore = createDataStore();
