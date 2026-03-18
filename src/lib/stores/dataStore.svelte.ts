import type { DataVariable, WeatherGrid, SlicePlane, SliceResult } from '../types/weather';
import { sliceGrid, integrateFromAnchor } from '../data/slicer';
import type { Vec3 } from '../utils/math';

// ATL airport: 33.6407°N, 84.4277°W, ~313m elevation
const ATL_DEFAULT: Vec3 = [-84.4277, 33.6407, 2500];

function createDataStore() {
  let grid = $state<WeatherGrid | null>(null);
  let slicePlane = $state<SlicePlane>({
    origin: ATL_DEFAULT,
    normal: [0, 0, 1],
  });
  /** The LLA anchor point the plane always passes through [lon, lat, alt] */
  let anchorLLA = $state<Vec3>([...ATL_DEFAULT]);
  let sliceResolution = $state(64);
  let sliceVersion = $state(0);

  function notifySliceChanged() {
    sliceVersion++;
  }

  function computeSlice(variable: DataVariable): SliceResult | null {
    return grid ? sliceGrid(grid, slicePlane, variable, sliceResolution) : null;
  }

  function computeIntegral(variable: DataVariable): SliceResult | null {
    return grid ? integrateFromAnchor(grid, slicePlane, variable, sliceResolution) : null;
  }

  return {
    get grid() { return grid; },
    set grid(g: WeatherGrid | null) { grid = g; },

    get slicePlane() { return slicePlane; },
    set slicePlane(p: SlicePlane) { slicePlane = p; },

    get anchorLLA() { return anchorLLA; },
    set anchorLLA(v: Vec3) { anchorLLA = v; },

    get sliceResolution() { return sliceResolution; },
    set sliceResolution(r: number) { sliceResolution = r; },

    get sliceVersion() { return sliceVersion; },

    notifySliceChanged,
    computeSlice,
    computeIntegral,
  };
}

export const dataStore = createDataStore();
