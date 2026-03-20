/**
 * Web Worker for expensive slicer computations (integral heatmap).
 * Self-contained — all math is inlined to avoid import issues in worker context.
 */

type Vec3 = [number, number, number];

interface WorkerRequest {
  id: number;
  type: 'slice' | 'integral';
  // Serialized grid data
  dimensions: { x: number; y: number; z: number };
  bounds: { lat: [number, number]; lon: [number, number]; alt: [number, number] };
  variableData: Float32Array;
  // Plane
  origin: Vec3;
  normal: Vec3;
  variable: string;
  resolution: number;
  numSteps?: number;
}

interface WorkerResponse {
  id: number;
  values: Float32Array;
  width: number;
  height: number;
  variable: string;
  uAxis: Vec3;
  vAxis: Vec3;
  origin: Vec3;
  cellSizeU: number;
  cellSizeV: number;
}

// ---------- Inlined math ----------
function vec3Add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function vec3Scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}
function vec3Cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}
function vec3Normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
  if (len === 0) return [0,0,0];
  return [v[0]/len, v[1]/len, v[2]/len];
}
function buildTangentBasis(normal: Vec3): [Vec3, Vec3] {
  const n = vec3Normalize(normal);
  const ref: Vec3 = Math.abs(n[0]) < 0.9 ? [1,0,0] : [0,1,0];
  const u = vec3Normalize(vec3Cross(n, ref));
  const v = vec3Cross(n, u);
  return [u, v];
}
function lerp(a: number, b: number, t: number): number { return a + (b-a)*t; }
function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }

// ---------- Inlined slicer ----------
function sampleGrid(data: Float32Array, dims: { x: number; y: number; z: number }, gx: number, gy: number, gz: number): number {
  const x0 = Math.floor(gx), y0 = Math.floor(gy), z0 = Math.floor(gz);
  const x1 = Math.min(x0+1, dims.x-1), y1 = Math.min(y0+1, dims.y-1), z1 = Math.min(z0+1, dims.z-1);
  const fx = gx-x0, fy = gy-y0, fz = gz-z0;
  const idx = (z: number, y: number, x: number) => z*dims.y*dims.x + y*dims.x + x;
  return lerp(
    lerp(lerp(data[idx(z0,y0,x0)], data[idx(z0,y0,x1)], fx), lerp(data[idx(z0,y1,x0)], data[idx(z0,y1,x1)], fx), fy),
    lerp(lerp(data[idx(z1,y0,x0)], data[idx(z1,y0,x1)], fx), lerp(data[idx(z1,y1,x0)], data[idx(z1,y1,x1)], fx), fy),
    fz,
  );
}

function inUnitCube(p: Vec3): boolean {
  return p[0]>=0 && p[0]<=1 && p[1]>=0 && p[1]<=1 && p[2]>=0 && p[2]<=1;
}

function normToGrid(p: Vec3, dims: { x: number; y: number; z: number }): Vec3 {
  return [p[0]*(dims.x-1), p[1]*(dims.y-1), p[2]*(dims.z-1)];
}

function normalizeSlicePlane(origin: Vec3, normal: Vec3, bounds: WorkerRequest['bounds']) {
  const range: Vec3 = [bounds.lon[1]-bounds.lon[0], bounds.lat[1]-bounds.lat[0], bounds.alt[1]-bounds.alt[0]];
  const normOrigin: Vec3 = [
    (origin[0]-bounds.lon[0])/range[0],
    (origin[1]-bounds.lat[0])/range[1],
    (origin[2]-bounds.alt[0])/range[2],
  ];
  // Normal is already in normalized [0,1]^3 space — no scaling needed
  const normNormal = vec3Normalize(normal);
  return { normOrigin, normNormal };
}

