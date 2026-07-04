/**
 * Punch-up pass tests — mock runner only, no claude binary, no network.
 * Run: node --import tsx --test src/screenwriter/punchup.test.ts
 * (proposed for the npm test glob — package.json is outside this branch's lane)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Screenplay } from "../screenplay/schema.js";
import { punchUpScreenplay, structuralDiff } from "./punchup.js";

const input: Screenplay = {
  version: 1,
  sessionMeta: { repo: "~/repo" },
  targetDurationSec: 50,
  scenes: [
    {
      type: "title",
      task: "fix the login",
      coldOpen: { description: "17 tests failing" },
      targetSec: 6,
      caption: "the mission begins",
    },
    {
      type: "dialogue",
      lines: [
        { speaker: "user", text: "the login is broken", emotion: "neutral" },
        { speaker: "claude", text: "on it", emotion: "confident" },
      ],
      targetSec: 8,
      caption: "negotiations",
    },
    {
      type: "action",
      events: [{ tool: "Bash", summary: "npm test → exit 1", ok: false }],
      intensity: "montage",
      targetSec: 16,
      caption: "the search",
    },
    {
      type: "showcase",
      artifact: { kind: "diff", file: "auth.ts", added: 4, removed: 2 },
      verdict: "pass",
      targetSec: 10,
      caption: "the fix lands",
    },
    {
      type: "stats",
      compressed: { realDuration: "42m", movieDuration: "50s" },
      counts: { files: 2, added: 4, removed: 2, tools: 9 },
      achievements: [{ id: "clean-run", title: "Clean Run" }],
      grade: "B+",
      targetSec: 10,
      caption: "the tally",
    },
  ],
};

/** A legal rewrite: same structure, new text everywhere allowed. */
const punched: Screenplay = JSON.parse(JSON.stringify(input)) as Screenplay;
punched.scenes = punched.scenes.map((s) => ({ ...s, caption: `REWRITTEN ${s.type}` }));
const dialogue = punched.scenes[1];
if (dialogue?.type === "dialogue") {
  dialogue.lines = dialogue.lines.map((l) => ({ ...l, text: `arr, ${l.text}` }));
}
const stats = punched.scenes[4];
if (stats?.type === "stats") {
  stats.achievements = [{ id: "clean-run", title: "The Immaculate Heist" }];
  stats.grade = "S";
}

const silent = () => {};

describe("structuralDiff", () => {
  it("accepts a rewrite that only touches allowed text fields", () => {
    assert.deepEqual(structuralDiff(input, punched), []);
  });

  it("flags a dropped scene", () => {
    const bad = { ...input, scenes: input.scenes.slice(0, 4) };
    assert.ok(structuralDiff(input, bad as Screenplay).some((v) => v.includes("length")));
  });

  it("flags a changed targetSec", () => {
    const bad = JSON.parse(JSON.stringify(input)) as Screenplay;
    const scene = bad.scenes[0];
    if (scene) scene.targetSec = 7;
    assert.ok(structuralDiff(input, bad).some((v) => v.includes("targetSec")));
  });

  it("flags a changed dialogue emotion (text is free, emotion is not)", () => {
    const bad = JSON.parse(JSON.stringify(input)) as Screenplay;
    const scene = bad.scenes[1];
    if (scene?.type === "dialogue" && scene.lines[1]) scene.lines[1].emotion = "smug";
    assert.ok(structuralDiff(input, bad).some((v) => v.includes("emotion")));
  });

  it("flags a rewritten title task (not an allowed field)", () => {
    const bad = JSON.parse(JSON.stringify(input)) as Screenplay;
    const scene = bad.scenes[0];
    if (scene?.type === "title") scene.task = "slay the login dragon";
    assert.ok(structuralDiff(input, bad).some((v) => v.includes("task")));
  });

  it("flags achievement id changes but not title changes", () => {
    const bad = JSON.parse(JSON.stringify(input)) as Screenplay;
    const scene = bad.scenes[4];
    if (scene?.type === "stats") scene.achievements = [{ id: "renamed", title: "Clean Run" }];
    assert.ok(structuralDiff(input, bad).some((v) => v.includes("id")));
  });

  it("flags a removed grade (grade text is free, its presence is not)", () => {
    const bad = JSON.parse(JSON.stringify(input)) as Screenplay;
    const scene = bad.scenes[4];
    if (scene?.type === "stats") delete scene.grade;
    assert.ok(structuralDiff(input, bad).some((v) => v.includes("hasGrade")));
  });
});

describe("punchUpScreenplay", () => {
  it("applies a structurally-legal rewrite", () => {
    const result = punchUpScreenplay(input, "quest", {
      runner: () => JSON.stringify(punched),
      log: silent,
    });
    assert.equal(result.source, "punched");
    assert.equal(result.attempts, 1);
    assert.equal(result.screenplay.scenes[0]?.caption, "REWRITTEN title");
  });

  it("retries a structural violation, then accepts the corrected attempt", () => {
    const bad = JSON.parse(JSON.stringify(punched)) as Screenplay;
    bad.scenes = bad.scenes.slice(0, 4); // dropped the stats scene
    let calls = 0;
    const result = punchUpScreenplay(input, "classic", {
      runner: () => (++calls === 1 ? JSON.stringify(bad) : JSON.stringify(punched)),
      log: silent,
    });
    assert.equal(calls, 2);
    assert.equal(result.source, "punched");
    assert.equal(result.attempts, 2);
  });

  it("returns the input unchanged after exhausting retries on persistent violations", () => {
    // Schema-legal but structurally forbidden: an emotion swap survives zod
    // and must be caught by structuralDiff.
    const bad = JSON.parse(JSON.stringify(punched)) as Screenplay;
    const scene = bad.scenes[1];
    if (scene?.type === "dialogue" && scene.lines[0]) scene.lines[0].emotion = "panicking";
    const warnings: string[] = [];
    const result = punchUpScreenplay(input, "horror", {
      runner: () => JSON.stringify(bad),
      log: (m) => warnings.push(m),
    });
    assert.equal(result.source, "unchanged");
    assert.equal(result.attempts, 3);
    assert.deepEqual(result.screenplay, input);
    assert.ok(warnings.some((w) => w.includes("structure")));
  });

  it("recovers from non-JSON output via the repair loop", () => {
    let calls = 0;
    const result = punchUpScreenplay(input, "heist", {
      runner: () => (++calls === 1 ? "sorry, here is prose" : JSON.stringify(punched)),
      log: silent,
    });
    assert.equal(result.source, "punched");
    assert.equal(result.attempts, 2);
  });

  it("rejects schema-invalid rewrites (dialogue text over 90 chars)", () => {
    const bad = JSON.parse(JSON.stringify(punched)) as Screenplay;
    const scene = bad.scenes[1];
    if (scene?.type === "dialogue" && scene.lines[0]) scene.lines[0].text = "x".repeat(120);
    const result = punchUpScreenplay(input, "quest", {
      runner: () => JSON.stringify(bad),
      log: silent,
    });
    assert.equal(result.source, "unchanged");
  });

  it("returns the input unchanged when the claude binary is missing", () => {
    const result = punchUpScreenplay(input, "nature-doc", {
      claudeBin: "definitely-not-a-real-binary-9b1c",
      log: silent,
    });
    assert.equal(result.source, "unchanged");
    assert.equal(result.attempts, 0);
    assert.deepEqual(result.screenplay, input);
  });
});
