import {
  Viewer,
  PointPrimitiveCollection,
  Cartesian3,
  Color,
  NearFarScalar,
} from 'cesium';
import type { WeatherGrid, DataVariable } from '../../lib/types/weather';
import { createColorScale, colorStringToRGB } from '../../lib/color/scales';

const MAX_POINTS = 50000;

export class WeatherLayer {
  private viewer: Viewer;
  private points: PointPrimitiveCollection;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    this.points = new PointPrimitiveCollection();
    this.viewer.scene.primitives.add(this.points);
  }

  update(grid: WeatherGrid, variable: DataVariable) {
    this.points.removeAll();

    const data = grid.variables.get(variable);
    if (!data) return;

    const { dimensions, bounds } = grid;
    const totalPoints = dimensions.x * dimensions.y * dimensions.z;

    // Determine min/max for color scale
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      if (!isNaN(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    const scale = createColorScale('turbo', [min, max]);

    // Subsample if needed
    const step = Math.max(1, Math.ceil(Math.cbrt(totalPoints / MAX_POINTS)));

    for (let z = 0; z < dimensions.z; z += step) {
      for (let y = 0; y < dimensions.y; y += step) {
        for (let x = 0; x < dimensions.x; x += step) {
          const idx = z * dimensions.y * dimensions.x + y * dimensions.x + x;
          const val = data[idx];
          if (isNaN(val)) continue;

          const lon = bounds.lon[0] + (x / (dimensions.x - 1)) * (bounds.lon[1] - bounds.lon[0]);
          const lat = bounds.lat[0] + (y / (dimensions.y - 1)) * (bounds.lat[1] - bounds.lat[0]);
          const alt = bounds.alt[0] + (z / (dimensions.z - 1)) * (bounds.alt[1] - bounds.alt[0]);

          const [r, g, b] = colorStringToRGB(scale(val));

          this.points.add({
            position: Cartesian3.fromDegrees(lon, lat, alt),
            color: new Color(r / 255, g / 255, b / 255, 0.8),
            pixelSize: 4,
            scaleByDistance: new NearFarScalar(1e4, 1.5, 1e7, 0.3),
          });
        }
      }
    }

    this.viewer.scene.requestRender();
  }

  destroy() {
    this.viewer.scene.primitives.remove(this.points);
  }
}
