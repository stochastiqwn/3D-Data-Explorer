import type { DataLoader } from '../types/weather';

const loaders: DataLoader[] = [];

export function registerLoader(loader: DataLoader) {
  loaders.push(loader);
}

export function getLoader(source: string | File): DataLoader | null {
  return loaders.find((l) => l.supports(source)) ?? null;
}

export { loaders };
