/**
 * Session facts: builder, pricing lookup, digest line, stat cards/title meta,
 * and the sceneTimes producer — all against synthetic timelines (no
 * fixtures, CI-safe).
 *
 * Run: node --import tsx --test src/facts/facts.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Timeline } from "../parser/types.js";
import type { Screenplay } from "../screenplay/schema.js";
import {
  buildSessionFacts,
  compressionLine,
  factsDigestLine,
  formatTokens,
  pickStatCards,
  titleMetaFor,
} from "./facts.js";
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
  createdFiles: [],
  usage: { input: 100_000, output: 20_000, cacheRead: 800_000, cacheCreation: 100_000 },
  models: ["claude-fable-5"],
  rhythm: { activeSec: 3200, idleSec: 3160, longestPauseSec: 2400, peakToolCallsPerMinute: 12 },
  totals: {
    turns: 2,
    assistantTurns: 2,
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

  it("create artifact anchors to its first file, basename-matched like edit", () => {
    const createScreenplay: Screenplay = {
      ...screenplay,
      scenes: [
        {
          type: "action",
          artifact: { kind: "create", files: ["src/auth.ts", "src/other.ts"] },
          targetSec: 10,
        },
        {
          type: "action",
          artifact: { kind: "subagents", tasks: ["look into it"] },
          targetSec: 10,
        },
      ],
    };
    const times = sceneTimesFor(createScreenplay, baseTimeline());
    assert.equal(times[0], formatClock("2026-07-04T07:23:56.861Z")); // first file (auth.ts) basename match
    assert.equal(times[1], null); // subagents: no single timeline entry to anchor to
  });

  it("formatClock is HH:MM and rejects garbage", () => {
    assert.match(formatClock("2026-07-04T07:23:56.861Z") ?? "", /^\d{2}:\d{2}$/);
    assert.equal(formatClock("not a date"), null);
    assert.equal(formatClock(undefined), null);
  });
});

describe("pickStatCards", () => {
  it("fixed priority order, first 6 — the two universal cards fall off", () => {
    const cards = pickStatCards(baseTimeline());
    assert.deepEqual(
      cards.map((c) => c.id),
      ["lines", "files", "tests", "errors", "subagents", "commits"],
    );
    // Display contract: value is a compact figure, label carries the words —
    // a card should never repeat itself ("10" + "files touched", not
    // "10 files" + "files touched").
    assert.equal(cards[0]?.value, "+40 / −10");
    assert.equal(cards[0]?.accent, undefined);
    assert.equal(cards[1]?.value, "1");
    assert.equal(cards[2]?.value, "2 · 1 green");
    assert.equal(cards[2]?.accent, "ok"); // last test run (the second "npm test") exited 0
    assert.equal(cards[3]?.value, "2");
    assert.equal(cards[3]?.accent, undefined); // last command overall (gh pr create) did not exit 0
    assert.equal(cards[4]?.value, "3");
    assert.equal(cards[5]?.value, "2");
  });

  it("raising max lets the universal cards (tool calls, turns) back in", () => {
    const cards = pickStatCards(baseTimeline(), 8);
    assert.deepEqual(
      cards.map((c) => c.id),
      ["lines", "files", "tests", "errors", "subagents", "commits", "toolCalls", "turns"],
    );
    assert.equal(cards[6]?.value, "4");
    assert.equal(cards[7]?.value, "4"); // 2 user turns + 2 assistant turns
  });

  it("skips every conditional card for a bare timeline; the two universal ones always show", () => {
    const t = baseTimeline();
    t.diffs = [];
    t.commands = [];
    t.toolCalls = [];
    t.totals = { ...t.totals, added: 0, removed: 0, filesTouched: 0, failedCommands: 0, toolCalls: 0 };
    const cards = pickStatCards(t);
    assert.deepEqual(
      cards.map((c) => c.id),
      ["toolCalls", "turns"],
    );
    assert.equal(cards[0]?.value, "0");
  });

  it("errors survived gets an ok accent when the last command overall went green", () => {
    const t = baseTimeline();
    t.commands = [
      { command: "npm test", exitCode: 1, turnIndex: 0 },
      { command: "npm test", exitCode: 0, turnIndex: 1 },
    ];
    t.totals = { ...t.totals, failedCommands: 1 };
    const cards = pickStatCards(t);
    const errors = cards.find((c) => c.id === "errors");
    assert.equal(errors?.accent, "ok");
  });

  it("value is the bare count regardless of plurality — the label doesn't repeat it", () => {
    const t = baseTimeline();
    t.diffs = [{ file: "a.ts", added: 1, removed: 0, turnIndex: 0 }];
    t.totals = { ...t.totals, added: 1, removed: 0, filesTouched: 1 };
    const cards = pickStatCards(t);
    const files = cards.find((c) => c.id === "files");
    assert.equal(files?.value, "1");
    assert.equal(files?.label, "files touched");
  });
});

describe("compressionLine", () => {
  it("formats real duration (h/m) → movie duration (bare seconds)", () => {
    assert.equal(compressionLine(6360, 50), "1h 46m → 50s");
    assert.equal(compressionLine(45, 50), "45s → 50s");
    assert.equal(compressionLine(125, 50), "2m → 50s");
  });
});

describe("titleMetaFor", () => {
  it("carries repo, formats the date, and formats the real duration", () => {
    const t = baseTimeline();
    t.sessionMeta.repo = "~/Desktop/checkout-service";
    const meta = titleMetaFor(t);
    assert.equal(meta.repo, "~/Desktop/checkout-service");
    assert.equal(meta.dateLabel, "Jul 4, 2026");
    assert.equal(meta.durationLabel, "1h 46m");
  });

  it("omits what it doesn't have rather than inventing it", () => {
    const t = baseTimeline();
    delete t.sessionMeta.startedAt;
    t.totals = { ...t.totals, durationSec: 0 };
    const meta = titleMetaFor(t);
    assert.equal(meta.dateLabel, undefined);
    assert.equal(meta.durationLabel, undefined);
    assert.equal(meta.repo, undefined);
  });
});

void formatTokens;
