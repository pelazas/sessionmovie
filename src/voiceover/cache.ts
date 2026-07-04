/**
 * Content-addressed voiceover cache (docs/audio.md determinism mechanism).
 *
 * TTS output is nondeterministic per call; caching by content hash makes
 * re-renders deterministic in practice: same text + voice + model + settings
 * → same file, zero API calls. The cache lives under remotion/public/ because
 * Remotion's staticFile() can only serve from there. Generated audio is never
 * committed (.gitignore).
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { remotionDir } from "../cli/workspace.js";
import { synthesize, type TTSConfig } from "./tts.js";

/** Path under remotion/public/ — the only tree staticFile() can serve. */
export const CACHE_DIR_NAME = "voiceover-cache";
export const cacheDir = join(remotionDir, "public", CACHE_DIR_NAME);

/**
 * sha256(text + voiceId + model + settings). JSON array encoding keeps the
 * fields unambiguously delimited (no "ab"+"c" vs "a"+"bc" collisions).
 */
export function cacheKey(
  text: string,
  voiceId: string,
  model: string,
  settings: Record<string, unknown>,
): string {
  return createHash("sha256")
    .update(JSON.stringify([text, voiceId, model, settings]))
    .digest("hex");
}

export interface CacheResult {
  /** Absolute path to the cached mp3. */
  absolutePath: string;
  /** Path relative to remotion/public/ — what staticFile() takes. */
  publicPath: string;
  /** True when this call hit the network. */
  apiCalled: boolean;
}

/**
 * Return the cached mp3 for this utterance, synthesizing (and caching) it on
 * miss. `refresh` forces re-synthesis (--refresh-voices).
 */
export async function getOrSynthesize(
  text: string,
  config: TTSConfig,
  options: { refresh?: boolean } = {},
): Promise<CacheResult> {
  const key = cacheKey(text, config.voiceId, config.model, config.settings);
  const file = `${key}.mp3`;
  const absolutePath = join(cacheDir, file);
  const publicPath = `${CACHE_DIR_NAME}/${file}`;

  if (!options.refresh && existsSync(absolutePath)) {
    return { absolutePath, publicPath, apiCalled: false };
  }
  const bytes = await synthesize(text, config);
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(absolutePath, bytes);
  return { absolutePath, publicPath, apiCalled: true };
}
