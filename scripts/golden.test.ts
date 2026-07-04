/**
 * Golden tests: every fixture must parse (never crash) and produce exactly
 * the snapshot in fixtures/golden/. Run via `npm test`.
 * Regenerate intentionally with `npx tsx scripts/update-golden.ts`.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { snapshotFixture, type GoldenSnapshot } from "./golden.js";

const RAW_DIR = join(import.meta.dirname, "..", "fixtures", "raw");
const GOLDEN_DIR = join(import.meta.dirname, "..", "fixtures", "golden");

const fixtures = readdirSync(RAW_DIR)
  .filter((n) => n.endsWith(".jsonl"))
  .sort();

// 8 after review removed two content-sensitive fixtures (see PR #3 review);
// TODO grow back toward 10+ with genuinely diverse archetypes — a long
// debugging slog and a big refactor are still missing from the corpus.
test("fixture corpus is non-trivial", () => {
  assert.ok(fixtures.length >= 8, `expected ≥8 fixtures, found ${fixtures.length}`);
});

for (const name of fixtures) {
  const slug = name.replace(/\.jsonl$/, "");
  test(`golden: ${slug}`, () => {
    const actual = snapshotFixture(join(RAW_DIR, name), name);
    const expected = JSON.parse(
      readFileSync(join(GOLDEN_DIR, `${slug}.json`), "utf8"),
    ) as GoldenSnapshot;
    assert.deepEqual(actual, expected);
  });
}

test("Q&A-only session declines — never render a bad movie", () => {
  const snapshot = snapshotFixture(
    join(RAW_DIR, "qa-only-notion-access.jsonl"),
    "qa-only-notion-access.jsonl",
  );
  assert.equal(snapshot.result.kind, "decline");
});

test("aborted session declines", () => {
  const snapshot = snapshotFixture(join(RAW_DIR, "aborted-login.jsonl"), "aborted-login.jsonl");
  assert.equal(snapshot.result.kind, "decline");
});

test("star fixture produces a full screenplay", () => {
  const snapshot = snapshotFixture(join(RAW_DIR, "star.jsonl"), "star.jsonl");
  assert.equal(snapshot.result.kind, "screenplay");
});
