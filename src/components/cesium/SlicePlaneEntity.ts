import {
  Viewer,
  Entity,
  Cartesian3,
  Color,
  PolygonHierarchy,
  HeightReference,
  ClassificationType,
} from 'cesium';
import type { WeatherGrid, SlicePlane } from '../../lib/types/weather';
import { buildTangentBasis, vec3Add, vec3Scale, vec3Normalize, type Vec3 } from '../../lib/utils/math';

/**
 * Draws the slicer plane on the Cesium globe as a semi-transparent polygon.
 */
export class SlicePlaneEntity {
  private viewer: Viewer;
  private entity: Entity | null = null;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
  }

  update(grid: WeatherGrid, plane: SlicePlane) {
    // Remove old entity
    if (this.entity) {
      this.viewer.entities.remove(this.entity);
      this.entity = null;
    }

    const { bounds } = grid;
    const range: Vec3 = [
      bounds.lon[1] - bounds.lon[0],
      bounds.lat[1] - bounds.lat[0],
      bounds.alt[1] - bounds.alt[0],
    ];

    // Compute tangent basis in normalized space
    const normNormal = vec3Normalize([
      plane.normal[0] * range[0],
      plane.normal[1] * range[1],
      plane.normal[2] * range[2],
    ]);
    const [uAxisN, vAxisN] = buildTangentBasis(normNormal);

    // Convert tangent vectors back to world scale
    const uAxis: Vec3 = [uAxisN[0] * range[0], uAxisN[1] * range[1], uAxisN[2] * range[2]];
    const vAxis: Vec3 = [vAxisN[0] * range[0], vAxisN[1] * range[1], vAxisN[2] * range[2]];

    // Size the plane to cover the grid extent
    const halfU = 0.6; // slightly larger than half the grid in normalized space
    const halfV = 0.6;

    const origin = plane.origin;
    const corners: Vec3[] = [
      vec3Add(origin, vec3Add(vec3Scale(uAxis, -halfU), vec3Scale(vAxis, -halfV))),
      vec3Add(origin, vec3Add(vec3Scale(uAxis, halfU), vec3Scale(vAxis, -halfV))),
      vec3Add(origin, vec3Add(vec3Scale(uAxis, halfU), vec3Scale(vAxis, halfV))),
      vec3Add(origin, vec3Add(vec3Scale(uAxis, -halfU), vec3Scale(vAxis, halfV))),
    ];

    // Convert to Cesium Cartesian3 positions (lon, lat, alt)
    const positions = corners.map((c) =>
      Cartesian3.fromDegrees(c[0], c[1], Math.max(0, c[2])),
    );

    this.entity = this.viewer.entities.add({
      polygon: {
        hierarchy: new PolygonHierarchy(positions),
        material: Color.fromCssColorString('#3b82f6').withAlpha(0.3),
        perPositionHeight: true,
        outline: true,
        outlineColor: Color.fromCssColorString('#3b82f6').withAlpha(0.8),
        outlineWidth: 2,
      },
    });

    this.viewer.scene.requestRender();
  }

  destroy() {
    if (this.entity) {
      this.viewer.entities.remove(this.entity);
      this.entity = null;
    }
  }
}
