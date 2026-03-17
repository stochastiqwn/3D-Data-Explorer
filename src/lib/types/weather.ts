export type DataVariable = 'humidity' | 'wind_speed' | 'wind_direction' | 'pressure';

export const ALL_VARIABLES: DataVariable[] = ['humidity', 'wind_speed', 'wind_direction', 'pressure'];

export interface Bounds3D {
  lat: [number, number];
  lon: [number, number];
  alt: [number, number]; // meters
}

/** Regular 3D grid of weather data at a single timestep */
export interface WeatherGrid {
  variables: Map<DataVariable, Float32Array>; // flattened z-major: [z][y][x]
  dimensions: { x: number; y: number; z: number };
  bounds: Bounds3D;
  timestep: number;
  totalTimesteps: number;
}

/** Sparse point cloud of weather data */
export interface WeatherPointCloud {
  positions: Float32Array; // interleaved [lat, lon, alt, lat, lon, alt, ...]
  variables: Map<DataVariable, Float32Array>;
  count: number;
  timestep: number;
}

/** A plane in 3D space used for slicing */
export interface SlicePlane {
  origin: [number, number, number];
  normal: [number, number, number];
}

/** Result of slicing a volume with a plane */
export interface SliceResult {
  width: number;
  height: number;
  values: Float32Array;
  variable: DataVariable;
  uAxis: [number, number, number]; // tangent axis on the slice plane
  vAxis: [number, number, number]; // bitangent axis on the slice plane
  origin: [number, number, number];
  cellSizeU: number;
  cellSizeV: number;
}

export type WeatherData = WeatherGrid | WeatherPointCloud;

export function isGrid(data: WeatherData): data is WeatherGrid {
  return 'dimensions' in data;
}

export interface LoadOptions {
  variables?: DataVariable[];
  timestep?: number;
  bounds?: Partial<Bounds3D>;
}

export interface DataLoader {
  load(source: string | File, options?: LoadOptions): AsyncGenerator<WeatherGrid>;
  supports(source: string | File): boolean;
}
