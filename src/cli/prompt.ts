/**
 * npx sessionmovie prompt <transcript.jsonl>
 *
 * Prints the complete screenwriter prompt for a transcript — the in-session
 * skill path: Claude in the user's session writes the screenplay instead of
 * a spawned `claude -p` (docs/superpowers/specs/2026-07-04-claude-skill-design.md).
 * Exit codes: 0 prompt printed, 2 structural decline, 1 error.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseTranscript } from "../parser/index.js";
import { structuralDecline } from "../screenwriter/heuristic.js";
import { buildScreenwriterPrompt } from "../screenwriter/llm.js";

const input = process.argv[2];
if (!input || input.startsWith("-")) {
  process.stderr.write("usage: sessionmovie prompt <transcript.jsonl>\n");
  process.exit(1);
}

let jsonl: string;
try {
  jsonl = readFileSync(resolve(input), "utf8");
} catch (err) {
  process.stderr.write(
    `cannot read transcript: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
}

const timeline = parseTranscript(jsonl);
const declined = structuralDecline(timeline);
if (declined) {
  process.stderr.write(`🎬 no movie: ${declined.reason}\n`);
  process.exit(2);
}
process.stdout.write(`${buildScreenwriterPrompt(timeline)}\n`);
