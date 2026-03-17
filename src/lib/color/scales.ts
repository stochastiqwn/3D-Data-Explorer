import { interpolateViridis, interpolateInferno, interpolatePlasma, interpolateTurbo } from 'd3-scale-chromatic';
import { scaleSequential } from 'd3-scale';

export type ColorScaleName = 'viridis' | 'inferno' | 'plasma' | 'turbo';

const interpolators: Record<ColorScaleName, (t: number) => string> = {
  viridis: interpolateViridis,
  inferno: interpolateInferno,
  plasma: interpolatePlasma,
  turbo: interpolateTurbo,
};

export function createColorScale(name: ColorScaleName, domain: [number, number]) {
  return scaleSequential(interpolators[name]).domain(domain);
}

/** Convert a d3 color string to [r, g, b] in 0-255 range */
export function colorStringToRGB(color: string): [number, number, number] {
  // d3 returns "rgb(r, g, b)" strings
  const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (match) {
    return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
  }
  return [0, 0, 0];
}

/** Generate an RGBA ImageData from a Float32Array grid for use on a canvas */
export function valuesToImageData(
  values: Float32Array,
  width: number,
  height: number,
  domain: [number, number],
  scaleName: ColorScaleName = 'turbo'
): ImageData {
  const scale = createColorScale(scaleName, domain);
  const imageData = new ImageData(width, height);
  const data = imageData.data;

  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const px = i * 4;
    if (isNaN(v)) {
      data[px] = 0;
      data[px + 1] = 0;
      data[px + 2] = 0;
      data[px + 3] = 0;
    } else {
      const [r, g, b] = colorStringToRGB(scale(v));
      data[px] = r;
      data[px + 1] = g;
      data[px + 2] = b;
      data[px + 3] = 255;
    }
  }

  return imageData;
}
