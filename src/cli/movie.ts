/**
 * npx sessionmovie <transcript.jsonl> [--out movie.mp4] [--keep-screenplay]
 *
 * The one command: transcript → timeline → screenplay → rendered MP4.
 * Exit codes: 0 rendered, 2 graceful decline ("not enough footage"), 1 error.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { parseTranscript } from "../parser/index.js";
import { writeScreenplay } from "../screenwriter/heuristic.js";
import { writeScreenplayLLMDetailed } from "../screenwriter/llm.js";
import { ScreenplaySchema, type Screenplay } from "../screenplay/schema.js";
import { remotionCliInstalled, runNpx } from "./workspace.js";

// Matches the composition (remotion/src/Root.tsx + Classic.tsx): 30fps, each
// scene rounds targetSec to whole frames. Keep in sync so the printed duration
// is the real one, not the screenplay's nominal target.
const FPS = 30;

function movieDurationSec(screenplay: Screenplay): number {
  const frames = screenplay.scenes.reduce(
    (sum, s) => sum + Math.max(1, Math.round(s.targetSec * FPS)),
    0,
  );
  return frames / FPS;
}

function usage(): never {
  process.stderr.write(
    "usage: sessionmovie <transcript.jsonl> [--out movie.mp4] [--keep-screenplay] [--no-llm]\n",
  );
  process.exit(1);
}

function fail(message: string): never {
  process.stderr.write(`✗ ${message}\n`);
  process.exit(1);
}

const args = process.argv.slice(2);
let input: string | undefined;
let out = "movie.mp4";
let keepScreenplay = false;
let useLlm = true;
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--out" || arg === "-o") {
    const next = args[++i];
    if (!next) usage();
    out = next;
  } else if (arg === "--keep-screenplay") {
    keepScreenplay = true;
  } else if (arg === "--no-llm") {
    useLlm = false;
  } else if (arg && !arg.startsWith("-")) {
    if (input) usage();
    input = arg;
  } else {
    usage();
  }
}
if (!input) usage();

// First output within the first second — never hang silently.
process.stdout.write(`🎬 sessionmovie — reading ${input}\n`);

const startedAt = Date.now();
const outPath = resolve(out);

let jsonl: string;
try {
  jsonl = readFileSync(resolve(input), "utf8");
} catch (err) {
  fail(`cannot read transcript: ${err instanceof Error ? err.message : String(err)}`);
}

const timeline = parseTranscript(jsonl);
// LLM screenwriter is the default (real narrative, funny captions); it falls
// back to the heuristic on its own when `claude` is missing or attempts fail.
let result;
if (useLlm) {
  process.stdout.write("   writing screenplay with claude (~1 min; --no-llm for the fast heuristic)…\n");
  const detailed = writeScreenplayLLMDetailed(timeline);
  result = detailed.output;
  process.stdout.write(
    `   screenwriter: ${detailed.source}${detailed.attempts ? ` (${detailed.attempts} attempt${detailed.attempts > 1 ? "s" : ""})` : ""}\n`,
  );
} else {
  result = writeScreenplay(timeline);
}

if ("decline" in result) {
  process.stderr.write(`🎬 no movie: ${result.reason}\n`);
  process.exit(2);
}

// Re-validate at the render boundary: nothing unvalidated reaches --props.
const validated = ScreenplaySchema.safeParse(result);
if (!validated.success) {
  const issues = validated.error.issues
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
  fail(`screenwriter produced an invalid screenplay (bug): ${issues}`);
}
const screenplay = validated.data;
process.stdout.write(
  `   screenplay ready: ${screenplay.scenes.length} scenes ` +
    `(${screenplay.scenes.map((s) => s.type).join(" → ")})\n`,
);

if (!remotionCliInstalled()) {
  fail("Remotion is not installed — run `npm install`, then `sessionmovie doctor` to verify setup");
}

const screenplayPath = keepScreenplay
  ? join(dirname(outPath), `${basename(outPath).replace(/\.[^.]+$/, "")}.screenplay.json`)
  : join(dirname(outPath), `.${basename(outPath)}.screenplay.tmp.json`);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(screenplayPath, `${JSON.stringify(screenplay, null, 2)}\n`);

process.stdout.write("   rendering with Remotion (first run may take a few minutes)…\n");
const code = await runNpx([
  "remotion",
  "render",
  "src/index.ts",
  "Classic",
  outPath,
  `--props=${screenplayPath}`,
]);
if (!keepScreenplay) rmSync(screenplayPath, { force: true });
if (code !== 0) {
  fail(`remotion render failed (exit ${code}) — try \`sessionmovie doctor\``);
}

const elapsedSec = Math.round((Date.now() - startedAt) / 10) / 100;
const t = timeline.totals;
process.stdout.write(
  `🎬 ${outPath} — ${movieDurationSec(screenplay)}s movie` +
    (keepScreenplay ? ` (screenplay kept at ${screenplayPath})` : "") +
    "\n" +
    `   session: ${t.toolCalls} tool calls, ${t.filesTouched} files, ` +
    `+${t.added}/−${t.removed}, ${t.turns} turns — rendered in ${elapsedSec}s\n`,
);
