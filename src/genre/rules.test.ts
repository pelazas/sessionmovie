import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Timeline } from "../parser/types.js";
import { compositionFor, GENRE_COMPOSITIONS } from "./compositions.js";
import { GENRES, isGenre, pickGenre, signalsFrom, type GenreSignals } from "./rules.js";

/** A signals object that matches no rule — the classic fallthrough shape. */
const base: GenreSignals = {
  commands: 2,
  failedCommands: 1,
  filesTouched: 1,
  durationSec: 300,
  finalCommandGreen: true,
  readCalls: 3,
  editCalls: 2,
};

describe("pickGenre — one test per rule branch, top-down", () => {
  it("quest: ≥3 failed commands but the final run is green", () => {
    const pick = pickGenre({ ...base, failedCommands: 3, finalCommandGreen: true });
    assert.equal(pick.genre, "quest");
    assert.equal(pick.reason, "3 failed commands, final run green");
  });

  it("horror: ≥3 failed commands and it never went green", () => {
    const pick = pickGenre({ ...base, failedCommands: 5, finalCommandGreen: false });
    assert.equal(pick.genre, "horror");
    assert.equal(pick.reason, "5 failed commands, never went green");
  });

  it("heist: clean run with files touched", () => {
    const pick = pickGenre({ ...base, failedCommands: 0, filesTouched: 4 });
    assert.equal(pick.genre, "heist");
    assert.equal(pick.reason, "0 failed commands, 4 files touched");
  });

  it("nature-doc: read-heavy and long", () => {
    const pick = pickGenre({
      ...base,
      readCalls: 24,
      editCalls: 2,
      durationSec: 1800,
    });
    assert.equal(pick.genre, "nature-doc");
    assert.match(pick.reason, /24 reads vs 2 edits/);
  });

  it("classic: everything else", () => {
    const pick = pickGenre(base);
    assert.equal(pick.genre, "classic");
    assert.equal(pick.reason, "no strong signal — the reference look");
  });

  it("precedence: quest wins over a would-be nature-doc shape", () => {
    const pick = pickGenre({
      ...base,
      failedCommands: 4,
      finalCommandGreen: true,
      readCalls: 40,
      editCalls: 1,
      durationSec: 3600,
    });
    assert.equal(pick.genre, "quest");
  });

  it("thresholds: 2 failures is not a quest", () => {
    const pick = pickGenre({ ...base, failedCommands: 2, finalCommandGreen: true });
    assert.equal(pick.genre, "classic");
  });

  it("heist needs commands to have run AND files touched", () => {
    assert.equal(pickGenre({ ...base, failedCommands: 0, commands: 0 }).genre, "classic");
    assert.equal(pickGenre({ ...base, failedCommands: 0, filesTouched: 0 }).genre, "classic");
  });

  it("nature-doc needs the long duration, not just the read ratio", () => {
    const pick = pickGenre({ ...base, readCalls: 24, editCalls: 2, durationSec: 120 });
    assert.equal(pick.genre, "classic");
  });

  it("read-only sessions (0 edits) can still be nature-doc", () => {
    const pick = pickGenre({
      ...base,
      failedCommands: 1,
      readCalls: 15,
      editCalls: 0,
      durationSec: 900,
    });
    assert.equal(pick.genre, "nature-doc");
  });
});

describe("signalsFrom(timeline)", () => {
  const timeline: Timeline = {
    sessionMeta: {},
    turns: [{ userMessage: "fix it" }],
    toolCalls: [
      { tool: "Read", summary: "Read a.ts", turnIndex: 0 },
      { tool: "Grep", summary: "Grep foo", turnIndex: 0 },
      { tool: "Glob", summary: "Glob *.ts", turnIndex: 0 },
      { tool: "Edit", summary: "Edit a.ts", turnIndex: 0 },
      { tool: "Bash", summary: "npm test", turnIndex: 0 },
    ],
    diffs: [],
    commands: [
      { command: "npm test", exitCode: 1, turnIndex: 0 },
      { command: "npm test", exitCode: 0, turnIndex: 0 },
    ],
    totals: {
      turns: 1,
      toolCalls: 5,
      filesTouched: 1,
      added: 2,
      removed: 0,
      commands: 2,
      failedCommands: 1,
      durationSec: 60,
    },
  };

  it("derives read/edit counts and final-command state from the timeline", () => {
    const signals = signalsFrom(timeline);
    assert.equal(signals.readCalls, 3);
    assert.equal(signals.editCalls, 1);
    assert.equal(signals.finalCommandGreen, true);
    assert.equal(signals.commands, 2);
    assert.equal(signals.failedCommands, 1);
    assert.equal(signals.durationSec, 60);
  });

  it("finalCommandGreen is null when no commands ran", () => {
    const signals = signalsFrom({ ...timeline, commands: [] });
    assert.equal(signals.finalCommandGreen, null);
  });
});

describe("genre → composition contract table", () => {
  it("classic maps to the Classic composition", () => {
    assert.equal(GENRE_COMPOSITIONS.classic, "Classic");
    assert.deepEqual(compositionFor("classic"), { compositionId: "Classic", shipped: true });
  });

  it("shipped genres resolve to their own composition", () => {
    assert.deepEqual(compositionFor("quest"), { compositionId: "Quest", shipped: true });
  });

  it("unshipped genres fall through to Classic, flagged", () => {
    for (const genre of GENRES) {
      if (genre in GENRE_COMPOSITIONS) continue; // shipped packs covered above
      assert.deepEqual(compositionFor(genre), { compositionId: "Classic", shipped: false });
    }
  });

  it("isGenre accepts the table and rejects garbage", () => {
    for (const genre of GENRES) assert.ok(isGenre(genre));
    assert.ok(!isGenre("western"));
    assert.ok(!isGenre(""));
  });
});
