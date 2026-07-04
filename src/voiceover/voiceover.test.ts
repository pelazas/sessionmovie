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

test("availableSecFor: the caption follows the cue — the window is the scene minus the lead-in", () => {
  // non-dialogue targetSec 10 → 300 frames − 6 lead-in → 9.8s window
  const action = {
    type: "action" as const,
    events: [{ tool: "Bash", summary: "runs tests" }],
    intensity: "steady" as const,
    targetSec: 10,
  };
  assert.equal(Math.round(availableSecFor(action) * 100) / 100, 9.8);
});

test("availableSecFor: dialogue narration budget is half the window — bubbles keep the rest", () => {
  // dialogue targetSec 10 → 9.8s window × 0.5 share → 4.9s
  const scene = screenplayWith(["x"], 10).scenes[0]!;
  assert.equal(Math.round(availableSecFor(scene) * 100) / 100, 4.9);
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
        timestampsPath: `/tmp/${text.length}.timestamps.json`,
        timestampsPublicPath: "voiceover-cache/mock.timestamps.json",
        apiCalled: true,
      }),
      readAlignment: () => null,
      // dialogue targetSec 10 → 9.8s window × 0.5 dialogue share × 0.9 = 4.41s limit:
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
        timestampsPath: "voiceover-cache/mock.timestamps.json",
        timestampsPublicPath: "voiceover-cache/mock.timestamps.json",
        apiCalled: false,
      }),
      probe: () => 2,
      readAlignment: () => null,
    },
  );
  assert.equal(apiCalls, 0);
  assert.equal(cacheHits, 1);
});

test("manifest: cues carry text, sidecar path, and precomputed word timings", async () => {
  const { manifest } = await buildVoiceoverManifest(screenplayWith(["hi you"]), CONFIG, {
    synthesizeCue: async () => ({
      absolutePath: "/tmp/x.mp3",
      publicPath: "voiceover-cache/x.mp3",
      timestampsPath: "voiceover-cache/mock.timestamps.json",
        timestampsPublicPath: "voiceover-cache/mock.timestamps.json",
      apiCalled: false,
    }),
    probe: () => 1,
    readAlignment: () => ({
      characters: ["h", "i", " ", "y", "o", "u"],
      character_start_times_seconds: [0, 0.1, 0.2, 0.3, 0.4, 0.5],
      character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
    }),
  });
  const cue = manifest.cues[0];
  assert.equal(cue?.text, "hi you");
  assert.equal(cue?.timestampsFile, "voiceover-cache/mock.timestamps.json");
  assert.deepEqual(cue?.words, [
    { word: "hi", startSec: 0, endSec: 0.2 },
    { word: "you", startSec: 0.3, endSec: 0.6 },
  ]);
});

test("manifest: a corrupt/missing sidecar degrades to words: [] (no highlight)", async () => {
  const { manifest } = await buildVoiceoverManifest(screenplayWith(["hi"]), CONFIG, {
    synthesizeCue: async () => ({
      absolutePath: "/tmp/x.mp3",
      publicPath: "voiceover-cache/x.mp3",
      timestampsPath: "voiceover-cache/mock.timestamps.json",
        timestampsPublicPath: "voiceover-cache/mock.timestamps.json",
      apiCalled: false,
    }),
    probe: () => 1,
    readAlignment: () => null,
  });
  assert.deepEqual(manifest.cues[0]?.words, []);
});

test("voiceForGenre: map defaults, per-genre env override, global env wins", async () => {
  const { voiceForGenre, VOICE_BY_GENRE, QUEST_VOICE_ID } = await import("./manifest.js");
  assert.equal(voiceForGenre("classic", {}), VOICE_BY_GENRE.classic);
  assert.equal(voiceForGenre("quest", {}), QUEST_VOICE_ID);
  assert.equal(voiceForGenre("quest", { ELEVENLABS_VOICE_QUEST: "v-q" }), "v-q");
  assert.equal(voiceForGenre("nature-doc", { ELEVENLABS_VOICE_NATURE_DOC: "v-n" }), "v-n");
  assert.equal(
    voiceForGenre("quest", { ELEVENLABS_VOICE_QUEST: "v-q", ELEVENLABS_VOICE_ID: "v-all" }),
    "v-all",
  );
});

test("checkApiKey: 200 from GET /v1/voices means the key is valid", async () => {
  const { checkApiKey } = await import("./tts.js");
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const result = await checkApiKey("test-key-never-real", (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    calls.push({ url: String(url), init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch);
  assert.deepEqual(result, { ok: true });
  assert.equal(calls[0]?.url, "https://api.elevenlabs.io/v1/voices");
  const headers = calls[0]?.init?.headers as Record<string, string>;
  assert.equal(headers["xi-api-key"], "test-key-never-real");
  assert.ok(calls[0]?.init?.signal instanceof AbortSignal, "request must carry a timeout signal");
});

test("checkApiKey: 401/403 mean the key is rejected", async () => {
  const { checkApiKey } = await import("./tts.js");
  for (const status of [401, 403]) {
    const result = await checkApiKey("test-key-never-real", (async () =>
      new Response("{}", { status })) as typeof fetch);
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.kind, "invalid");
    assert.match((!result.ok && result.detail) || "", new RegExp(String(status)));
  }
});

test("checkApiKey: other HTTP errors are 'unavailable', not 'invalid'", async () => {
  const { checkApiKey } = await import("./tts.js");
  const result = await checkApiKey("test-key-never-real", (async () =>
    new Response("oops", { status: 500 })) as typeof fetch);
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.kind, "unavailable");
  assert.match((!result.ok && result.detail) || "", /500/);
});

test("checkApiKey: network failure is 'unavailable' and never leaks the key", async () => {
  const { checkApiKey } = await import("./tts.js");
  const key = "sk-super-secret-key";
  const result = await checkApiKey(key, (async () => {
    throw new Error(`connect failed sending ${key} to host`);
  }) as typeof fetch);
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.kind, "unavailable");
  const detail = (!result.ok && result.detail) || "";
  assert.ok(!detail.includes(key), "detail must never contain the API key");
  assert.match(detail, /connect failed/);
});

test("manifest: genre option swaps the synthesis voice; omitted keeps config", async () => {
  const voices: string[] = [];
  const mock = {
    synthesizeCue: async (_text: string, cfg: TTSConfig) => {
      voices.push(cfg.voiceId);
      return {
        absolutePath: "/tmp/x.mp3",
        publicPath: "voiceover-cache/x.mp3",
        timestampsPath: "voiceover-cache/mock.timestamps.json",
        timestampsPublicPath: "voiceover-cache/mock.timestamps.json",
        apiCalled: false,
      };
    },
    probe: () => 1,
    readAlignment: () => null,
  };
  await buildVoiceoverManifest(screenplayWith(["a"]), CONFIG, { ...mock, genre: "quest", env: {} });
  await buildVoiceoverManifest(screenplayWith(["a"]), CONFIG, mock);
  const { QUEST_VOICE_ID } = await import("./manifest.js");
  assert.deepEqual(voices, [QUEST_VOICE_ID, "voice-a"]);
});
