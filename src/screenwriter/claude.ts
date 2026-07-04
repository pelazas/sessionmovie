/**
 * Shared `claude -p` plumbing for the LLM stages (beat pass in llm.ts,
 * punch-up pass in punchup.ts): binary probe, one-shot print-mode spawn,
 * and fence-tolerant JSON extraction. The prompt goes in on stdin to dodge
 * argv limits; no API key handling — this rides the user's subscription.
 */
import { spawnSync } from "node:child_process";

export const ATTEMPT_TIMEOUT_MS = 240_000;
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

export function claudeAvailable(bin: string): boolean {
  const probe = spawnSync(bin, ["--version"], { encoding: "utf8", timeout: 15_000 });
  return probe.error === undefined && probe.status === 0;
}

/** One `claude -p` invocation; the prompt goes in on stdin to dodge argv limits. */
export function runClaude(bin: string, prompt: string, model: string | undefined): string {
  const args = ["-p", "--output-format", "text"];
  if (model) args.push("--model", model);
  const run = spawnSync(bin, args, {
    input: prompt,
    encoding: "utf8",
    timeout: ATTEMPT_TIMEOUT_MS,
    maxBuffer: MAX_OUTPUT_BYTES,
  });
  if (run.error) throw run.error;
  if (run.status !== 0) {
    throw new Error(`claude exited ${run.status}: ${(run.stderr ?? "").trim().slice(0, 500)}`);
  }
  return run.stdout ?? "";
}

/** Models fence and preface JSON despite instructions; take first `{` to last `}`. */
export function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("no JSON object found in model output");
  }
  return text.slice(start, end + 1);
}
