/**
 * CI-safe tests for renderer-side voiceover↔dialogue sync math: the per-line
 * scene-local track, and the dialogue lead-in schedule the no-VO fallback
 * still uses. Pure functions, no network, no DOM, no Remotion runtime.
 *
 * (This file stays here because sceneLocalTrack and dialogueLeadSchedule
 * depend on remotion/src/timing.ts, which the CLI (src/) must never import;
 * wordsFromAlignment/VO_* constants live in src/voiceover/sync-core.ts and
 * are tested there — src/voiceover/sync-core.test.ts.)
 *
 * Run: node --import tsx --test remotion/src/packs/voiceoverSync.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { VoiceoverLineCue, WordTiming } from "../../../src/voiceover/types";
import { sceneLocalTrack } from "./voiceoverSync";
import { CAPTION_RELEASE_END, DIALOGUE_LEAD_RELEASE, dialogueLeadSchedule } from "../timing";

const FPS = 30;

const lineCue = (
  sceneIndex: number,
  lineIndex: number,
  durationSec: number,
  words: WordTiming[] = [],
): VoiceoverLineCue => ({
  sceneIndex, lineIndex, speaker: lineIndex % 2 === 0 ? "user" : "claude",
  text: `line ${lineIndex}`, file: `voiceover-cache/${sceneIndex}-${lineIndex}.mp3`,
  durationSec, timestampsFile: `voiceover-cache/${sceneIndex}-${lineIndex}.timestamps.json`,
  words,
});

describe("sceneLocalTrack", () => {
  it("lays lines end-to-end from a 0.75s lead with 0.35s gaps", () => {
    const cues = [lineCue(0, 0, 2), lineCue(0, 1, 1.5)];
    const track = sceneLocalTrack(cues, 0, FPS);
    assert.equal(track.length, 2);
    // lead 0.75s @30fps = 23 frames (round)
    assert.equal(track[0]?.startFrame, 23);
    assert.equal(track[0]?.endFrame, 23 + Math.round(2 * FPS));
    // gap 0.35s @30fps = 11 frames (round)
    assert.equal(track[1]?.startFrame, track[0]!.endFrame + 11);
    assert.equal(track[1]?.endFrame, track[1]!.startFrame + Math.round(1.5 * FPS));
  });

  it("filters to the requested scene and sorts by lineIndex regardless of input order", () => {
    const cues = [lineCue(1, 1, 1), lineCue(0, 0, 1), lineCue(1, 0, 1)];
    const track = sceneLocalTrack(cues, 1, FPS);
    assert.deepEqual(track.map((t) => t.lineIndex), [0, 1]);
  });

  it("offsets word timings from the line's own startFrame", () => {
    const cues = [
      lineCue(0, 0, 2, [
        { word: "hi", startSec: 0, endSec: 0.5 },
        { word: "you", startSec: 0.6, endSec: 1.9 },
      ]),
    ];
    const track = sceneLocalTrack(cues, 0, FPS);
    const line = track[0]!;
    assert.deepEqual(line.words[0], { text: "hi", startFrame: line.startFrame, endFrame: line.startFrame + 15 });
    assert.deepEqual(line.words[1], { text: "you", startFrame: line.startFrame + 18, endFrame: line.startFrame + 57 });
  });

  it("an empty scene (no matching cues) is an empty track", () => {
    assert.deepEqual(sceneLocalTrack([lineCue(1, 0, 1)], 0, FPS), []);
  });
});

describe("dialogueLeadSchedule (the no-VO fallback's underlying math)", () => {
  const lines = { type: "dialogue" as const, lines: [
    { speaker: "claude" as const, text: "a", emotion: "neutral" as const },
    { speaker: "user" as const, text: "b", emotion: "neutral" as const },
  ], targetSec: 10 };

  it("no cue: bubbles start immediately, caption beat at 70% (closing beat)", () => {
    const s = dialogueLeadSchedule(lines, 300, null);
    assert.equal(s.leadInEnd, 0);
    assert.equal(s.lineStart(0), 10);
    assert.equal(s.usable, 210);
  });

  it("with a cue: bubble train waits for full caption release after narration", () => {
    const s = dialogueLeadSchedule(lines, 300, 138);
    assert.equal(s.leadInEnd, 138 + DIALOGUE_LEAD_RELEASE);
    assert.equal(s.lineStart(0), s.leadInEnd + 10);
  });

  it("an over-long cue clamps the lead-in to 60% — bubbles always render", () => {
    // fit-gate-illegal cue fed by hand: end at frame 289 of 300
    const s = dialogueLeadSchedule(lines, 300, 289);
    assert.equal(s.leadInEnd, 180);
    assert.ok(s.lineStart(1) < 300 - 12, "last bubble fully pops inside the scene");
  });

  it("release gap derives from the caption release constant", () => {
    assert.equal(DIALOGUE_LEAD_RELEASE, CAPTION_RELEASE_END + 4);
  });
});
