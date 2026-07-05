/**
 * Deterministic fallback head: a solid-color 48×48 tile with up to two
 * letters/digits from the user's display name, drawn with a tiny bitmap
 * font. No Date/random anywhere — same input always renders the same tile
 * (docs/characters.md "no avatar available").
 */
import { clampTint, hexToRgb, hslToHex, rasterToPngDataUri, type Raster } from "./pixelate.js";

const TILE_SIZE = 48;
const GLYPH_W = 3;
const GLYPH_H = 5;
const OFF_WHITE = { r: 240, g: 238, b: 230 };

/**
 * Minimal 3×5 pixel font, digits + A–Z + "?". Each glyph is 5 rows of a
 * 3-char string ("X" = lit pixel); approximate shapes are fine at this size
 * — legibility at a glance, not typography.
 */
const FONT: Record<string, string[]> = {
  A: [".X.", "X.X", "XXX", "X.X", "X.X"],
  B: ["XX.", "X.X", "XX.", "X.X", "XX."],
  C: [".XX", "X..", "X..", "X..", ".XX"],
  D: ["XX.", "X.X", "X.X", "X.X", "XX."],
  E: ["XXX", "X..", "XX.", "X..", "XXX"],
  F: ["XXX", "X..", "XX.", "X..", "X.."],
  G: [".XX", "X..", "X.X", "X.X", ".XX"],
  H: ["X.X", "X.X", "XXX", "X.X", "X.X"],
  I: ["XXX", ".X.", ".X.", ".X.", "XXX"],
  J: ["..X", "..X", "..X", "X.X", ".X."],
  K: ["X.X", "X.X", "XX.", "X.X", "X.X"],
  L: ["X..", "X..", "X..", "X..", "XXX"],
  M: ["X.X", "XXX", "X.X", "X.X", "X.X"],
  N: ["X.X", "XX.", "X.X", "X.X", "X.X"],
  O: [".X.", "X.X", "X.X", "X.X", ".X."],
  P: ["XX.", "X.X", "XX.", "X..", "X.."],
  Q: [".X.", "X.X", "X.X", ".X.", "..X"],
  R: ["XX.", "X.X", "XX.", "X.X", "X.X"],
  S: [".XX", "X..", ".X.", "..X", "XX."],
  T: ["XXX", ".X.", ".X.", ".X.", ".X."],
  U: ["X.X", "X.X", "X.X", "X.X", ".X."],
  V: ["X.X", "X.X", "X.X", "X.X", ".X."],
  W: ["X.X", "X.X", "X.X", "XXX", "X.X"],
  X: ["X.X", ".X.", ".X.", ".X.", "X.X"],
  Y: ["X.X", "X.X", ".X.", ".X.", ".X."],
  Z: ["XXX", "..X", ".X.", "X..", "XXX"],
  "0": [".X.", "X.X", "X.X", "X.X", ".X."],
  "1": [".X.", "XX.", ".X.", ".X.", "XXX"],
  "2": ["XX.", "..X", ".X.", "X..", "XXX"],
  "3": ["XX.", "..X", ".X.", "..X", "XX."],
  "4": ["X.X", "X.X", "XXX", "..X", "..X"],
  "5": ["XXX", "X..", "XX.", "..X", "XX."],
  "6": [".XX", "X..", "XX.", "X.X", ".X."],
  "7": ["XXX", "..X", ".X.", "X..", "X.."],
  "8": [".X.", "X.X", ".X.", "X.X", ".X."],
  "9": [".X.", "X.X", ".XX", "..X", "XX."],
  "?": ["XX.", "..X", ".X.", "...", ".X."],
};

/** Deterministic string hash (djb2) — a stable seed for the tile's background hue, no crypto needed. */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function colorFromHash(seed: string): string {
  const hue = (hashString(seed) % 360) / 360;
  return hslToHex({ h: hue, s: 0.6, l: 0.5 });
}

/** Up to two initials from a display name: first two words' initials, or the first two letters of a single word. */
export function initialsFor(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const words = trimmed.split(/\s+/).filter(Boolean);
  const chars =
    words.length >= 2
      ? [words[0]!.charAt(0), words[1]!.charAt(0)]
      : Array.from(words[0] ?? "?").slice(0, 2);
  return chars
    .map((c) => c.toUpperCase())
    .map((c) => (FONT[c] ? c : "?"))
    .join("");
}

function drawGlyph(
  data: Uint8Array,
  size: number,
  glyph: string[],
  originX: number,
  originY: number,
  scale: number,
): void {
  for (let row = 0; row < GLYPH_H; row++) {
    const line = glyph[row] ?? "...";
    for (let col = 0; col < GLYPH_W; col++) {
      if (line[col] !== "X") continue;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const x = originX + col * scale + sx;
          const y = originY + row * scale + sy;
          if (x < 0 || x >= size || y < 0 || y >= size) continue;
          const idx = (y * size + x) * 4;
          data[idx] = OFF_WHITE.r;
          data[idx + 1] = OFF_WHITE.g;
          data[idx + 2] = OFF_WHITE.b;
          data[idx + 3] = 255;
        }
      }
    }
  }
}

const SCALE_ONE_GLYPH = 8;
const SCALE_TWO_GLYPHS = 6;
const GLYPH_GAP = 2;

/** Render the 48×48 fallback tile: solid hashed-hue background, off-white initials centered. */
export function initialsTile(name: string): Raster {
  const glyphChars = initialsFor(name).split("");
  const bg = hexToRgb(clampTint(colorFromHash(name || "?")));
  const data = new Uint8Array(TILE_SIZE * TILE_SIZE * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = bg.r;
    data[i + 1] = bg.g;
    data[i + 2] = bg.b;
    data[i + 3] = 255;
  }

  if (glyphChars.length === 1) {
    const glyph = FONT[glyphChars[0]!] ?? FONT["?"]!;
    const w = GLYPH_W * SCALE_ONE_GLYPH;
    const h = GLYPH_H * SCALE_ONE_GLYPH;
    drawGlyph(data, TILE_SIZE, glyph, Math.floor((TILE_SIZE - w) / 2), Math.floor((TILE_SIZE - h) / 2), SCALE_ONE_GLYPH);
  } else {
    const w = GLYPH_W * SCALE_TWO_GLYPHS;
    const h = GLYPH_H * SCALE_TWO_GLYPHS;
    const totalW = w * 2 + GLYPH_GAP;
    const startX = Math.floor((TILE_SIZE - totalW) / 2);
    const y = Math.floor((TILE_SIZE - h) / 2);
    glyphChars.forEach((c, i) => {
      const glyph = FONT[c] ?? FONT["?"]!;
      drawGlyph(data, TILE_SIZE, glyph, startX + i * (w + GLYPH_GAP), y, SCALE_TWO_GLYPHS);
    });
  }

  return { width: TILE_SIZE, height: TILE_SIZE, data };
}

/** The fallback identity: a deterministic initials tile + its background as the body tint. */
export function initialsFallback(name: string): { headDataUri: string; bodyTint: string } {
  const tint = clampTint(colorFromHash(name || "?"));
  return { headDataUri: rasterToPngDataUri(initialsTile(name)), bodyTint: tint };
}
