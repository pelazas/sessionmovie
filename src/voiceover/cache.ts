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
import { synthesizeWithTimestamps, type TTSConfig } from "./tts.js";

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
  /** Absolute path to the character-timestamps sidecar (same key, .timestamps.json). */
  timestampsPath: string;
  /** Path relative to remotion/public/ — safe to serialize into props. */
  timestampsPublicPath: string;
  /** True when this call hit the network. */
  apiCalled: boolean;
}

/**
 * Return the cached mp3 + timestamps sidecar for this utterance, synthesizing
 * (and caching both) on miss. The sidecar shares the mp3's content-addressed
 * key, so audio and its timing can never drift apart. A pre-sidecar cache
 * entry (mp3 only, from the non-timestamped endpoint era) counts as a miss —
 * one re-synthesis upgrades it. `refresh` forces re-synthesis (--refresh-voices).
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
  const timestampsPath = join(cacheDir, `${key}.timestamps.json`);
  const timestampsPublicPath = `${CACHE_DIR_NAME}/${key}.timestamps.json`;

  if (!options.refresh && existsSync(absolutePath) && existsSync(timestampsPath)) {
    return { absolutePath, publicPath, timestampsPath, timestampsPublicPath, apiCalled: false };
  }
  const { audio, alignment } = await synthesizeWithTimestamps(text, config);
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(absolutePath, audio);
  // Only persist a real alignment: a `null` sidecar would read as a permanent
  // cache hit with no highlight, unrecoverable without --refresh-voices.
  if (alignment != null) {
    writeFileSync(timestampsPath, `${JSON.stringify(alignment)}\n`);
  }
  return { absolutePath, publicPath, timestampsPath, timestampsPublicPath, apiCalled: true };
}
