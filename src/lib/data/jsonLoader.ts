import type { DataLoader, WeatherGrid, LoadOptions, DataVariable } from '../types/weather';
import { registerLoader } from './loader';

interface JsonGridData {
  dimensions: { x: number; y: number; z: number };
  bounds: {
    lat: [number, number];
    lon: [number, number];
    alt: [number, number];
  };
  timesteps: number;
  variables: Record<string, number[]>;
}

const jsonLoader: DataLoader = {
  supports(source: string | File): boolean {
    if (typeof source === 'string') return source.endsWith('.json');
    return source.name.endsWith('.json');
  },

  async *load(source: string | File, options?: LoadOptions): AsyncGenerator<WeatherGrid> {
    let raw: JsonGridData;

    if (typeof source === 'string') {
      const response = await fetch(source);
      raw = await response.json();
    } else {
      const text = await source.text();
      raw = JSON.parse(text);
    }

    const variables = new Map<DataVariable, Float32Array>();
    for (const [key, values] of Object.entries(raw.variables)) {
      if (options?.variables && !options.variables.includes(key as DataVariable)) continue;
      variables.set(key as DataVariable, new Float32Array(values));
    }

    yield {
      variables,
      dimensions: raw.dimensions,
      bounds: raw.bounds,
      timestep: options?.timestep ?? 0,
      totalTimesteps: raw.timesteps ?? 1,
    };
  },
};

registerLoader(jsonLoader);

export default jsonLoader;
