import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ScreenplaySchema, type Screenplay } from "./screenplay/schema.js";
import { quantizeToBeats } from "./quantize.js";

const FPS = 30;

/** A minimal valid screenplay whose scenes have the given targetSec values. */
function screenplayWith(targets: number[]): Screenplay {
  const total = targets.reduce((a, b) => a + b, 0);
  const screenplay = {
    version: 1 as const,
    sessionMeta: {},
    targetDurationSec: Math.min(60, Math.max(45, Math.round(total))),
    scenes: targets.map((targetSec, i) => ({
      type: "action" as const,
      events: [{ tool: "Bash", summary: `step ${i}` }],
      intensity: "steady" as const,
      targetSec,
    })),
  };
  // Fixtures must be valid input — the quantizer's contract starts there.
  return ScreenplaySchema.parse(screenplay);
}

/** Regular grid: beat every `step` seconds, first beat at `phase` (track time). */
function grid(phase: number, step: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => Number((phase + i * step).toFixed(3)));
}

/**
 * Movie-time cut positions the renderer will actually use: cumulative
 * per-scene rounded frames (remotion/src/timing.ts sceneFrames), in seconds.
 */
function cutTimes(screenplay: Screenplay, fps: number): number[] {
  const cuts: number[] = [];
  let frames = 0;
  for (const scene of screenplay.scenes.slice(0, -1)) {
    frames += Math.max(1, Math.round(scene.targetSec * fps));
    cuts.push(frames / fps);
  }
  return cuts;
}

/** Playback starts on beats[0], so beat k plays at movie time beats[k] - beats[0]. */
function nearestBeatDistance(t: number, beats: number[]): number {
  const first = beats[0] ?? 0;
  return Math.min(...beats.map((b) => Math.abs(b - first - t)));
}

describe("quantizeToBeats", () => {
  const HALF_FRAME = 0.5 / FPS + 1e-9;

  it("lands every scene cut on the nearest beat", () => {
    const input = screenplayWith([10.2, 9.7, 10.3, 10.1, 9.7]);
    const beats = grid(0.046, 0.5, 130); // 120 BPM, 65s of track
    const result = quantizeToBeats(input, beats, FPS);
    for (const cut of cutTimes(result, FPS)) {
      assert.ok(
        nearestBeatDistance(cut, beats) <= HALF_FRAME,
        `cut at ${cut}s is ${nearestBeatDistance(cut, beats)}s from the nearest beat`,
      );
    }
  });

  it("nudges each scene by at most 0.4s and keeps the total within schema tolerance", () => {
    const input = screenplayWith([10.2, 9.7, 10.3, 10.1, 9.7]);
    const beats = grid(0.046, 0.5, 130);
    const result = quantizeToBeats(input, beats, FPS);
    for (let i = 0; i < input.scenes.length; i++) {
      const delta = Math.abs((result.scenes[i]?.targetSec ?? 0) - (input.scenes[i]?.targetSec ?? 0));
      assert.ok(delta <= 0.4 + 1e-9, `scene ${i} nudged by ${delta}s`);
    }
    // Zod-validate the output — including the superRefine ±10% total check.
    const validated = ScreenplaySchema.safeParse(result);
    assert.ok(validated.success, JSON.stringify(validated.success ? [] : validated.error.issues));
    const sum = (s: Screenplay) => s.scenes.reduce((a, sc) => a + sc.targetSec, 0);
    assert.ok(Math.abs(sum(result) - sum(input)) <= 1e-6, "total duration drifted");
  });

  it("is a no-op when every cut already lands on a beat", () => {
    const input = screenplayWith([10, 10, 10, 10, 10]);
    const beats = grid(0.046, 0.5, 130); // movie-time beats at 0, 0.5, 1, …
    const result = quantizeToBeats(input, beats, FPS);
    assert.deepEqual(
      result.scenes.map((s) => s.targetSec),
      input.scenes.map((s) => s.targetSec),
    );
  });

  it("leaves a cut alone when no beat is within the 0.4s nudge budget", () => {
    const input = screenplayWith([10.2, 9.7, 10.3, 10.1, 9.7]);
    const sparse = grid(0, 3, 40); // movie-time beats every 3s: 9→1.2s away from 10.2
    const result = quantizeToBeats(input, sparse, FPS);
    assert.equal(result.scenes[0]?.targetSec, input.scenes[0]?.targetSec);
  });

  it("is deterministic and idempotent", () => {
    const input = screenplayWith([10.2, 9.7, 10.3, 10.1, 9.7]);
    const beats = grid(0.046, 0.5, 130);
    const once = quantizeToBeats(input, beats, FPS);
    const twice = quantizeToBeats(once, beats, FPS);
    assert.deepEqual(quantizeToBeats(input, beats, FPS), once);
    assert.deepEqual(
      twice.scenes.map((s) => s.targetSec),
      once.scenes.map((s) => s.targetSec),
    );
  });

  it("returns single-scene and empty-grid screenplays unchanged", () => {
    const single = screenplayWith([50]);
    assert.deepEqual(quantizeToBeats(single, grid(0, 0.5, 130), FPS), single);
    const input = screenplayWith([10.2, 9.7, 10.3, 10.1, 9.7]);
    assert.deepEqual(quantizeToBeats(input, [], FPS), input);
  });
});
