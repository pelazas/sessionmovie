/**
 * The three exports the /movie skill path rides on (sessionmovie prompt +
 * --screenplay). Fixtures are the contract: real transcripts in fixtures/raw.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseTranscript } from "../parser/index.js";
import { structuralDecline } from "./heuristic.js";
import { buildScreenwriterPrompt, validateScreenwriterJson } from "./llm.js";

const fixture = (name: string) =>
  parseTranscript(
    readFileSync(join(import.meta.dirname, "..", "..", "fixtures", "raw", name), "utf8"),
  );

test("structuralDecline: null for a session with footage", () => {
  assert.equal(structuralDecline(fixture("feature-build-remotion.jsonl")), null);
});

test("structuralDecline: declines a session with no user prompt", () => {
  const declined = structuralDecline(fixture("code-review-bash-heavy.jsonl"));
  assert.ok(declined);
  assert.match(declined.reason, /no user prompt/);
});

test("buildScreenwriterPrompt: fully interpolated, duration override lands", () => {
  const prompt = buildScreenwriterPrompt(fixture("feature-build-remotion.jsonl"), 57);
  assert.ok(!prompt.includes("{{"), "no template placeholders may survive");
  assert.match(prompt, /\b57\b/);
  assert.ok(prompt.length > 1000, "digest must be embedded");
});

test("validateScreenwriterJson: decline passes through", () => {
  const out = validateScreenwriterJson('{"decline": true, "reason": "too boring"}');
  assert.deepEqual(out, { decline: true, reason: "too boring" });
});

test("validateScreenwriterJson: non-JSON yields issues", () => {
  const out = validateScreenwriterJson("not json at all");
  assert.ok("issues" in out);
  assert.match(out.issues, /not valid JSON/);
});

test("validateScreenwriterJson: invalid screenplay yields per-path issues", () => {
  const out = validateScreenwriterJson('{"version": 1}');
  assert.ok("issues" in out);
  assert.match(out.issues, /- at /);
});
