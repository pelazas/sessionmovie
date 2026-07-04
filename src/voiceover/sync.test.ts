/**
 * CI-safe tests for voiceover↔caption sync math: alignment→word grouping,
 * scene-local cue resolution, and the caption render state (context fallback).
 * Pure functions, no network, no DOM, no Remotion runtime.
 *
 * Run: node --import tsx --test src/voiceover/sync.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Screenplay } from "../screenplay/schema.js";
import type { SceneVoiceoverCue, VoiceoverCue } from "./types.js";
import {
  captionRenderState,
  sceneLocalCue,
  wordsFromAlignment,
} from "../../remotion/src/packs/voiceoverSync.js";
import {
  CAPTION_RELEASE_END,
  DIALOGUE_LEAD_RELEASE,
  dialogueLeadSchedule,
} from "../../remotion/src/timing.js";

const tenth = (i: number) => Math.round(i * 100) / 1000; // exact 0.1 steps, no FP drift
const alignmentFor = (text: string) => ({
  characters: [...text],
  character_start_times_seconds: [...text].map((_c, i) => tenth(i)),
  character_end_times_seconds: [...text].map((_c, i) => tenth(i + 1)),
});

describe("wordsFromAlignment", () => {
  it("groups characters into words on whitespace, timing from first/last char", () => {
    const words = wordsFromAlignment(alignmentFor("hi you"));
    assert.deepEqual(words, [
      { word: "hi", startSec: 0, endSec: 0.2 },
      { word: "you", startSec: 0.3, endSec: 0.6 },
    ]);
  });

  it("keeps punctuation attached and survives double spaces", () => {
    const words = wordsFromAlignment(alignmentFor("go,  now!"));
    assert.equal(words.length, 2);
    assert.equal(words[0]?.word, "go,");
    assert.equal(words[1]?.word, "now!");
  });

  it("returns [] for null or empty alignment", () => {
    assert.deepEqual(wordsFromAlignment(null), []);
    assert.deepEqual(wordsFromAlignment(alignmentFor("")), []);
  });
});

/** A dialogue scene: captionIn = 6 — the lead-in beat (timing.ts, text economy). */
const dialogueScene = (targetSec: number): Screenplay["scenes"][number] => ({
  type: "dialogue",
  lines: [{ speaker: "claude", text: "line", emotion: "neutral" }],
  targetSec,
});

const cueWith = (durationSec: number, words: VoiceoverCue["words"]): VoiceoverCue => ({
  sceneIndex: 0,
  file: "voiceover-cache/x.mp3",
  durationSec,
  text: words.map((w) => w.word).join(" "),
  timestampsFile: "/tmp/x.timestamps.json",
  words,
});

describe("sceneLocalCue", () => {
  it("starts at the scene's caption-in frame; words offset from there", () => {
    // dialogue 10s @30fps → 300 frames, captionIn = 6 (lead-in, text economy)
    const cue = cueWith(2, [
      { word: "hi", startSec: 0, endSec: 0.5 },
      { word: "you", startSec: 0.6, endSec: 1.9 },
    ]);
    const local = sceneLocalCue(cue, dialogueScene(10), 30);
    assert.equal(local.startFrame, 6);
    assert.equal(local.endFrame, 66);
    assert.deepEqual(local.words[0], { text: "hi", startFrame: 6, endFrame: 21 });
    assert.deepEqual(local.words[1], { text: "you", startFrame: 24, endFrame: 63 });
  });

  it("clamps the start so the cue still finishes inside the scene (mirrors ClassicAudio)", () => {
    // 9.9s cue in a 10s scene: latest fit = 300 − 297 = 3, earlier than captionIn 6.
    const cue = cueWith(9.9, [{ word: "long", startSec: 0, endSec: 9.9 }]);
    const local = sceneLocalCue(cue, dialogueScene(10), 30);
    assert.equal(local.startFrame, 300 - Math.round(9.9 * 30)); // latest fit, not 6
    assert.ok(local.endFrame <= 300); // the cue always finishes inside its scene
  });
});

describe("captionRenderState", () => {
  const cue: SceneVoiceoverCue = {
    startFrame: 100,
    endFrame: 160,
    words: [
      { text: "hi", startFrame: 100, endFrame: 120 },
      { text: "you", startFrame: 130, endFrame: 158 },
    ],
  };

  it("without a cue: schedule-driven passthrough (graceful degradation)", () => {
    const state = captionRenderState(null, 42, 0.37);
    assert.equal(state.mode, "schedule");
    assert.equal(state.opacity, 0.37);
  });

  it("with a cue: hidden before start, on at cue start, fades in fast", () => {
    assert.equal(captionRenderState(cue, 99, 1).opacity, 0);
    assert.ok(captionRenderState(cue, 104, 0).opacity > 0.4); // ignores fallback opacity
    assert.equal(captionRenderState(cue, 130, 0).opacity, 1);
  });

  it("word highlight progresses with the timestamps", () => {
    const spokenAt = (frame: number) =>
      captionRenderState(cue, frame, 1).words?.filter((w) => w.spoken).length;
    assert.equal(spokenAt(99), 0);
    assert.equal(spokenAt(105), 1);
    assert.equal(spokenAt(140), 2);
  });

  it("releases within ~15 frames of narration end", () => {
    assert.equal(captionRenderState(cue, 160, 1).opacity, 1);
    const releasing = captionRenderState(cue, 170, 1).opacity;
    assert.ok(releasing > 0 && releasing < 1);
    assert.equal(captionRenderState(cue, 176, 1).opacity, 0);
  });
});

describe("dialogueLeadSchedule (one voice at a time)", () => {
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
