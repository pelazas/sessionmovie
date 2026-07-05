/**
 * GitHub identity pipeline: pixelation math, tint clamping, magic-byte
 * sniffing, and the fallback path — all synthetic (no network, no fixtures).
 *
 * Run: node --import tsx --test src/identity/identity.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sniffImageFormat } from "./fetch.js";
import { resolveUserIdentity } from "./index.js";
import { boxDownscale, clampTint, hexToHsl, medianCut, type RGB, type Raster } from "./pixelate.js";

/** Build a Raster from a flat list of [r,g,b] pixels, opaque alpha. */
function rasterFromPixels(width: number, height: number, pixels: [number, number, number][]): Raster {
  const data = new Uint8Array(width * height * 4);
  pixels.forEach(([r, g, b], i) => {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  });
  return { width, height, data };
}

describe("medianCut", () => {
  const pixels: RGB[] = [
    { r: 0, g: 0, b: 0 },
    { r: 10, g: 10, b: 10 },
    { r: 250, g: 250, b: 250 },
    { r: 240, g: 240, b: 240 },
    { r: 128, g: 0, b: 0 },
    { r: 0, g: 128, b: 0 },
  ];

  it("splits into exactly k clusters and is deterministic", () => {
    const a = medianCut(pixels, 3);
    const b = medianCut(pixels, 3);
    assert.equal(a.length, 3);
    assert.deepEqual(a, b);
    // every pixel is accounted for exactly once
    assert.equal(
      a.reduce((sum, c) => sum + c.count, 0),
      pixels.length,
    );
  });

  it("never produces more clusters than distinct pixels allow", () => {
    const clusters = medianCut(
      [
        { r: 5, g: 5, b: 5 },
        { r: 5, g: 5, b: 5 },
      ],
      8,
    );
    assert.equal(clusters.length, 2); // stops splitting once every bucket is 1 pixel
  });

  it("returns [] for an empty pixel set", () => {
    assert.deepEqual(medianCut([], 4), []);
  });
});

describe("boxDownscale", () => {
  it("averages both source pixels when a single output cell spans them (not nearest-neighbor)", () => {
    const raster = rasterFromPixels(2, 1, [
      [0, 0, 0],
      [254, 254, 254],
    ]);
    const out = boxDownscale(raster, 1);
    assert.equal(out.width, 1);
    assert.equal(out.height, 1);
    // true box average of 0 and 254 is 127 — nearest-neighbor would give 0 or 254.
    assert.equal(out.data[0], 127);
  });

  it("box-averages a 2D gradient into aligned quadrant cells", () => {
    const raster = rasterFromPixels(4, 4, [
      [0, 0, 0], [0, 0, 0], [255, 255, 255], [255, 255, 255],
      [0, 0, 0], [0, 0, 0], [255, 255, 255], [255, 255, 255],
      [100, 100, 100], [100, 100, 100], [200, 200, 200], [200, 200, 200],
      [100, 100, 100], [100, 100, 100], [200, 200, 200], [200, 200, 200],
    ]);
    const out = boxDownscale(raster, 2);
    assert.equal(out.width, 2);
    assert.deepEqual([...out.data.slice(0, 4)], [0, 0, 0, 255]); // top-left
    assert.deepEqual([...out.data.slice(4, 8)], [255, 255, 255, 255]); // top-right
    assert.deepEqual([...out.data.slice(8, 12)], [100, 100, 100, 255]); // bottom-left
    assert.deepEqual([...out.data.slice(12, 16)], [200, 200, 200, 255]); // bottom-right
  });
});

describe("clampTint", () => {
  it("clamps a near-black color's lightness up to the floor", () => {
    const { l } = hexToHsl(clampTint("#322d26"));
    assert.ok(l >= 0.45 - 1e-9, `lightness ${l} below the 0.45 floor`);
  });

  it("clamps a neon color's saturation down to the ceiling", () => {
    // Loose tolerance: hex is 8-bit per channel, so an exact 0.8 doesn't
    // always survive the HSL→RGB→hex round-trip bit-for-bit.
    const { s } = hexToHsl(clampTint("#ff00ff"));
    assert.ok(s <= 0.81, `saturation ${s} above the 0.8 ceiling`);
  });

  it("leaves an already-legible color's hue unchanged", () => {
    const before = hexToHsl("#4a90d9");
    const after = hexToHsl(clampTint("#4a90d9"));
    assert.ok(Math.abs(before.h - after.h) < 1e-9);
  });
});

describe("sniffImageFormat", () => {
  it("recognizes JPEG and PNG magic bytes and rejects anything else", () => {
    assert.equal(sniffImageFormat(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), "jpeg");
    assert.equal(sniffImageFormat(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])), "png");
    assert.equal(sniffImageFormat(Uint8Array.from([0x00, 0x00, 0x00, 0x00])), null);
    assert.equal(sniffImageFormat(Uint8Array.from([0xff, 0xd8])), null); // too short
  });
});

describe("resolveUserIdentity", () => {
  it("falls back to the initials tile when the avatar fetch fails, without touching the network", async () => {
    const identity = await resolveUserIdentity({
      resolveLogin: () => "octocat",
      fetchAvatarImpl: async () => null,
      displayName: () => "Ada Lovelace",
    });
    assert.equal(identity.fallback, true);
    assert.ok(identity.headDataUri.startsWith("data:image/png;base64,"));
    assert.match(identity.bodyTint, /^#[0-9a-f]{6}$/);
  });

  it("falls back straight away when no login resolves, never calling fetch", async () => {
    let fetchCalled = false;
    const identity = await resolveUserIdentity({
      resolveLogin: () => null,
      fetchAvatarImpl: async () => {
        fetchCalled = true;
        return null;
      },
      displayName: () => "?",
    });
    assert.equal(identity.fallback, true);
    assert.equal(fetchCalled, false);
  });

  it("uses the decoded avatar when the whole pipeline succeeds", async () => {
    const avatar = rasterFromPixels(2, 2, [
      [200, 40, 40],
      [200, 40, 40],
      [10, 10, 10],
      [10, 10, 10],
    ]);
    const identity = await resolveUserIdentity({
      resolveLogin: () => "octocat",
      fetchAvatarImpl: async () => avatar,
      displayName: () => "Ada Lovelace",
    });
    assert.equal(identity.fallback, false);
    assert.ok(identity.headDataUri.startsWith("data:image/png;base64,"));
    assert.match(identity.bodyTint, /^#[0-9a-f]{6}$/);
  });

  it("is deterministic for the same inputs", async () => {
    const deps = {
      resolveLogin: () => "octocat",
      fetchAvatarImpl: async () => null,
      displayName: () => "Ada Lovelace",
    };
    const once = await resolveUserIdentity(deps);
    const twice = await resolveUserIdentity(deps);
    assert.deepEqual(once, twice);
  });
});
