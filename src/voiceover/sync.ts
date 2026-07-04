/**
 * Voiceover↔caption sync math — pure functions shared by the CLI (manifest
 * build) and the renderer (packs/Caption.tsx via PackComposition plumbing).
 *
 * Principle (binding): measured narration is reality; captions adapt to it;
 * scene durations adapt to neither — the fit rule in manifest.ts is unchanged.
 *
 * Everything here is deterministic frame math. No node APIs, no zod, no
 * remotion runtime — safe to import from compositions and node:test alike.
 */
import type { Scene } from "../../remotion/src/screenplay/index.js";
import { captionInFrame, sceneFrames } from "../../remotion/src/timing.js";
import type {
  CharacterAlignment,
  SceneVoiceoverCue,
  VoiceoverCue,
  WordTiming,
} from "./types.js";

/** Caption fade-in length once its cue starts (frames). */
export const CAPTION_IN_FRAMES = 8;
/** Caption holds this long after narration ends, then fades (frames). */
export const CAPTION_RELEASE_HOLD = 7;
/** Fully released this many frames after narration end (docs: ~15). */
export const CAPTION_RELEASE_END = 15;

/**
 * Group character-level alignment into word timings: a word spans its first
 * character's start to its last character's end; whitespace separates words.
 */
export function wordsFromAlignment(alignment: CharacterAlignment | null): WordTiming[] {
  if (!alignment) return [];
  const { characters, character_start_times_seconds: starts, character_end_times_seconds: ends } =
    alignment;
  const words: WordTiming[] = [];
  let word = "";
  let firstIndex = -1;
  const flush = (lastIndex: number) => {
    if (!word) return;
    words.push({
      word,
      startSec: starts[firstIndex] ?? 0,
      endSec: ends[lastIndex] ?? starts[firstIndex] ?? 0,
    });
    word = "";
    firstIndex = -1;
  };
  characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      flush(i - 1);
      return;
    }
    if (word === "") firstIndex = i;
    word += ch;
  });
  flush(characters.length - 1);
  return words;
}

/**
 * Resolve a manifest cue into SCENE-LOCAL frames. The start mirrors the audio
 * scheduling in ClassicAudio exactly (caption-in frame, clamped so the cue
 * still finishes inside its scene) — one drift here and lips and text part
 * ways. Precomputed once per scene; per-frame work is a lookup.
 */
export function sceneLocalCue(cue: VoiceoverCue, scene: Scene, fps: number): SceneVoiceoverCue {
  const frames = sceneFrames(scene, fps);
  const cueFrames = Math.round(cue.durationSec * fps);
  const latestFit = Math.max(0, frames - cueFrames);
  const startFrame = Math.max(0, Math.min(Math.round(captionInFrame(scene, frames)), latestFit));
  return {
    startFrame,
    endFrame: startFrame + cueFrames,
    words: cue.words.map((w) => ({
      text: w.word,
      startFrame: startFrame + Math.round(w.startSec * fps),
      endFrame: startFrame + Math.round(w.endSec * fps),
    })),
  };
}

export interface CaptionRenderState {
  /** "sync" = narration-driven; "schedule" = today's opacity passthrough. */
  mode: "sync" | "schedule";
  opacity: number;
  /** Present in sync mode: the caption's words with per-frame spoken flags. */
  words?: Array<{ text: string; spoken: boolean }>;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * The caption's state at a scene-local frame. With a cue: appear at cue
 * start, highlight word-by-word from the measured timestamps, release within
 * ~15 frames of narration end. Without: exactly the schedule-driven opacity
 * the scene component computed (graceful degradation).
 */
export function captionRenderState(
  cue: SceneVoiceoverCue | null,
  frame: number,
  scheduleOpacity: number,
): CaptionRenderState {
  if (!cue) return { mode: "schedule", opacity: scheduleOpacity };

  const fadeIn = clamp01((frame - cue.startFrame) / CAPTION_IN_FRAMES);
  const fadeOut =
    1 -
    clamp01(
      (frame - (cue.endFrame + CAPTION_RELEASE_HOLD)) /
        (CAPTION_RELEASE_END - CAPTION_RELEASE_HOLD),
    );
  return {
    mode: "sync",
    opacity: Math.min(fadeIn, fadeOut),
    words: cue.words.map((w) => ({ text: w.text, spoken: frame >= w.startFrame })),
  };
}
