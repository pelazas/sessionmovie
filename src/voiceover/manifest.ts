/**
 * Screenplay → voiceover manifest: one narration cue per captioned scene.
 *
 * Prototype tier (docs/audio.md build order step 1): narrate the scene
 * CAPTIONS — already redacted upstream (redaction runs in the parser, at the
 * door) and already written in the narrator's deadpan voice. No schema
 * changes: the manifest travels as a renderer-side sidecar in the
 * composition input props, never inside the frozen IR.
 *
 * All API calls happen here, pre-render — never inside compositions
 * (docs/audio.md hard rule; keeps renders deterministic and Lambda-viable).
 */
import { spawnSync } from "node:child_process";
import type { Screenplay } from "../screenplay/schema.js";
import { remotionDir } from "../cli/workspace.js";
import { getOrSynthesize } from "./cache.js";
import type { TTSConfig } from "./tts.js";

import type { VoiceoverCue, VoiceoverManifest } from "./types.js";
export type { VoiceoverCue, VoiceoverManifest } from "./types.js";

export interface ManifestStats {
  manifest: VoiceoverManifest;
  apiCalls: number;
  cacheHits: number;
  skipped: Array<{ sceneIndex: number; reason: string }>;
}

/**
 * FIT RULE (binding, docs/audio.md): narration must fit its scene, not
 * stretch it. A cue longer than targetSec * 0.9 is skipped with a warning —
 * scene durations never grow to fit audio.
 */
export const FIT_RATIO = 0.9;
export function cueFits(durationSec: number, targetSec: number): boolean {
  return durationSec <= targetSec * FIT_RATIO;
}

/** Measure audio duration with Remotion's bundled ffprobe (no new dependency). */
export function probeDurationSec(absolutePath: string): number {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const run = spawnSync(npx, ["remotion", "ffprobe", absolutePath], {
    cwd: remotionDir,
    encoding: "utf8",
    timeout: 60_000,
  });
  // ffprobe prints metadata to stderr; be liberal about which stream has it.
  const output = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
  const match = output.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (run.error || !match) {
    throw new Error(
      `ffprobe could not measure ${absolutePath}: ${run.error ?? output.slice(-300)}`,
    );
  }
  const [, h, m, s] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

export interface BuildManifestOptions {
  refresh?: boolean;
  log?: (message: string) => void;
  /** Injectable for tests — defaults to the real cache+API path. */
  synthesizeCue?: typeof getOrSynthesize;
  probe?: typeof probeDurationSec;
}

/** Build the manifest for a validated screenplay. Throws on API failure. */
export async function buildVoiceoverManifest(
  screenplay: Screenplay,
  config: TTSConfig,
  options: BuildManifestOptions = {},
): Promise<ManifestStats> {
  const log = options.log ?? ((m: string) => process.stderr.write(`${m}\n`));
  const synthesizeCue = options.synthesizeCue ?? getOrSynthesize;
  const probe = options.probe ?? probeDurationSec;

  const cues: VoiceoverCue[] = [];
  const skipped: ManifestStats["skipped"] = [];
  let apiCalls = 0;
  let cacheHits = 0;

  for (const [sceneIndex, scene] of screenplay.scenes.entries()) {
    const text = scene.caption?.trim();
    if (!text) continue;

    const refreshOption = options.refresh !== undefined ? { refresh: options.refresh } : {};
    const cached = await synthesizeCue(text, config, refreshOption);
    if (cached.apiCalled) apiCalls++;
    else cacheHits++;

    const durationSec = probe(cached.absolutePath);
    if (!cueFits(durationSec, scene.targetSec)) {
      const reason =
        `narration is ${durationSec.toFixed(1)}s but scene ${sceneIndex} (${scene.type}) ` +
        `allows ${(scene.targetSec * FIT_RATIO).toFixed(1)}s (targetSec ${scene.targetSec} × ${FIT_RATIO})`;
      log(`⚠️  voiceover: skipping cue — ${reason}`);
      skipped.push({ sceneIndex, reason });
      continue;
    }
    cues.push({ sceneIndex, file: cached.publicPath, durationSec });
  }

  return { manifest: { cues }, apiCalls, cacheHits, skipped };
}
