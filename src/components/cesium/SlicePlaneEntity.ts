import {
  Viewer,
  Entity,
  Cartesian3,
  Color,
  PolygonHierarchy,
} from 'cesium';
import type { WeatherGrid, SlicePlane } from '../../lib/types/weather';
import { buildTangentBasis, vec3Add, vec3Scale, vec3Normalize, type Vec3 } from '../../lib/utils/math';

const CORNER_COLORS = [Color.RED, Color.GREEN, Color.BLUE, Color.YELLOW];

export class SlicePlaneEntity {
  private viewer: Viewer;
  private entities: Entity[] = [];

  constructor(viewer: Viewer) {
    this.viewer = viewer;
  }

  update(grid: WeatherGrid, plane: SlicePlane) {
    // Remove old entities
    for (const e of this.entities) this.viewer.entities.remove(e);
    this.entities = [];

    const { bounds } = grid;
    const range: Vec3 = [
      bounds.lon[1] - bounds.lon[0],
      bounds.lat[1] - bounds.lat[0],
      bounds.alt[1] - bounds.alt[0],
    ];

    const normNormal = vec3Normalize(plane.normal);
    const [uAxisN, vAxisN] = buildTangentBasis(normNormal);

    const uAxis: Vec3 = [uAxisN[0] * range[0], uAxisN[1] * range[1], uAxisN[2] * range[2]];
    const vAxis: Vec3 = [vAxisN[0] * range[0], vAxisN[1] * range[1], vAxisN[2] * range[2]];

    // Metric lengths for consistent sizing
    const DEG_TO_M_LAT = 111320;
    const cosLat = Math.cos((plane.origin[1] * Math.PI) / 180);
    const DEG_TO_M_LON = DEG_TO_M_LAT * cosLat;

    const toMetricLen = (a: Vec3) => Math.sqrt(
      (a[0] * DEG_TO_M_LON) ** 2 + (a[1] * DEG_TO_M_LAT) ** 2 + a[2] ** 2,
    );

    const halfSizeM = 15000;
    const uLen = toMetricLen(uAxis);
    const vLen = toMetricLen(vAxis);
    const halfU = uLen > 0 ? halfSizeM / uLen : 0.6;
    const halfV = vLen > 0 ? halfSizeM / vLen : 0.6;

    const origin = plane.origin;
    // Corners: (-u,-v), (+u,-v), (+u,+v), (-u,+v) → Red, Green, Blue, Yellow
    const signs: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const corners = signs.map(([su, sv]) =>
      vec3Add(origin, vec3Add(vec3Scale(uAxis, su * halfU), vec3Scale(vAxis, sv * halfV))),
    );

    const positions = corners.map((c) =>
      Cartesian3.fromDegrees(c[0], c[1], Math.max(0, c[2])),
    );

    // Semi-transparent fill
    this.entities.push(this.viewer.entities.add({
      polygon: {
        hierarchy: new PolygonHierarchy(positions),
        material: Color.fromCssColorString('#3b82f6').withAlpha(0.25),
        perPositionHeight: true,
      },
    }));

    // Colored edges and corner points
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      this.entities.push(this.viewer.entities.add({
        polyline: {
          positions: [positions[i], positions[j]],
          material: CORNER_COLORS[i],
          width: 3,
        },
      }));
      this.entities.push(this.viewer.entities.add({
        position: positions[i],
        point: {
          pixelSize: 8,
          color: CORNER_COLORS[i],
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      }));
    }

    this.viewer.scene.requestRender();
  }

  destroy() {
    for (const e of this.entities) this.viewer.entities.remove(e);
    this.entities = [];
  }
}
