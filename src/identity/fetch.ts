/**
 * Fetch + decode a user's public GitHub avatar — CLI-side only, pipeline
 * time (no network from Remotion compositions; docs/security-and-privacy.md
 * "GitHub identity carve-out"). Any failure (network, timeout, non-200,
 * undecodable bytes) resolves to null — this never throws.
 */
import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import type { Raster } from "./pixelate.js";

const AVATAR_URL = (login: string) => `https://github.com/${encodeURIComponent(login)}.png?size=460`;
const FETCH_TIMEOUT_MS = 5_000;

/**
 * GitHub serves JPEG bytes regardless of the `.png` extension in the URL, so
 * the format is sniffed from magic bytes rather than trusted from the URL
 * or any response header: JPEG starts `ff d8 ff`, PNG starts `89 50 4e 47`.
 */
export function sniffImageFormat(bytes: Uint8Array): "jpeg" | "png" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "png";
  }
  return null;
}

/** Fetch and decode a login's public GitHub avatar into RGBA, or null on any failure. */
export async function fetchAvatar(
  login: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Raster | null> {
  let bytes: Buffer;
  try {
    const response = await fetchImpl(AVATAR_URL(login), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    bytes = Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }

  try {
    const format = sniffImageFormat(bytes);
    if (format === "jpeg") {
      const decoded = jpeg.decode(bytes, { useTArray: true });
      return { width: decoded.width, height: decoded.height, data: decoded.data };
    }
    if (format === "png") {
      const decoded = PNG.sync.read(bytes);
      return { width: decoded.width, height: decoded.height, data: decoded.data };
    }
    return null;
  } catch {
    return null;
  }
}