function computeSlice(req: WorkerRequest): WorkerResponse {
  const { dimensions, bounds, variableData, origin, normal, variable, resolution } = req;
  const { normOrigin, normNormal } = normalizeSlicePlane(origin, normal, bounds);
  const [uAxis, vAxis] = buildTangentBasis(normNormal);
  const uExtent = Math.abs(uAxis[0])+Math.abs(uAxis[1])+Math.abs(uAxis[2]);
  const vExtent = Math.abs(vAxis[0])+Math.abs(vAxis[1])+Math.abs(vAxis[2]);
  const cellSizeU = uExtent/resolution;
  const cellSizeV = vExtent/resolution;
  const values = new Float32Array(resolution*resolution);

  for (let vi = 0; vi < resolution; vi++) {
    for (let ui = 0; ui < resolution; ui++) {
      const uOff = (ui - resolution/2 + 0.5) * cellSizeU;
      const vOff = (vi - resolution/2 + 0.5) * cellSizeV;
      const pos = vec3Add(normOrigin, vec3Add(vec3Scale(uAxis, uOff), vec3Scale(vAxis, vOff)));
      if (!inUnitCube(pos)) {
        values[vi*resolution+ui] = NaN;
      } else {
        const [gx,gy,gz] = normToGrid(pos, dimensions);
        values[vi*resolution+ui] = sampleGrid(variableData, dimensions, clamp(gx,0,dimensions.x-1), clamp(gy,0,dimensions.y-1), clamp(gz,0,dimensions.z-1));
      }
    }
  }

  return { id: req.id, values, width: resolution, height: resolution, variable, uAxis, vAxis, origin, cellSizeU, cellSizeV };
}

function computeIntegral(req: WorkerRequest): WorkerResponse {
  const { dimensions, bounds, variableData, origin, normal, variable, resolution, numSteps = 48 } = req;
  const { normOrigin, normNormal } = normalizeSlicePlane(origin, normal, bounds);
  const [uAxis, vAxis] = buildTangentBasis(normNormal);
  const uExtent = Math.abs(uAxis[0])+Math.abs(uAxis[1])+Math.abs(uAxis[2]);
  const vExtent = Math.abs(vAxis[0])+Math.abs(vAxis[1])+Math.abs(vAxis[2]);
  const cellSizeU = uExtent/resolution;
  const cellSizeV = vExtent/resolution;
  const values = new Float32Array(resolution*resolution);

  for (let vi = 0; vi < resolution; vi++) {
    for (let ui = 0; ui < resolution; ui++) {
      const uOff = (ui - resolution/2 + 0.5) * cellSizeU;
      const vOff = (vi - resolution/2 + 0.5) * cellSizeV;
      const endPos = vec3Add(normOrigin, vec3Add(vec3Scale(uAxis, uOff), vec3Scale(vAxis, vOff)));
      const dir = vec3Sub(endPos, normOrigin);
      let sum = 0, valid = 0;
      for (let s = 0; s <= numSteps; s++) {
        const t = s/numSteps;
        const pos: Vec3 = [normOrigin[0]+dir[0]*t, normOrigin[1]+dir[1]*t, normOrigin[2]+dir[2]*t];
        if (inUnitCube(pos)) {
          const [gx,gy,gz] = normToGrid(pos, dimensions);
          const val = sampleGrid(variableData, dimensions, clamp(gx,0,dimensions.x-1), clamp(gy,0,dimensions.y-1), clamp(gz,0,dimensions.z-1));
          if (!isNaN(val)) { sum += val; valid++; }
        }
      }
      values[vi*resolution+ui] = valid > 0 ? sum/numSteps : NaN;
    }
  }

  return { id: req.id, values, width: resolution, height: resolution, variable, uAxis, vAxis, origin, cellSizeU, cellSizeV };
}

// ---------- Message handler ----------
self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  const result = req.type === 'integral' ? computeIntegral(req) : computeSlice(req);
  (self as unknown as Worker).postMessage(result, [result.values.buffer] as unknown as Transferable[]);
};
