/**
 * Beat quantizer — CLI-side and PURE (no remotion imports, no I/O):
 * nudges scene durations so every scene cut lands on the music's beat grid.
 *
 * The renderer cuts scenes at cumulative whole frames
 * (remotion/src/timing.ts sceneFrames), and pack audio starts playback on
 * the track's first beat, so beat k sounds at movie time beats[k] - beats[0].
 * This module moves each cut onto the frame nearest such a beat, subject to:
 *
 *   - each scene's targetSec changes by at most ±0.4s,
 *   - each cut drifts at most ±0.4s from its original position (this also
 *     bounds the last scene's change, which absorbs the final drift so the
 *     movie's total duration is preserved exactly),
 *   - no scene shrinks below one frame.
 *
 * A cut already within half a frame of a beat is left untouched, which makes
 * the function a no-op on aligned input and idempotent. Deterministic:
 * plain arithmetic on the inputs, first-most beat wins exact ties.
 */
import type { Screenplay } from "./screenplay/schema.js";

/** Per-scene nudge budget (and per-cut drift budget), in seconds. */
export const MAX_NUDGE_SEC = 0.4;

/** Nearest value in a sorted grid; the earlier beat wins exact ties. */
function nearestBeat(sortedBeats: readonly number[], t: number): number {
  let lo = 0;
  let hi = sortedBeats.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((sortedBeats[mid] ?? 0) < t) lo = mid + 1;
    else hi = mid;
  }
  const above = sortedBeats[lo] ?? 0;
  const below = sortedBeats[lo - 1];
  return below !== undefined && t - below <= above - t ? below : above;
}

export function quantizeToBeats(
  screenplay: Screenplay,
  beats: readonly number[],
  fps: number,
): Screenplay {
  const firstBeat = beats[0];
  if (firstBeat === undefined || screenplay.scenes.length < 2) return screenplay;
  // Playback starts on the first beat (makePackAudio startFrom).
  const movieBeats = beats.map((b) => b - firstBeat);
  const targets = screenplay.scenes.map((s) => s.targetSec);
  const total = targets.reduce((a, b) => a + b, 0);
  const minScene = 1 / fps;

  const adjusted = [...targets];
  let changed = false;
  let cumFrames = 0; // renderer frames up to the previous cut (adjusted)
  let cumSec = 0; // Σ adjusted targetSec up to the previous cut
  let origCutSec = 0; // Σ original targetSec up to this cut
  for (let i = 0; i < targets.length - 1; i++) {
    const orig = targets[i] ?? 0;
    origCutSec += orig;
    const keepFrames = Math.max(1, Math.round(orig * fps));
    const idealCutFrames = cumFrames + keepFrames;
    const beat = nearestBeat(movieBeats, idealCutFrames / fps);
    const beatFrames = Math.round(beat * fps);
    const newTarget = (beatFrames - cumFrames) / fps;
    const scenesAfterCut = targets.length - 1 - i;
    if (
      beatFrames !== idealCutFrames && // already on the beat → leave untouched
      Math.abs(newTarget - orig) <= MAX_NUDGE_SEC &&
      Math.abs(beatFrames / fps - origCutSec) <= MAX_NUDGE_SEC &&
      newTarget >= minScene &&
      total - beatFrames / fps >= scenesAfterCut * minScene
    ) {
      adjusted[i] = newTarget;
      changed = true;
      cumFrames = beatFrames;
    } else {
      cumFrames = idealCutFrames;
    }
    cumSec += adjusted[i] ?? 0;
  }
  if (!changed) return screenplay;

  // The last scene absorbs the drift, so the schema's ±10% total-duration
  // tolerance is untouched. If absorption would squeeze it below the floor
  // (possible when a later cut was skipped after an earlier nudge), abort:
  // quantize-or-nothing keeps the valid-in → valid-out contract.
  const lastTarget = total - cumSec;
  if (lastTarget < minScene) return screenplay;
  adjusted[targets.length - 1] = lastTarget;

  return {
    ...screenplay,
    scenes: screenplay.scenes.map((scene, i) => {
      const targetSec = adjusted[i] ?? scene.targetSec;
      return targetSec === scene.targetSec ? scene : { ...scene, targetSec };
    }),
  };
}
