/**
 * Voiceover↔caption sync math that the CLI needs — moved here (not copied)
 * from the renderer side so the CLI never imports a renderer module
 * (matches the screenplay-schema pattern: remotion imports from src/, never
 * the reverse). remotion/src/timing.ts and remotion/src/packs/voiceoverSync.ts
 * re-export these so renderer-side consumers keep working unchanged.
 *
 * Everything here is deterministic frame math / pure data transformation.
 * No node APIs, no zod, no remotion runtime.
 */
import type { Scene } from "../screenplay/schema.js";
import type { CharacterAlignment, WordTiming } from "./types.js";

export const sceneFrames = (scene: Scene, fps: number): number =>
  Math.max(1, Math.round(scene.targetSec * fps));

/** Narration pacing (docs/audio.md). Shared by the CLI resize and the renderer track. */
export const VO_LEAD_SEC = 0.75;
export const VO_TAIL_SEC = 0.75;
export const VO_GAP_SEC = 0.35;

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
