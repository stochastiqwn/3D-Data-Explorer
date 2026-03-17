import type { WeatherGrid, Bounds3D, DataVariable } from '../types/weather';

export interface Chunk {
  grid: WeatherGrid;
  chunkIndex: [number, number, number];
}

/**
 * Split a WeatherGrid into spatial chunks for progressive rendering.
 * Each chunk is a sub-grid covering a portion of the original bounds.
 */
export function chunkGrid(
  grid: WeatherGrid,
  chunksPerAxis: number = 2
): Chunk[] {
  const { dimensions, bounds, variables, timestep, totalTimesteps } = grid;
  const chunks: Chunk[] = [];

  const cxSize = Math.ceil(dimensions.x / chunksPerAxis);
  const cySize = Math.ceil(dimensions.y / chunksPerAxis);
  const czSize = Math.ceil(dimensions.z / chunksPerAxis);

  for (let cz = 0; cz < chunksPerAxis; cz++) {
    for (let cy = 0; cy < chunksPerAxis; cy++) {
      for (let cx = 0; cx < chunksPerAxis; cx++) {
        const x0 = cx * cxSize;
        const y0 = cy * cySize;
        const z0 = cz * czSize;
        const x1 = Math.min(x0 + cxSize, dimensions.x);
        const y1 = Math.min(y0 + cySize, dimensions.y);
        const z1 = Math.min(z0 + czSize, dimensions.z);
        const sx = x1 - x0, sy = y1 - y0, sz = z1 - z0;

        const chunkVars = new Map<DataVariable, Float32Array>();
        for (const [key, srcData] of variables) {
          const dst = new Float32Array(sx * sy * sz);
          let di = 0;
          for (let z = z0; z < z1; z++) {
            for (let y = y0; y < y1; y++) {
              for (let x = x0; x < x1; x++) {
                dst[di++] = srcData[z * dimensions.y * dimensions.x + y * dimensions.x + x];
              }
            }
          }
          chunkVars.set(key, dst);
        }

        const lonRange = bounds.lon[1] - bounds.lon[0];
        const latRange = bounds.lat[1] - bounds.lat[0];
        const altRange = bounds.alt[1] - bounds.alt[0];

        const chunkBounds: Bounds3D = {
          lon: [
            bounds.lon[0] + (x0 / dimensions.x) * lonRange,
            bounds.lon[0] + (x1 / dimensions.x) * lonRange,
          ],
          lat: [
            bounds.lat[0] + (y0 / dimensions.y) * latRange,
            bounds.lat[0] + (y1 / dimensions.y) * latRange,
          ],
          alt: [
            bounds.alt[0] + (z0 / dimensions.z) * altRange,
            bounds.alt[0] + (z1 / dimensions.z) * altRange,
          ],
        };

        chunks.push({
          grid: {
            variables: chunkVars,
            dimensions: { x: sx, y: sy, z: sz },
            bounds: chunkBounds,
            timestep,
            totalTimesteps,
          },
          chunkIndex: [cx, cy, cz],
        });
      }
    }
  }

  return chunks;
}
