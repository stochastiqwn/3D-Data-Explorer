export type Vec3 = [number, number, number];

export function vec3Add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function vec3Scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

export function vec3Dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vec3Cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function vec3Length(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

export function vec3Normalize(v: Vec3): Vec3 {
  const len = vec3Length(v);
  if (len === 0) return [0, 0, 0];
  return vec3Scale(v, 1 / len);
}

/** Build an orthonormal basis from a normal vector. Returns [u, v] tangent vectors. */
export function buildTangentBasis(normal: Vec3): [Vec3, Vec3] {
  const n = vec3Normalize(normal);
  // Pick a vector not parallel to n
  const ref: Vec3 = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = vec3Normalize(vec3Cross(n, ref));
  const v = vec3Cross(n, u);
  return [u, v];
}

/** Linearly interpolate between a and b */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp value to [min, max] */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
