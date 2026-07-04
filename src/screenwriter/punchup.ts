/**
 * Punch-up pass (docs/screenplay-format.md, docs/genre-packs.md): rewrite a
 * valid screenplay's TEXT in a genre persona's voice. Structure — scene
 * order, types, timings, events, artifacts, emotions — is IMMUTABLE, and
 * that is enforced by code, not trust: the model's output must be
 * structurally identical to the input outside the allowed text fields, or
 * it is rejected and retried; after the retry budget the INPUT is returned
 * unchanged with a warning. This is what makes `--genre` re-renders cheap
 * and safe.
 *
 * Allowed text fields: scene `caption`, dialogue line `text`, achievement
 * `title`, stats `grade`. Nothing else — not even title.task.
 */
import { ScreenplaySchema, type Screenplay } from "../screenplay/schema.js";
import { PERSONAS } from "../genre/personas.js";
import type { Genre } from "../genre/rules.js";
import { claudeAvailable, extractJson, runClaude } from "./claude.js";

// personas.ts is deliberately pure (zero imports), so the Record<Genre, string>
// completeness check lives here: this line stops compiling if GENRES gains a
// genre that personas.ts doesn't voice (or vice versa via the `satisfies`).
const _personasCoverEveryGenre: Record<Genre, string> = PERSONAS satisfies Record<Genre, string>;
void _personasCoverEveryGenre;

export interface PunchUpOptions {
  /** Path or name of the Claude Code binary. */
  claudeBin?: string;
  /** Optional model override passed as `--model`. */
  model?: string;
  /** Total `claude` invocations before giving up: 1 initial + up to 2 retries. */
  maxAttempts?: number;
  /** Notice sink; defaults to stderr. */
  log?: (message: string) => void;
  /** Injectable for tests — replaces the real `claude -p` spawn. */
  runner?: (prompt: string) => string;
}

export interface PunchUpResult {
  screenplay: Screenplay;
  /** "punched" when the persona rewrite was applied; "unchanged" on any fallback. */
  source: "punched" | "unchanged";
  attempts: number;
}

const DEFAULT_MAX_ATTEMPTS = 3;

function defaultLog(message: string): void {
  process.stderr.write(`${message}\n`);
}

/**
 * Clone a screenplay with every ALLOWED-to-change text field blanked, so two
 * screenplays that differ only in punch-up fields produce identical
 * fingerprints. Everything else — order, counts, numbers, enums — survives.
 */
function structuralFingerprint(screenplay: Screenplay): unknown {
  return {
    version: screenplay.version,
    sessionMeta: screenplay.sessionMeta,
    targetDurationSec: screenplay.targetDurationSec,
    scenes: screenplay.scenes.map((scene) => {
      const base = { type: scene.type, targetSec: scene.targetSec, caption: "" };
      switch (scene.type) {
        case "title":
          return { ...base, task: scene.task, coldOpen: scene.coldOpen ?? null };
        case "dialogue":
          return {
            ...base,
            lines: scene.lines.map((l) => ({ speaker: l.speaker, emotion: l.emotion, text: "" })),
          };
        case "action":
          return { ...base, intensity: scene.intensity, events: scene.events };
        case "showcase":
          return { ...base, artifact: scene.artifact, verdict: scene.verdict, focus: scene.focus ?? null };
        case "stats":
          return {
            ...base,
            compressed: scene.compressed,
            counts: scene.counts,
            achievements: scene.achievements.map((a) => ({ id: a.id, title: "" })),
            grade: "",
            hasGrade: scene.grade !== undefined,
          };
      }
    }),
  };
}

/**
 * Human-readable structural violations between input and candidate — empty
 * when the candidate changed nothing outside the allowed text fields.
 */
