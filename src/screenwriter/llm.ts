/**
 * LLM screenwriter — calls the local `claude` binary in print mode, so it
 * rides the user's existing subscription (no API key handling here).
 *
 * Timeline → digest → prompt (prompts/v5.md) → `claude -p` → JSON →
 * zod validation with a bounded repair loop (validation issues are fed back
 * to the model). Never emits an invalid screenplay: if the binary is missing
 * or every attempt fails validation, falls back to the deterministic
 * heuristic screenwriter with a printed notice.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DeclineSchema,
  ScreenplaySchema,
  type ScreenwriterOutput,
} from "../screenplay/schema.js";
import type { Timeline } from "../parser/types.js";
import { claudeAvailable, extractJson, runClaude } from "./claude.js";
import { digestTimeline } from "./digest.js";
import { writeScreenplay as writeScreenplayHeuristic } from "./heuristic.js";

export const PROMPT_VERSION = "v5";

const DEFAULT_TARGET_DURATION_SEC = 50;
const DEFAULT_MAX_ATTEMPTS = 3;

export interface LLMScreenwriterOptions {
  /** Path or name of the Claude Code binary. */
  claudeBin?: string;
  /** Optional model override passed as `--model`. */
  model?: string;
  /** Total duration budget, 45–60. */
  targetDurationSec?: number;
  /** Total `claude` invocations before giving up (initial + repairs). */
  maxAttempts?: number;
  /** Notice sink; defaults to stderr. */
  log?: (message: string) => void;
}

export interface LLMScreenwriterResult {
  output: ScreenwriterOutput;
  /** "llm" when the model produced a valid output; "heuristic" on fallback. */
  source: "llm" | "heuristic";
  /** Number of `claude` invocations actually made. */
  attempts: number;
}

function defaultLog(message: string): void {
  process.stderr.write(`${message}\n`);
}

function loadPromptTemplate(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(here, "prompts", `${PROMPT_VERSION}.md`), "utf8");
}

function buildPrompt(digest: string, targetDurationSec: number): string {
  // Strip the leading dev-doc HTML comment BEFORE substituting. It documents
  // the {{DIGEST}} / {{TARGET_DURATION_SEC}} placeholders literally, so leaving
  // it in would inject the whole digest a second time (and ship internal notes
  // like the vN-vs-vN changelog to the model). The prompt sent is body only.
  return loadPromptTemplate()
    .replace(/<!--[\s\S]*?-->\n*/g, "")
    .replaceAll("{{TARGET_DURATION_SEC}}", String(targetDurationSec))
    .replaceAll("{{DIGEST}}", digest);
}

/**
 * The complete screenwriter prompt for a timeline — single source of truth
 * for BOTH LLM paths: spawned `claude -p` (this module) and in-session
 * Claude via `sessionmovie prompt` (the /movie skill). One prompt, no drift.
 */
export function buildScreenwriterPrompt(
  timeline: Timeline,
  targetDurationSec: number = DEFAULT_TARGET_DURATION_SEC,
): string {
  return buildPrompt(digestTimeline(timeline), targetDurationSec);
}




interface ValidationFailure {
  issues: string;
}

export function validateScreenwriterJson(
  json: string,
): ScreenwriterOutput | ValidationFailure {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    return { issues: `output is not valid JSON: ${err instanceof Error ? err.message : err}` };
  }
  const decline = DeclineSchema.safeParse(parsed);
  if (decline.success) return decline.data;
  const screenplay = ScreenplaySchema.safeParse(parsed);
  if (screenplay.success) return screenplay.data;
  const issues = screenplay.error.issues
    .map((i) => `- at ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  return { issues };
}

/**
 * Each `claude -p` spawn is a FRESH conversation — the model remembers nothing
 * from the previous attempt. The repair prompt must therefore carry the full
 * original prompt (contract + digest) again, not just the delta.
 */
function repairPrompt(originalPrompt: string, previousOutput: string, issues: string): string {
  return [
    originalPrompt,
    "",
    "---",
    "",
    "A previous attempt at this task produced the JSON below, which FAILED schema validation.",
    "",
    "Previous output:",
    previousOutput,
    "",
    "Validation issues:",
    issues,
    "",
    "Fix every issue and output the corrected JSON only — no commentary, no markdown fences.",
    "Remember: version is 2; scene targetSec values must sum to within ±10% of targetDurationSec;",
    "each dialogue line ≤90 chars, each dialogue scene's lines combined ≤90 chars, ≤6 dialogue",
    "lines total; stats scenes are bare (no numbers); and the scene type vocabulary is closed.",
  ].join("\n");
}

/**
 * Write a screenplay with the LLM, with full detail about how it went
 * (attempts made, whether the heuristic fallback was used).
 */
export function writeScreenplayLLMDetailed(
  timeline: Timeline,
  options: LLMScreenwriterOptions = {},
): LLMScreenwriterResult {
  const bin = options.claudeBin ?? "claude";
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const targetDurationSec = options.targetDurationSec ?? DEFAULT_TARGET_DURATION_SEC;
  const log = options.log ?? defaultLog;

  if (!claudeAvailable(bin)) {
    log(
      `⚠️  \`${bin}\` binary not found — using the heuristic screenwriter instead. ` +
        "Install Claude Code (https://claude.com/claude-code) for real screenplays.",
    );
    return { output: writeScreenplayHeuristic(timeline), source: "heuristic", attempts: 0 };
  }

  const originalPrompt = buildScreenwriterPrompt(timeline, targetDurationSec);
  let prompt = originalPrompt;
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;
    let raw: string;
    try {
      raw = runClaude(bin, prompt, options.model);
    } catch (err) {
      log(`⚠️  claude invocation failed (attempt ${attempts}/${maxAttempts}): ${err}`);
      continue;
    }

    let candidate: string;
    try {
      candidate = extractJson(raw);
    } catch {
      log(`⚠️  attempt ${attempts}/${maxAttempts}: model output contained no JSON, retrying`);
      prompt = repairPrompt(originalPrompt, raw.slice(0, 2000), "output contained no JSON object at all");
      continue;
    }

    const result = validateScreenwriterJson(candidate);
    if (!("issues" in result)) {
      return { output: result, source: "llm", attempts };
    }
    log(`⚠️  attempt ${attempts}/${maxAttempts}: screenplay failed validation, repairing`);
    prompt = repairPrompt(originalPrompt, candidate, result.issues);
  }

  log(
    `⚠️  no valid screenplay after ${attempts} attempt(s) — falling back to the heuristic screenwriter.`,
  );
  return { output: writeScreenplayHeuristic(timeline), source: "heuristic", attempts };
}

/**
 * The LLM screenwriter. Same shape as the heuristic `writeScreenplay`:
 * timeline in, valid ScreenwriterOutput (screenplay or decline) out — always.
 */
export function writeScreenplayLLM(
  timeline: Timeline,
  options: LLMScreenwriterOptions = {},
): ScreenwriterOutput {
  return writeScreenplayLLMDetailed(timeline, options).output;
}
