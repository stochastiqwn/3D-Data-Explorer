import type { WeatherGrid, SlicePlane, SliceResult, DataVariable } from '../types/weather';
import { buildTangentBasis, vec3Add, vec3Scale, vec3Sub, vec3Normalize, lerp, clamp, type Vec3 } from '../utils/math';

/**
 * Trilinear interpolation in grid-index space [0, dim-1].
 */
function sampleGrid(
  data: Float32Array,
  dims: { x: number; y: number; z: number },
  gx: number,
  gy: number,
  gz: number,
): number {
  const x0 = Math.floor(gx), y0 = Math.floor(gy), z0 = Math.floor(gz);
  const x1 = Math.min(x0 + 1, dims.x - 1);
  const y1 = Math.min(y0 + 1, dims.y - 1);
  const z1 = Math.min(z0 + 1, dims.z - 1);
  const fx = gx - x0, fy = gy - y0, fz = gz - z0;

  const idx = (z: number, y: number, x: number) => z * dims.y * dims.x + y * dims.x + x;

  const c000 = data[idx(z0, y0, x0)];
  const c100 = data[idx(z0, y0, x1)];
  const c010 = data[idx(z0, y1, x0)];
  const c110 = data[idx(z0, y1, x1)];
  const c001 = data[idx(z1, y0, x0)];
  const c101 = data[idx(z1, y0, x1)];
  const c011 = data[idx(z1, y1, x0)];
  const c111 = data[idx(z1, y1, x1)];

  return lerp(
    lerp(lerp(c000, c100, fx), lerp(c010, c110, fx), fy),
    lerp(lerp(c001, c101, fx), lerp(c011, c111, fx), fy),
    fz,
  );
}

/** Check if a point is inside the [0,1]^3 unit cube */
function inUnitCube(p: Vec3): boolean {
  return p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= 1 && p[2] >= 0 && p[2] <= 1;
}

/** Convert a normalized [0,1] position to grid indices */
function normToGrid(p: Vec3, dims: { x: number; y: number; z: number }): Vec3 {
  return [
    p[0] * (dims.x - 1),
    p[1] * (dims.y - 1),
    p[2] * (dims.z - 1),
  ];
}

/**
 * Convert a world-space plane to normalized [0,1]^3 grid space.
 *
 * All slicing math happens in normalized space where every axis is 0-1,
 * so tangent basis / extent calculations never mix degrees with meters.
 */
function normalizeSlicePlane(
  plane: SlicePlane,
  bounds: WeatherGrid['bounds'],
): { normOrigin: Vec3; normNormal: Vec3 } {
  const range: Vec3 = [
    bounds.lon[1] - bounds.lon[0],
    bounds.lat[1] - bounds.lat[0],
    bounds.alt[1] - bounds.alt[0],
  ];

  const normOrigin: Vec3 = [
    (plane.origin[0] - bounds.lon[0]) / range[0],
    (plane.origin[1] - bounds.lat[0]) / range[1],
    (plane.origin[2] - bounds.alt[0]) / range[2],
  ];

  // The normal is already in normalized [0,1]^3 space (computed from pitch/yaw
  // in the isotropic unit-cube slicer view), so no scaling is needed.
  const normNormal = vec3Normalize(plane.normal);

  return { normOrigin, normNormal };
}

/**
 * Slice a WeatherGrid with an arbitrary plane.
 *
 * All geometry is done in normalized [0,1]^3 space so pitch/yaw
 * angles work correctly regardless of the grid's aspect ratio.
 */
