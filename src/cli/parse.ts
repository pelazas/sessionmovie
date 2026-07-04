/**
 * npm run parse -- <transcript.jsonl> -o <screenplay.json>
 *
 * Transcript → timeline (parser) → screenplay (heuristic screenwriter).
 * Exits 0 on success, 2 on a graceful decline ("not enough footage"),
 * 1 on anything else.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseTranscript } from "../parser/index.js";
import { writeScreenplay } from "../screenwriter/heuristic.js";

function usage(): never {
  process.stderr.write("usage: npm run parse -- <transcript.jsonl> [-o out/screenplay.json]\n");
  process.exit(1);
}

const args = process.argv.slice(2);
let input: string | undefined;
let output = "out/screenplay.json";
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "-o" || arg === "--output") {
    const next = args[++i];
    if (!next) usage();
    output = next;
  } else if (arg && !arg.startsWith("-")) {
    input = arg;
  } else {
    usage();
  }
}
if (!input) usage();

const jsonl = readFileSync(resolve(input), "utf8");
const timeline = parseTranscript(jsonl);
const result = writeScreenplay(timeline);

if ("decline" in result) {
  process.stderr.write(`🎬 no movie: ${result.reason}\n`);
  process.exit(2);
}

mkdirSync(dirname(resolve(output)), { recursive: true });
writeFileSync(resolve(output), `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(
  `🎬 screenplay written to ${output} — ${result.scenes.length} scenes, ` +
    `${result.targetDurationSec}s target (session: ${timeline.totals.toolCalls} tool calls, ` +
    `${timeline.totals.filesTouched} files, +${timeline.totals.added}/−${timeline.totals.removed})\n`,
);
