/**
 * Punch-up pass tests — mock runner only, no claude binary, no network.
 * Run: node --import tsx --test src/screenwriter/punchup.test.ts
 * (proposed for the npm test glob — package.json is outside this branch's lane)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Screenplay } from "../screenplay/schema.js";
import { captionAnchors, lostCaptionAnchors, punchUpScreenplay, structuralDiff } from "./punchup.js";

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
// NOTE: dialogue text deliberately untouched — it is documentary and frozen
// (docs/v1-storychange.md); rewriting it is a violation, tested below.
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

describe("dialogue is documentary (docs/v1-storychange.md)", () => {
  it("flags a rewritten dialogue line as a structural violation, quoting the text", () => {
    const bad = JSON.parse(JSON.stringify(punched)) as Screenplay;
    const scene = bad.scenes[1];
    if (scene?.type === "dialogue" && scene.lines[0]) scene.lines[0].text = "arr, the login be broken";
    const violations = structuralDiff(input, bad);
    assert.ok(violations.some((v) => v.includes("text") && v.includes("the login is broken")));
  });

  it("punchUpScreenplay returns input unchanged when the model keeps translating dialogue", () => {
    const bad = JSON.parse(JSON.stringify(punched)) as Screenplay;
    const scene = bad.scenes[1];
    if (scene?.type === "dialogue" && scene.lines[1]) scene.lines[1].text = "verily, on it";
    const warnings: string[] = [];
    const result = punchUpScreenplay(input, "quest", {
      runner: () => JSON.stringify(bad),
      log: (m) => warnings.push(m),
    });
    assert.equal(result.source, "unchanged");
    assert.deepEqual(result.screenplay, input);
  });
});

describe("caption anchors survive the rewrite", () => {
  it("captionAnchors finds times, files, PR refs and numbers", () => {
    // "08"/"17"/"34" also match as bare numbers — redundant but harmless,
    // since violation checks are substring-based.
    assert.deepEqual(
      captionAnchors("08:34 — PR #17 lands in Showcase.tsx, 46 files later").sort(),
      ["#17", "08", "08:34", "17", "34", "46", "Showcase.tsx"].sort(),
    );
  });

  it("a rewrite that drops a number is a violation that quotes the anchor", () => {
    const anchored = JSON.parse(JSON.stringify(input)) as Screenplay;
    const scene = anchored.scenes[3];
    if (scene) scene.caption = "17 tests fail in auth.ts";
    const bad = JSON.parse(JSON.stringify(anchored)) as Screenplay;
    const badScene = bad.scenes[3];
    if (badScene) badScene.caption = "many tests fail in auth.ts";
    const violations = lostCaptionAnchors(anchored, bad);
    assert.ok(violations.some((v) => v.includes('"17"')));
  });

  it("a rewrite that keeps every anchor passes", () => {
    const anchored = JSON.parse(JSON.stringify(input)) as Screenplay;
    const scene = anchored.scenes[3];
    if (scene) scene.caption = "17 tests fail in auth.ts";
    const good = JSON.parse(JSON.stringify(anchored)) as Screenplay;
    const goodScene = good.scenes[3];
    if (goodScene) goodScene.caption = "the boss strikes: 17 tests down in auth.ts";
    assert.deepEqual(lostCaptionAnchors(anchored, good), []);
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

describe("caption presence is structure", () => {
  it("flags a deleted caption and an added caption as violations", () => {
    const mutated = structuredClone(input);
    delete mutated.scenes[0]!.caption; // scene 0 has one — delete it
    const idx = mutated.scenes.findIndex((sc) => sc.caption === undefined && sc !== mutated.scenes[0]);
    if (idx >= 0) mutated.scenes[idx]!.caption = "IT IS BEHIND THE LINTER";
    const violations = structuralDiff(input, mutated);
    assert.ok(violations.length > 0, "caption presence drift must be a violation");
  });
});