export function sliceGrid(
  grid: WeatherGrid,
  plane: SlicePlane,
  variable: DataVariable,
  resolution: number = 64,
): SliceResult | null {
  const data = grid.variables.get(variable);
  if (!data) return null;

  const { bounds, dimensions } = grid;
  const { normOrigin, normNormal } = normalizeSlicePlane(plane, bounds);
  const [uAxis, vAxis] = buildTangentBasis(normNormal);

  // In normalized space the grid spans [0,1] in each axis.
  // Project unit-cube extent onto each tangent axis.
  const uExtent = Math.abs(uAxis[0]) + Math.abs(uAxis[1]) + Math.abs(uAxis[2]);
  const vExtent = Math.abs(vAxis[0]) + Math.abs(vAxis[1]) + Math.abs(vAxis[2]);
  if (uExtent === 0 || vExtent === 0) return null;

  const cellSizeU = uExtent / resolution;
  const cellSizeV = vExtent / resolution;

  const values = new Float32Array(resolution * resolution);

  for (let vi = 0; vi < resolution; vi++) {
    for (let ui = 0; ui < resolution; ui++) {
      const uOff = (ui - resolution / 2 + 0.5) * cellSizeU;
      const vOff = (vi - resolution / 2 + 0.5) * cellSizeV;
      const pos = vec3Add(normOrigin, vec3Add(vec3Scale(uAxis, uOff), vec3Scale(vAxis, vOff)));

      if (!inUnitCube(pos)) {
        values[vi * resolution + ui] = NaN;
      } else {
        const [gx, gy, gz] = normToGrid(pos, dimensions);
        values[vi * resolution + ui] = sampleGrid(
          data, dimensions,
          clamp(gx, 0, dimensions.x - 1),
          clamp(gy, 0, dimensions.y - 1),
          clamp(gz, 0, dimensions.z - 1),
        );
      }
    }
  }

  return {
    width: resolution,
    height: resolution,
    values,
    variable,
    uAxis,
    vAxis,
    origin: [...plane.origin],
    cellSizeU,
    cellSizeV,
  };
}

/**
 * Compute a line-integral heatmap: at each (u,v) point on the slice plane,
 * integrate the variable along a straight line from the anchor (plane origin)
 * to that point through the 3D volume.
 *
 * Produces a radial accumulation map centered on the anchor.
 */
export function integrateFromAnchor(
  grid: WeatherGrid,
  plane: SlicePlane,
  variable: DataVariable,
  resolution: number = 64,
  numSteps: number = 48,
): SliceResult | null {
  const data = grid.variables.get(variable);
  if (!data) return null;

  const { bounds, dimensions } = grid;
  const { normOrigin, normNormal } = normalizeSlicePlane(plane, bounds);
  const [uAxis, vAxis] = buildTangentBasis(normNormal);

  const uExtent = Math.abs(uAxis[0]) + Math.abs(uAxis[1]) + Math.abs(uAxis[2]);
  const vExtent = Math.abs(vAxis[0]) + Math.abs(vAxis[1]) + Math.abs(vAxis[2]);
  if (uExtent === 0 || vExtent === 0) return null;

  const cellSizeU = uExtent / resolution;
  const cellSizeV = vExtent / resolution;
  const values = new Float32Array(resolution * resolution);

  for (let vi = 0; vi < resolution; vi++) {
    for (let ui = 0; ui < resolution; ui++) {
      const uOff = (ui - resolution / 2 + 0.5) * cellSizeU;
      const vOff = (vi - resolution / 2 + 0.5) * cellSizeV;
      const endPos = vec3Add(normOrigin, vec3Add(vec3Scale(uAxis, uOff), vec3Scale(vAxis, vOff)));

      // Integrate from normOrigin to endPos
      const dir = vec3Sub(endPos, normOrigin);
      let sum = 0;
      let validSteps = 0;

      for (let s = 0; s <= numSteps; s++) {
        const t = s / numSteps;
        const pos: Vec3 = [
          normOrigin[0] + dir[0] * t,
          normOrigin[1] + dir[1] * t,
          normOrigin[2] + dir[2] * t,
        ];
        if (inUnitCube(pos)) {
          const [gx, gy, gz] = normToGrid(pos, dimensions);
          const val = sampleGrid(
            data, dimensions,
            clamp(gx, 0, dimensions.x - 1),
            clamp(gy, 0, dimensions.y - 1),
            clamp(gz, 0, dimensions.z - 1),
          );
          if (!isNaN(val)) {
            sum += val;
            validSteps++;
          }
        }
      }

      values[vi * resolution + ui] = validSteps > 0 ? sum / numSteps : NaN;
    }
  }

  return {
    width: resolution,
    height: resolution,
    values,
    variable,
    uAxis,
    vAxis,
    origin: [...plane.origin],
    cellSizeU,
    cellSizeV,
  };
}
