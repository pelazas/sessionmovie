/**
 * CI-safe voiceover tests: cache key + API key validation. No network, no
 * API key, no ffprobe — the real-API path is manual acceptance only (CI has
 * neither key nor network).
 *
 * (The old fit-rule/manifest/voiceForGenre tests moved with their
 * implementation to src/voiceover/pace.test.ts — PR-H, per-line dialogue
 * voiceover replaces the per-scene caption-narration manifest entirely.)
 *
 * Run: node --import tsx --test src/voiceover/voiceover.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { cacheKey } from "./cache.js";

const SETTINGS = { stability: 0.5, similarity_boost: 0.75 };

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
