/**
 * Pure raster/color functions for the avatar pipeline — no I/O, fully
 * deterministic, unit-tested directly (identity.test.ts). fetch.ts produces
 * the Raster this module consumes; index.ts wires the pipeline together.
 */
import { PNG } from "pngjs";

/** RGBA, row-major, 4 bytes per pixel — the shape every raster op shares. */
export interface Raster {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Downscale by box-averaging: each output pixel is the mean of every source
 * pixel that falls in its box, NOT a nearest-neighbor sample — a single
 * output pixel can span a color boundary and comes out as a genuine blend.
 * Always produces a `size`×`size` output (avatars are square).
 */
export function boxDownscale(raster: Raster, size: number): Raster {
  const { width, height, data } = raster;
  const out = new Uint8Array(size * size * 4);
  for (let ty = 0; ty < size; ty++) {
    const y0 = Math.floor((ty * height) / size);
    const y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * height) / size));
    for (let tx = 0; tx < size; tx++) {
      const x0 = Math.floor((tx * width) / size);
      const x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * width) / size));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const idx = (sy * width + sx) * 4;
          r += data[idx] ?? 0;
          g += data[idx + 1] ?? 0;
          b += data[idx + 2] ?? 0;
          a += data[idx + 3] ?? 0;
          count++;
        }
      }
      const outIdx = (ty * size + tx) * 4;
      out[outIdx] = Math.round(r / count);
      out[outIdx + 1] = Math.round(g / count);
      out[outIdx + 2] = Math.round(b / count);
      out[outIdx + 3] = Math.round(a / count);
    }
  }
  return { width: size, height: size, data: out };
}

const CHANNELS: (keyof RGB)[] = ["r", "g", "b"];

function channelRange(pixels: RGB[], channel: keyof RGB): number {
  let min = Infinity;
  let max = -Infinity;
  for (const p of pixels) {
    const v = p[channel];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return max - min;
}

function meanOf(pixels: RGB[]): RGB {
  let r = 0;
  let g = 0;
  let b = 0;
  for (const p of pixels) {
    r += p.r;
    g += p.g;
    b += p.b;
  }
  const n = pixels.length || 1;
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

export interface ColorCluster {
  mean: RGB;
  /** Pixel count in the cluster — used to rank clusters (dominantColor). */
  count: number;
}

/**
 * Median-cut color quantization: recursively splits the pixel set along
 * whichever channel (r, g, b) currently has the largest range, at the
 * median, always splitting the largest-population bucket next — until
 * there are `k` buckets or no bucket can be split further (fewer than `k`
 * distinct colors). Deterministic tie-breaking: channel ties keep the fixed
 * r > g > b order; bucket-size ties keep the earliest bucket; the median
 * split sorts by channel value with pixel index as the final tiebreaker.
 */
export function medianCut(pixels: RGB[], k: number): ColorCluster[] {
  if (pixels.length === 0) return [];
  const buckets: RGB[][] = [pixels];

  while (buckets.length < k) {
    let splitIndex = -1;
    let splitSize = 0;
    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i]!;
      if (bucket.length > 1 && bucket.length > splitSize) {
        splitIndex = i;
        splitSize = bucket.length;
      }
    }
    if (splitIndex === -1) break; // every bucket is down to 1 pixel

    const bucket = buckets[splitIndex]!;
    let bestChannel: keyof RGB = "r";
    let bestRange = -1;
    for (const channel of CHANNELS) {
      const range = channelRange(bucket, channel);
      if (range > bestRange) {
        bestRange = range;
        bestChannel = channel;
      }
    }

    const sorted = bucket
      .map((p, i) => ({ p, i }))
      .sort((a, b) => a.p[bestChannel] - b.p[bestChannel] || a.i - b.i)
      .map((x) => x.p);
    const mid = Math.ceil(sorted.length / 2);
    buckets.splice(splitIndex, 1, sorted.slice(0, mid), sorted.slice(mid));
  }

  return buckets.map((bucket) => ({ mean: meanOf(bucket), count: bucket.length }));
}

