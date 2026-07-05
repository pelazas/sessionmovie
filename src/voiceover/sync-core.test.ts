/**
 * CI-safe tests for src/voiceover/sync-core.ts: alignment→word grouping.
 * Pure functions, no network, no DOM.
 *
 * (Split from the old sync.test.ts: the renderer-side half — sceneLocalCue,
 * captionRenderState, dialogueLeadSchedule — moved to
 * remotion/src/packs/voiceoverSync.test.ts, since those still depend on
 * remotion/src/timing.ts and this file must not.)
 *
 * Run: node --import tsx --test src/voiceover/sync-core.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { wordsFromAlignment } from "./sync-core.js";

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
