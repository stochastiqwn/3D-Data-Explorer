import type { WeatherGrid, SlicePlane, SliceResult, DataVariable } from '../types/weather';
import { buildTangentBasis, vec3Add, vec3Scale, vec3Sub, lerp, clamp, type Vec3 } from '../utils/math';

/**
 * Sample a value from a 3D grid using trilinear interpolation.
 * Coordinates are in normalized grid space [0, dim-1].
 */
function sampleGrid(data: Float32Array, dims: { x: number; y: number; z: number }, gx: number, gy: number, gz: number): number {
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
    fz
  );
}

/**
 * Slice a WeatherGrid with an arbitrary plane and return a 2D grid of sampled values.
 * The plane is defined in the grid's world-space (lat/lon/alt bounds).
 */
export function sliceGrid(
  grid: WeatherGrid,
  plane: SlicePlane,
  variable: DataVariable,
  resolution: number = 64
): SliceResult | null {
  const data = grid.variables.get(variable);
  if (!data) return null;

  const [uAxis, vAxis] = buildTangentBasis(plane.normal);
  const { bounds, dimensions } = grid;

  // Compute the extent of the grid diagonal for sizing the slice plane
  const gridSize: Vec3 = [
    bounds.lon[1] - bounds.lon[0],
    bounds.lat[1] - bounds.lat[0],
    bounds.alt[1] - bounds.alt[0],
  ];
  const halfExtent = Math.sqrt(gridSize[0] ** 2 + gridSize[1] ** 2 + gridSize[2] ** 2) / 2;

  const cellSizeU = (2 * halfExtent) / resolution;
  const cellSizeV = (2 * halfExtent) / resolution;

  const values = new Float32Array(resolution * resolution);
  const origin = plane.origin;

  for (let vi = 0; vi < resolution; vi++) {
    for (let ui = 0; ui < resolution; ui++) {
      const uOff = (ui - resolution / 2 + 0.5) * cellSizeU;
      const vOff = (vi - resolution / 2 + 0.5) * cellSizeV;
      const worldPos = vec3Add(origin, vec3Add(vec3Scale(uAxis, uOff), vec3Scale(vAxis, vOff)));

      // Convert world position to grid coordinates
      const gx = ((worldPos[0] - bounds.lon[0]) / gridSize[0]) * (dimensions.x - 1);
      const gy = ((worldPos[1] - bounds.lat[0]) / gridSize[1]) * (dimensions.y - 1);
      const gz = ((worldPos[2] - bounds.alt[0]) / gridSize[2]) * (dimensions.z - 1);

      if (gx < 0 || gx >= dimensions.x || gy < 0 || gy >= dimensions.y || gz < 0 || gz >= dimensions.z) {
        values[vi * resolution + ui] = NaN;
      } else {
        values[vi * resolution + ui] = sampleGrid(
          data, dimensions,
          clamp(gx, 0, dimensions.x - 1),
          clamp(gy, 0, dimensions.y - 1),
          clamp(gz, 0, dimensions.z - 1)
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
    origin: [...origin],
    cellSizeU,
    cellSizeV,
  };
}
