/**
 * Session facts: builder, pricing lookup, tile picking, digest line, and the
 * sceneTimes producer — all against synthetic timelines (no fixtures, CI-safe).
 *
 * Run: node --import tsx --test src/facts/facts.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Timeline } from "../parser/types.js";
import type { Screenplay } from "../screenplay/schema.js";
import { buildSessionFacts, factsDigestLine, formatTokens, pickFactTiles } from "./facts.js";
import { pricingFor } from "./pricing.js";
import { formatClock, sceneTimesFor } from "./sceneTimes.js";

const baseTimeline = (): Timeline => ({
  sessionMeta: { startedAt: "2026-07-04T07:23:56.861Z", endedAt: "2026-07-04T09:10:00.000Z" },
  turns: [
    { userMessage: "fix the login", timestamp: "2026-07-04T07:23:56.861Z" },
    { userMessage: "now ship it", timestamp: "2026-07-04T08:40:00.000Z" },
  ],
  toolCalls: [
    { tool: "Bash", summary: "Bash: npm test", turnIndex: 0 },
    { tool: "Agent", summary: "Agent: review the diff", turnIndex: 1 },
    { tool: "Task", summary: "Task: find callers", turnIndex: 1 },
    { tool: "Task", summary: "Task: verify fix", turnIndex: 1 },
  ],
  diffs: [{ file: "src/auth.ts", added: 40, removed: 10, turnIndex: 0 }],
  commands: [
    { command: "npm test", exitCode: 1, turnIndex: 0 },
    { command: "npm test", exitCode: 0, turnIndex: 1 },
    { command: 'git commit -m "fix"', exitCode: 0, turnIndex: 1 },
    { command: 'git commit -m "polish"', exitCode: 0, turnIndex: 1 },
    { command: "git push origin main", exitCode: 0, turnIndex: 1 },
    { command: "gh pr create --fill", exitCode: 1, turnIndex: 1 }, // failed → not counted
  ],
  usage: { input: 100_000, output: 20_000, cacheRead: 800_000, cacheCreation: 100_000 },
  models: ["claude-fable-5"],
  rhythm: { activeSec: 3200, idleSec: 3160, longestPauseSec: 2400, peakToolCallsPerMinute: 12 },
  totals: {
    turns: 2,
    toolCalls: 4,
    filesTouched: 1,
    added: 40,
    removed: 10,
    commands: 6,
    failedCommands: 2,
    durationSec: 6360,
  },
});

describe("pricingFor", () => {
  it("matches date-suffixed ids by longest prefix and refuses unknown models", () => {
    assert.equal(pricingFor("claude-haiku-4-5-20251001")?.input, 1);
    assert.equal(pricingFor("claude-fable-5")?.output, 50);
    assert.equal(pricingFor("gpt-9-mega"), undefined);
  });
});

describe("buildSessionFacts", () => {
  it("computes tokens, cache ratio, cost, git activity, subagents, tests", () => {
    const facts = buildSessionFacts(baseTimeline());
    assert.deepEqual(facts.tokens, {
      input: 100_000,
      output: 20_000,
      cacheRead: 800_000,
      cacheCreation: 100_000,
    });
    assert.equal(facts.cacheRatio, 0.8);
    // fable-5: 0.1M×$10 + 0.02M×$50 + 0.8M×$1 + 0.1M×$12.5 = 1+1+0.8+1.25
    assert.equal(facts.estimatedCostUSD, 4.05);
    // cache saved: 0.8M × ($10 − $1)
    assert.equal(facts.cacheSavedUSD, 7.2);
    assert.equal(facts.subagents, 3);
    assert.deepEqual(facts.git, { commits: 2, pushes: 1, prsOpened: 0, prsMerged: 0 });
    assert.deepEqual(facts.tests, { runs: 2, failed: 1 });
    assert.equal(facts.costPerCommitUSD, 2.03);
  });

  it("gives no cost estimate for unknown or mixed models", () => {
    const unknown = { ...baseTimeline(), models: ["some-future-model"] };
    assert.equal(buildSessionFacts(unknown).estimatedCostUSD, undefined);
    const mixed = { ...baseTimeline(), models: ["claude-fable-5", "claude-haiku-4-5"] };
    assert.equal(buildSessionFacts(mixed).estimatedCostUSD, undefined);
  });

  it("handles a bare timeline (old transcript, no usage/timestamps) without inventing facts", () => {
    const t = baseTimeline();
    delete t.usage;
    delete t.models;
    delete t.rhythm;
    t.toolCalls = [];
    t.commands = [];
    const facts = buildSessionFacts(t);
    assert.deepEqual(facts, {});
  });
});

describe("pickFactTiles (deterministic interestingness)", () => {
  it("picks the top 3 in rule order", () => {
    const tiles = pickFactTiles(buildSessionFacts(baseTimeline()));
    assert.deepEqual(
      tiles.map((t) => t.label),
      ["API-equivalent spend (est.)", "saved by prompt cache (est.)", "subagents summoned"],
    );
    assert.equal(tiles[0]?.value, "≈$4.05");
  });

  it("falls back to total tokens when nothing clears a threshold", () => {
    const t = baseTimeline();
    delete t.models; // no cost
    t.toolCalls = [];
    t.rhythm = { activeSec: 100, idleSec: 0, longestPauseSec: 90, peakToolCallsPerMinute: 3 };
    const tiles = pickFactTiles(buildSessionFacts(t));
    assert.deepEqual(tiles, [{ label: "tokens", value: "1.0M" }]);
  });

  it("returns no tiles for a factless session (old transcript)", () => {
    const t = baseTimeline();
    delete t.usage;
    delete t.models;
    delete t.rhythm;
    t.toolCalls = [];
    t.commands = [];
    assert.deepEqual(pickFactTiles(buildSessionFacts(t)), []);
  });
});

describe("factsDigestLine", () => {
  it("is one compact line with only the available parts", () => {
    const line = factsDigestLine(buildSessionFacts(baseTimeline()));
    assert.ok(line.startsWith("facts: model: claude-fable-5 | tokens: 1.0M (80% cache reads)"));
    assert.ok(line.includes("≈$4.05"));
    assert.ok(line.includes("git: 2 commit(s), 1 push(es)"));
    assert.ok(line.includes("longest pause: 40m"));
  });

  it("is empty when there are no facts", () => {
    assert.equal(factsDigestLine({}), "");
  });
});

describe("sceneTimesFor", () => {
  const screenplay: Screenplay = {
    version: 2,
    sessionMeta: {},
    targetDurationSec: 50,
    scenes: [
      { type: "title", headline: "fix the login", task: "fix the login", targetSec: 5 },
      {
        type: "dialogue",
        lines: [{ speaker: "user", text: "broken again", emotion: "defeated" }],
        targetSec: 10,
      },
      {
        type: "action",
        artifact: { kind: "command", command: "npm test", exitCode: 1 },
        targetSec: 10,
      },
      {
        type: "showcase",
        artifact: { kind: "edit", file: "auth.ts", added: 40, removed: 10 },
        targetSec: 10,
      },
      {
        type: "stats",
        targetSec: 15,
      },
    ],
  };

  it("anchors title/stats to session bounds, matches showcase+action, skips dialogue", () => {
    const times = sceneTimesFor(screenplay, baseTimeline());
    assert.equal(times.length, 5);
    assert.equal(times[0], formatClock("2026-07-04T07:23:56.861Z")); // title = start
    assert.equal(times[1], null); // dialogue never chips
    assert.equal(times[2], formatClock("2026-07-04T07:23:56.861Z")); // command prefix match, turn 0
    assert.equal(times[3], formatClock("2026-07-04T07:23:56.861Z")); // diff basename match, turn 0
    assert.equal(times[4], formatClock("2026-07-04T09:10:00.000Z")); // stats = end
  });

  it("returns null rather than guessing when nothing matches", () => {
    const t = baseTimeline();
    t.diffs = [];
    t.commands = [];
    const times = sceneTimesFor(screenplay, t);
    assert.equal(times[2], null);
    assert.equal(times[3], null);
  });

  it("formatClock is HH:MM and rejects garbage", () => {
    assert.match(formatClock("2026-07-04T07:23:56.861Z") ?? "", /^\d{2}:\d{2}$/);
    assert.equal(formatClock("not a date"), null);
    assert.equal(formatClock(undefined), null);
  });
});

void formatTokens;
