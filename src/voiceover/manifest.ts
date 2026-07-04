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
import { captionInFrame, sceneFrames } from "../../remotion/src/timing.js";
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
 * stretch it — and since cues start when their caption fades in
 * (remotion/src/timing.ts captionInFrame), the budget is the window from
 * caption-in to scene end, not the whole scene. A cue longer than
 * availableSec * 0.9 is skipped with a warning; scenes never grow.
 */
export const FIT_RATIO = 0.9;
export const FPS = 30; // mirrors the composition fps (remotion/src/Root.tsx)
export function cueFits(durationSec: number, availableSec: number): boolean {
  return durationSec <= availableSec * FIT_RATIO;
}
/** Seconds between a scene's caption appearing and the scene ending. */
export function availableSecFor(scene: Screenplay["scenes"][number]): number {
  const frames = sceneFrames(scene, FPS);
  const captionIn = Math.max(0, Math.min(captionInFrame(scene, frames), frames));
  return (frames - captionIn) / FPS;
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
    const availableSec = availableSecFor(scene);
    if (!cueFits(durationSec, availableSec)) {
      const reason =
        `narration is ${durationSec.toFixed(1)}s but scene ${sceneIndex} (${scene.type}) ` +
        `has ${(availableSec * FIT_RATIO).toFixed(1)}s after its caption appears (targetSec ${scene.targetSec})`;
      log(`⚠️  voiceover: skipping cue — ${reason}`);
      skipped.push({ sceneIndex, reason });
      continue;
    }
    cues.push({ sceneIndex, file: cached.publicPath, durationSec });
  }

  return { manifest: { cues }, apiCalls, cacheHits, skipped };
}
