/**
 * Prompt eval harness — the screenwriter prompt is product code (CLAUDE.md),
 * so re-run this against every fixture whenever prompts/vN.md or digest.ts
 * changes. It exercises the real LLM path (digest → `claude -p` → zod repair
 * loop) and checks the FULL screenplay, not just the shape the golden
 * snapshots pin (scripts/golden.ts stores sceneCount/sceneTypes only — it
 * can't catch a numeral that slipped into dialogue or an invented artifact).
 *
 *   npx tsx scripts/eval-prompt.ts            # all fixtures
 *   npx tsx scripts/eval-prompt.ts optimize   # only fixtures matching "optimize"
 *   npm run eval:prompt
 *
 * Needs the `claude` binary (rides your subscription; a few $ of tokens for
 * the full corpus). NOT part of `npm test`: it calls the network and the LLM
 * is nondeterministic, so it is a manual quality gate, not a unit test.
 *
 * Exit code: 0 when every screenplay passes every hard check, 1 otherwise.
 * Hard checks (deterministic, no false negatives): schema-valid, grammar
 * (title first / stats last / one showcase, right before stats), the three
 * dialogue budgets, and NO NUMERALS in dialogue text (docs/audio.md). Artifact
 * truthfulness is reported as verified/total — it's best-effort (the digest
 * truncates long commands) so it informs review rather than gating.
 */
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseTranscript } from "../src/parser/index.js";
import { digestTimeline } from "../src/screenwriter/digest.js";
import { writeScreenplayLLMDetailed } from "../src/screenwriter/llm.js";
import { DURATION_TOLERANCE, MAX_DIALOGUE_CHARS, MAX_DIALOGUE_LINES, MAX_SCENE_DIALOGUE_CHARS, ScreenwriterOutputSchema, type Screenplay } from "../src/screenplay/schema.js";

const RAW_DIR = join(import.meta.dirname, "..", "fixtures", "raw");
const OUT_DIR = join(import.meta.dirname, "..", "out", "eval"); // gitignored; full screenplays for review

interface Check {
  name: string;
  pass: boolean;
  detail?: string;
}

/** The hard, deterministic checks a valid screenplay must pass. */
function hardChecks(sp: Screenplay): Check[] {
  const checks: Check[] = [];
  const scenes = sp.scenes;

  // Grammar: title first, stats last, at most one showcase sitting right
  // before stats, and at least one dialogue and one action (a pair).
  const showcases = scenes.filter((s) => s.type === "showcase");
  const grammarProblems: string[] = [];
  if (scenes[0]?.type !== "title") grammarProblems.push("first scene is not title");
  if (scenes[scenes.length - 1]?.type !== "stats") grammarProblems.push("last scene is not stats");
  if (!scenes.some((s) => s.type === "dialogue")) grammarProblems.push("no dialogue scene");
  if (!scenes.some((s) => s.type === "action")) grammarProblems.push("no action scene");
  if (showcases.length > 1) grammarProblems.push(`${showcases.length} showcase scenes (max 1)`);
  if (showcases.length === 1 && scenes[scenes.length - 2]?.type !== "showcase") {
    grammarProblems.push("showcase is not the beat right before stats");
  }
  checks.push({ name: "grammar", pass: grammarProblems.length === 0, detail: grammarProblems.join("; ") });

  // Dialogue budgets (schema already enforces these — assert they held).
  let totalLines = 0;
  const budgetProblems: string[] = [];
  for (const [i, s] of scenes.entries()) {
    if (s.type !== "dialogue") continue;
    totalLines += s.lines.length;
    const combined = s.lines.reduce((n, l) => n + l.text.length, 0);
    if (combined > MAX_SCENE_DIALOGUE_CHARS) budgetProblems.push(`scene ${i} combined ${combined}>${MAX_SCENE_DIALOGUE_CHARS}`);
    for (const l of s.lines) {
      if (l.text.length > MAX_DIALOGUE_CHARS) budgetProblems.push(`scene ${i} line ${l.text.length}>${MAX_DIALOGUE_CHARS}`);
    }
  }
  if (totalLines > MAX_DIALOGUE_LINES) budgetProblems.push(`${totalLines} dialogue lines>${MAX_DIALOGUE_LINES}`);
  checks.push({ name: "dialogueBudgets", pass: budgetProblems.length === 0, detail: budgetProblems.join("; ") });

  // Duration sum within tolerance.
  const sum = scenes.reduce((n, s) => n + s.targetSec, 0);
  const tol = sp.targetDurationSec * DURATION_TOLERANCE;
  checks.push({
    name: "durationSum",
    pass: Math.abs(sum - sp.targetDurationSec) <= tol,
    detail: `sum ${sum} vs ${sp.targetDurationSec} (±${tol})`,
  });

  // THE numeral rule — the whole point of the numeric-heavy fixture. Digits in
  // dialogue text get read ~2.6x slower by TTS; numbers live in stats/captions.
  const offenders: string[] = [];
  for (const s of scenes) {
    if (s.type !== "dialogue") continue;
    for (const l of s.lines) if (/[0-9]/.test(l.text)) offenders.push(JSON.stringify(l.text));
  }
  checks.push({ name: "noNumeralsInDialogue", pass: offenders.length === 0, detail: offenders.join(" ") });

  return checks;
}