export function structuralDiff(input: Screenplay, candidate: Screenplay): string[] {
  const violations: string[] = [];
  const walk = (a: unknown, b: unknown, path: string): void => {
    if (violations.length >= 8) return; // enough for a repair prompt
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) {
        violations.push(`${path}: length ${a.length} → ${b.length}`);
        return;
      }
      a.forEach((item, i) => walk(item, b[i], `${path}[${i}]`));
      return;
    }
    if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const key of keys) {
        walk(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
          path ? `${path}.${key}` : key,
        );
      }
      return;
    }
    if (a !== b) violations.push(`${path}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
  };
  walk(structuralFingerprint(input), structuralFingerprint(candidate), "");
  return violations;
}

function buildPrompt(screenplay: Screenplay, genre: Genre): string {
  return [
    "You are the punch-up pass for sessionmovie: rewrite a movie screenplay's TEXT in a genre voice.",
    "",
    `The voice: ${PERSONAS[genre]}.`,
    "",
    "Rewrite ONLY these fields, keeping every one within its limit:",
    '- every scene\'s "caption" (max 120 chars, AT MOST 10 WORDS — it is narrated aloud)',
    '- dialogue line "text" (max 90 chars; keep each line\'s speaker and emotion exactly)',
    '- achievement "title" values (max 60 chars; keep each achievement\'s "id" exactly)',
    '- the stats scene\'s "grade" (max 3 chars) if present',
    "",
    "EVERYTHING ELSE IS FROZEN. Same scenes, same order, same types, same targetSec,",
    "same title task, same coldOpen, same events, same artifacts, same verdicts, same",
    "counts, same numbers. Do not add or remove anything. If you change structure the",
    "output is rejected by a machine, not a person — there is no partial credit.",
    "",
    "Punch up the jokes, do not replace the facts: the captions must still be about",
    "what actually happens in their scene.",
    "",
    "Output ONLY the full rewritten screenplay JSON — no commentary, no fences.",
    "",
    "The screenplay:",
    JSON.stringify(screenplay, null, 2),
  ].join("\n");
}

function repairPrompt(originalPrompt: string, previousOutput: string, issues: string): string {
  return [
    originalPrompt,
    "",
    "---",
    "",
    "A previous attempt produced the JSON below, which was REJECTED:",
    "",
    previousOutput.slice(0, 8000),
    "",
    "Rejection reasons:",
    issues,
    "",
    "Fix every issue. Remember: only caption, dialogue text, achievement titles and",
    "grade may differ from the input screenplay. Output the corrected JSON only.",
  ].join("\n");
}

/**
 * Rewrite `screenplay`'s text in `genre`'s persona voice. Never throws and
 * never returns an invalid or restructured screenplay: any failure mode
 * (no binary, bad JSON, schema violation, structural drift, exhausted
 * retries) returns the input unchanged with a logged warning.
 */
export function punchUpScreenplay(
  screenplay: Screenplay,
  genre: Genre,
  options: PunchUpOptions = {},
): PunchUpResult {
  const bin = options.claudeBin ?? "claude";
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const log = options.log ?? defaultLog;
  const runner = options.runner ?? ((prompt: string) => runClaude(bin, prompt, options.model));

  if (!options.runner && !claudeAvailable(bin)) {
    log(`⚠️  punch-up: \`${bin}\` binary not found — captions keep the beat-pass voice.`);
    return { screenplay, source: "unchanged", attempts: 0 };
  }

  const originalPrompt = buildPrompt(screenplay, genre);
  let prompt = originalPrompt;
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;
    let raw: string;
    try {
      raw = runner(prompt);
    } catch (err) {
      log(`⚠️  punch-up: claude invocation failed (attempt ${attempts}/${maxAttempts}): ${err}`);
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJson(raw));
    } catch (err) {
      log(`⚠️  punch-up: attempt ${attempts}/${maxAttempts} returned no parseable JSON, retrying`);
      prompt = repairPrompt(originalPrompt, raw.slice(0, 2000), `output was not valid JSON: ${err}`);
      continue;
    }

    const validated = ScreenplaySchema.safeParse(parsed);
    if (!validated.success) {
      const issues = validated.error.issues
        .map((i) => `- at ${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("\n");
      log(`⚠️  punch-up: attempt ${attempts}/${maxAttempts} failed schema validation, retrying`);
      prompt = repairPrompt(originalPrompt, JSON.stringify(parsed).slice(0, 8000), issues);
      continue;
    }

    const violations = structuralDiff(screenplay, validated.data);
    if (violations.length > 0) {
      log(
        `⚠️  punch-up: attempt ${attempts}/${maxAttempts} changed structure (${violations[0]}), retrying`,
      );
      prompt = repairPrompt(
        originalPrompt,
        JSON.stringify(validated.data).slice(0, 8000),
        violations.map((v) => `- structural change at ${v}`).join("\n"),
      );
      continue;
    }

    return { screenplay: validated.data, source: "punched", attempts };
  }

  log(
    `⚠️  punch-up: no structurally-safe rewrite after ${attempts} attempt(s) — captions keep the beat-pass voice.`,
  );
  return { screenplay, source: "unchanged", attempts };
}
