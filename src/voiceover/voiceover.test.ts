/**
 * CI-safe voiceover tests: cache key + fit rule + manifest assembly with
 * mocks. No network, no API key, no ffprobe — the real-API path is manual
 * acceptance only (CI has neither key nor network).
 *
 * Run: node --import tsx --test src/voiceover/voiceover.test.ts
 * (proposed for the npm test glob — package.json is outside this branch's lane)
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { cacheKey } from "./cache.js";
import { availableSecFor, buildVoiceoverManifest, cueFits, FIT_RATIO } from "./manifest.js";
import type { Screenplay } from "../screenplay/schema.js";
import type { TTSConfig } from "./tts.js";

const SETTINGS = { stability: 0.5, similarity_boost: 0.75 };
const CONFIG: TTSConfig = {
  apiKey: "test-key-never-real",
  voiceId: "voice-a",
  model: "model-a",
  settings: SETTINGS,
};

test("cacheKey is stable for identical inputs", () => {
  assert.equal(
    cacheKey("hello", "v1", "m1", SETTINGS),
    cacheKey("hello", "v1", "m1", SETTINGS),
  );
});

test("cacheKey changes when any component changes", () => {
  const base = cacheKey("hello", "v1", "m1", SETTINGS);
  assert.notEqual(cacheKey("hello!", "v1", "m1", SETTINGS), base);
  assert.notEqual(cacheKey("hello", "v2", "m1", SETTINGS), base);
  assert.notEqual(cacheKey("hello", "v1", "m2", SETTINGS), base);
  assert.notEqual(cacheKey("hello", "v1", "m1", { ...SETTINGS, stability: 0.6 }), base);
});

test("cacheKey delimits fields (no concatenation collisions)", () => {
  assert.notEqual(cacheKey("ab", "c", "m", {}), cacheKey("a", "bc", "m", {}));
});

test("fit rule: cue fits at exactly availableSec * ratio, not above", () => {
  assert.equal(cueFits(9, 10), true); // 9 ≤ 10 × 0.9 of the post-caption window
  assert.equal(cueFits(9.01, 10), false);
});

test("availableSecFor: dialogue captions appear at ~70% — the window is the remainder", () => {
  // dialogue targetSec 10 → 300 frames, captionIn = usable = 210 → 3s window
  const scene = screenplayWith(["x"], 10).scenes[0]!;
  assert.equal(Math.round(availableSecFor(scene) * 100) / 100, 3);
});

test("fit rule ratio is the documented 0.9", () => {
  assert.equal(FIT_RATIO, 0.9);
});

function screenplayWith(captions: Array<string | undefined>, targetSec = 10): Screenplay {
  return {
    version: 1,
    sessionMeta: {},
    targetDurationSec: 50,
    scenes: captions.map((caption, i) => ({
      type: "dialogue" as const,
      lines: [{ speaker: "claude" as const, text: `line ${i}`, emotion: "neutral" as const }],
      targetSec,
      ...(caption !== undefined && { caption }),
    })),
  };
}

test("manifest: captionless scenes get no cue; fit-rule overflow is skipped with a warning", async () => {
  const warnings: string[] = [];
  const { manifest, apiCalls, cacheHits, skipped } = await buildVoiceoverManifest(
    screenplayWith(["short caption", undefined, "way too long caption"]),
    CONFIG,
    {
      log: (m) => warnings.push(m),
      synthesizeCue: async (text) => ({
        absolutePath: `/tmp/${text.length}.mp3`,
        publicPath: `voiceover-cache/${text.length}.mp3`,
        apiCalled: true,
      }),
      // dialogue targetSec 10 → caption at 70% → 3s window × 0.9 = 2.7s limit:
      // first caption 2s (fits), third 12s (skipped)
      probe: (path) => (path.includes("13") ? 2 : 12),
    },
  );
  assert.equal(manifest.cues.length, 1);
  assert.equal(manifest.cues[0]?.sceneIndex, 0);
  assert.equal(manifest.cues[0]?.durationSec, 2);
  assert.equal(apiCalls, 2);
  assert.equal(cacheHits, 0);
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0]?.sceneIndex, 2);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0] ?? "", /fit|after its caption|skipping/i);
});

test("manifest: cache hits are counted, not re-synthesized", async () => {
  const { apiCalls, cacheHits } = await buildVoiceoverManifest(
    screenplayWith(["cached caption"]),
    CONFIG,
    {
      synthesizeCue: async () => ({
        absolutePath: "/tmp/x.mp3",
        publicPath: "voiceover-cache/x.mp3",
        apiCalled: false,
      }),
      probe: () => 2,
    },
  );
  assert.equal(apiCalls, 0);
  assert.equal(cacheHits, 1);
});
