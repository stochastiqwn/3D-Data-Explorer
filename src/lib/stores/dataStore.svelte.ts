import type { DataVariable, WeatherGrid, SlicePlane, SliceResult } from '../types/weather';
import { sliceGrid } from '../data/slicer';

function createDataStore() {
  let grid = $state<WeatherGrid | null>(null);
  let slicePlane = $state<SlicePlane>({
    origin: [0, 0, 0],
    normal: [0, 0, 1],
  });
  let sliceResolution = $state(64);
  /** Incremented each time the slice plane changes, so consumers can react */
  let sliceVersion = $state(0);

  function notifySliceChanged() {
    sliceVersion++;
  }

  function computeSlice(variable: DataVariable): SliceResult | null {
    return grid ? sliceGrid(grid, slicePlane, variable, sliceResolution) : null;
  }

  return {
    get grid() { return grid; },
    set grid(g: WeatherGrid | null) { grid = g; },

    get slicePlane() { return slicePlane; },
    set slicePlane(p: SlicePlane) { slicePlane = p; },

    get sliceResolution() { return sliceResolution; },
    set sliceResolution(r: number) { sliceResolution = r; },

    get sliceVersion() { return sliceVersion; },

    notifySliceChanged,
    computeSlice,
  };
}

export const dataStore = createDataStore();