/** Best-effort truthfulness: does each artifact trace to a string in the digest? */
function artifactTruth(sp: Screenplay, digest: string): { verified: number; total: number; unverified: string[] } {
  const hay = digest.toLowerCase();
  const inDigest = (s: string) => hay.includes(s.toLowerCase());
  const unverified: string[] = [];
  let verified = 0;
  let total = 0;
  const note = (ok: boolean, label: string) => {
    total++;
    if (ok) verified++;
    else unverified.push(label);
  };
  for (const scene of sp.scenes) {
    if (scene.type !== "action" && scene.type !== "showcase") continue;
    const a = scene.artifact;
    if (a.kind === "edit") note(inDigest(a.file), `edit ${a.file}`);
    else if (a.kind === "command") note(inDigest(a.command.slice(0, 24)), `command ${a.command.slice(0, 30)}`);
    else if (a.kind === "create") for (const f of a.files) note(inDigest(f), `create ${f}`);
    else if (a.kind === "subagents") for (const t of a.tasks) note(inDigest(t.slice(0, 16)), `subagent ${t}`);
  }
  return { verified, total, unverified };
}

const only = process.argv[2];
const fixtures = readdirSync(RAW_DIR)
  .filter((n) => n.endsWith(".jsonl"))
  .filter((n) => !only || n.includes(only))
  .sort();

mkdirSync(OUT_DIR, { recursive: true });

const rows: string[] = [];
let anyFail = false;

for (const name of fixtures) {
  const timeline = parseTranscript(readFileSync(join(RAW_DIR, name), "utf8"));
  const digest = digestTimeline(timeline);
  process.stderr.write(`\n===== ${name} =====\n`);
  const detailed = writeScreenplayLLMDetailed(timeline, { log: (m) => process.stderr.write(`  ${m}\n`) });
  const parsed = ScreenwriterOutputSchema.safeParse(detailed.output);
  if (!parsed.success) {
    anyFail = true;
    rows.push(`${name.padEnd(34)} INVALID (${detailed.source})`);
    process.stderr.write(`  ✗ output failed schema re-parse\n`);
    continue;
  }
  const out = parsed.data;
  if ("decline" in out) {
    rows.push(`${name.padEnd(34)} decline   (${detailed.source}/${detailed.attempts})  ${out.reason.slice(0, 60)}`);
    continue;
  }
  writeFileSync(join(OUT_DIR, `${name.replace(/\.jsonl$/, "")}.json`), JSON.stringify(out, null, 2));
  const checks = hardChecks(out);
  const truth = artifactTruth(out, digest);
  const failed = checks.filter((c) => !c.pass);
  if (failed.length > 0) anyFail = true;
  const dlg = out.scenes.reduce((n, s) => n + (s.type === "dialogue" ? s.lines.length : 0), 0);
  const arts = out.scenes.filter((s) => s.type === "action" || s.type === "showcase").map((s) => (s as { artifact: { kind: string } }).artifact.kind);
  rows.push(
    `${name.padEnd(34)} ${failed.length === 0 ? "PASS" : "FAIL"}  (${detailed.source}/${detailed.attempts})  ` +
      `dlg=${dlg} art=[${arts.join(",")}] truth=${truth.verified}/${truth.total}` +
      (failed.length ? `  << ${failed.map((c) => `${c.name}: ${c.detail}`).join(" | ")}` : ""),
  );
  for (const c of checks) process.stderr.write(`  ${c.pass ? "✓" : "✗"} ${c.name}${c.detail ? ` — ${c.detail}` : ""}\n`);
  if (truth.unverified.length) process.stderr.write(`  ? unverified artifacts: ${truth.unverified.join(", ")}\n`);
}

process.stderr.write("\n==== SUMMARY ====\n");
for (const r of rows) process.stderr.write(`${r}\n`);
process.stderr.write(`\nfull screenplays written to ${OUT_DIR}\n`);
process.exit(anyFail ? 1 : 0);
