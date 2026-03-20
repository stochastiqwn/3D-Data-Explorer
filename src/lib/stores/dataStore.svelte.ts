import type { WeatherGrid, SlicePlane } from '../types/weather';
import type { Vec3 } from '../utils/math';

// ATL airport: 33.6407°N, 84.4277°W, ~313m elevation
const ATL_DEFAULT: Vec3 = [-84.4277, 33.6407, 2500];

function createDataStore() {
  let grid = $state<WeatherGrid | null>(null);
  let slicePlane = $state<SlicePlane>({
    origin: ATL_DEFAULT,
    normal: [0, 0, 1],
  });
  let anchorLLA = $state<Vec3>([...ATL_DEFAULT]);

  return {
    get grid() { return grid; },
    set grid(g: WeatherGrid | null) { grid = g; },

    get slicePlane() { return slicePlane; },
    set slicePlane(p: SlicePlane) { slicePlane = p; },

    get anchorLLA() { return anchorLLA; },
    set anchorLLA(v: Vec3) { anchorLLA = v; },
  };
}

export const dataStore = createDataStore();