function nearestClusterMean(pixel: RGB, clusters: ColorCluster[]): RGB {
  let best: RGB = pixel;
  let bestDist = Infinity;
  for (const cluster of clusters) {
    const dr = pixel.r - cluster.mean.r;
    const dg = pixel.g - cluster.mean.g;
    const db = pixel.b - cluster.mean.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = cluster.mean;
    }
  }
  return best;
}

/** Reduce a raster to (up to) `k` colors: median-cut, then nearest-mean remap. */
export function quantize(raster: Raster, k: number): Raster {
  const pixels: RGB[] = [];
  for (let i = 0; i < raster.data.length; i += 4) {
    pixels.push({ r: raster.data[i] ?? 0, g: raster.data[i + 1] ?? 0, b: raster.data[i + 2] ?? 0 });
  }
  const clusters = medianCut(pixels, k);
  const data = new Uint8Array(raster.data.length);
  for (let i = 0, p = 0; i < raster.data.length; i += 4, p++) {
    const nearest = nearestClusterMean(pixels[p]!, clusters);
    data[i] = nearest.r;
    data[i + 1] = nearest.g;
    data[i + 2] = nearest.b;
    data[i + 3] = raster.data[i + 3] ?? 255;
  }
  return { width: raster.width, height: raster.height, data };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

interface HSL {
  h: number;
  s: number;
  l: number;
}

function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h / 6, s, l };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return {
    r: Math.round(hue2rgb(h + 1 / 3) * 255),
    g: Math.round(hue2rgb(h) * 255),
    b: Math.round(hue2rgb(h - 1 / 3) * 255),
  };
}

/** HSL of a hex color — exposed for tests to verify clampTint's bounds. */
export function hexToHsl(hex: string): HSL {
  return rgbToHsl(hexToRgb(hex));
}

/** Hex color from HSL — the inverse of hexToHsl, used by initials.ts. */
export function hslToHex(hsl: HSL): string {
  return rgbToHex(hslToRgb(hsl));
}

const MIN_LIGHTNESS = 0.45;
const MAX_LIGHTNESS = 0.65;
const MIN_SATURATION = 0.35;
const MAX_SATURATION = 0.8;

/**
 * Clamp a color into a legible tint range for the dark canvas
 * (docs/characters.md): lightness 0.45–0.65, saturation 0.35–0.8. Hue is
 * preserved.
 */
export function clampTint(hex: string): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  return rgbToHex(
    hslToRgb({
      h: hsl.h,
      s: Math.min(MAX_SATURATION, Math.max(MIN_SATURATION, hsl.s)),
      l: Math.min(MAX_LIGHTNESS, Math.max(MIN_LIGHTNESS, hsl.l)),
    }),
  );
}

const DOMINANT_DOWNSCALE_SIZE = 64;
const DOMINANT_CLUSTER_COUNT = 5;
const DOMINANT_SATURATION_FLOOR = 0.15;

/**
 * The avatar's dominant color, as a hex string: median-cut to 5 clusters on
 * a 64×64 downscale, picking the largest cluster whose HSL saturation is
 * above 0.15 (skips near-gray backgrounds), else the largest cluster
 * overall.
 */
export function dominantColor(raster: Raster): string {
  const small = boxDownscale(raster, DOMINANT_DOWNSCALE_SIZE);
  const pixels: RGB[] = [];
  for (let i = 0; i < small.data.length; i += 4) {
    pixels.push({ r: small.data[i] ?? 0, g: small.data[i + 1] ?? 0, b: small.data[i + 2] ?? 0 });
  }
  const byCount = medianCut(pixels, DOMINANT_CLUSTER_COUNT)
    .map((cluster, i) => ({ ...cluster, saturation: rgbToHsl(cluster.mean).s, i }))
    .sort((a, b) => b.count - a.count || a.i - b.i);
  const saturated = byCount.find((c) => c.saturation > DOMINANT_SATURATION_FLOOR);
  const winner = saturated ?? byCount[0];
  return rgbToHex(winner?.mean ?? { r: 128, g: 128, b: 128 });
}

/** Encode a raster as a PNG data URI (pngjs). Deterministic given the same bytes. */
export function rasterToPngDataUri(raster: Raster): string {
  const png = new PNG({ width: raster.width, height: raster.height });
  png.data = Buffer.from(raster.data);
  const buffer = PNG.sync.write(png);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}
