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
 * Allowed text fields: scene `caption`, achievement `title`, stats `grade`.
 * Nothing else. Dialogue text is DOCUMENTARY (docs/v1-storychange.md): the
 * user's and agent's real words are condensed by the beat pass and never
 * persona-translated — it is part of the frozen fingerprint below. Caption
 * ANCHORS (file names, numbers, timestamps) must survive a rewrite; the
 * anchor checker turns a lost anchor into a retry that quotes it.
 */
import { ScreenplaySchema, type Screenplay } from "../screenplay/schema.js";
import { PERSONAS } from "../genre/personas.js";

// Compile-time: PERSONAS has no keys beyond Genre (missing keys are caught by
// the Record<Genre, string> annotation at the use site).
type _NoExtraPersonas = Exclude<keyof typeof PERSONAS, import("../genre/rules.js").Genre> extends never ? true : never;
const _personasExact: _NoExtraPersonas = true;
void _personasExact;
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
      // caption text is rewritable; caption PRESENCE is not — the beat pass
      // choosing silence (or a caption) is structure, same as hasGrade below.
      const base = {
        type: scene.type,
        targetSec: scene.targetSec,
        caption: "",
        hasCaption: scene.caption !== undefined,
      };
      switch (scene.type) {
        case "title":
          return { ...base, task: scene.task, coldOpen: scene.coldOpen ?? null };
        case "dialogue":
          // Dialogue is documentary — text is frozen structure, same as
          // emotions and timings (docs/v1-storychange.md).
          return {
            ...base,
            lines: scene.lines.map((l) => ({ speaker: l.speaker, emotion: l.emotion, text: l.text })),
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

/** Recognition anchors inside a caption: times, file-ish names, PR/issue refs, numbers. */
const ANCHOR_PATTERNS = [
  /\b\d{1,2}:\d{2}\b/g, // time of day
  /\b[\w./-]+\.(?:tsx?|jsx?|mjs|cjs|md|json|ya?ml|css|py|rs|go|sh|ogg|mp[34])\b/g, // file names
  /#\d+\b/g, // PR/issue refs
  /\b\d+(?:[.,]\d+)?\b/g, // plain numbers
];

export function captionAnchors(caption: string): string[] {
  const anchors = new Set<string>();
  for (const pattern of ANCHOR_PATTERNS) {
    for (const match of caption.matchAll(pattern)) anchors.add(match[0]);
  }
  // Drop anchors subsumed by a longer one from the same caption ("08"/"34"
  // inside "08:34", "17" inside "#17") — they can't be checked independently
  // and would triple-report a single lost timestamp in the repair prompt.
  return [...anchors].filter((a) => ![...anchors].some((b) => b !== a && b.includes(a)));
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Whether an anchor survives in the rewritten caption. Numeric anchors need
 * digit boundaries — "7" inside "47" is a different number, not a survival.
 * Everything else (file names, #refs, times) is distinctive enough for a
 * plain substring check.
 */
function anchorSurvives(anchor: string, after: string): boolean {
  if (/^\d/.test(anchor)) {
    return new RegExp(`(?<![\\d.,:])${escapeRegExp(anchor)}(?![\\d.,:]?\\d)`).test(after);
  }
  return after.includes(anchor);
}

/**
 * Captions are rewritable TEXT, but their anchors are not (docs/
 * v1-storychange.md): every anchor in an input caption must survive,
 * verbatim, in the rewritten caption. Violations quote the lost anchor so
 * the retry prompt can name exactly what disappeared.
 */
export function lostCaptionAnchors(input: Screenplay, candidate: Screenplay): string[] {
  const violations: string[] = [];
  input.scenes.forEach((scene, i) => {
    const before = scene.caption;
    const after = candidate.scenes[i]?.caption;
    if (!before || !after) return; // presence changes are structuralDiff's job
    for (const anchor of captionAnchors(before)) {
      if (!anchorSurvives(anchor, after)) {
        violations.push(`scenes[${i}].caption lost its anchor "${anchor}" (was: "${before}")`);
      }
    }
  });
  return violations;
}

function buildPrompt(screenplay: Screenplay, genre: Genre): string {
  return [
    "You are the punch-up pass for sessionmovie: rewrite a movie screenplay's TEXT in a genre voice.",
    "",
    `The voice: ${PERSONAS[genre]}.`,
    "",
    "The persona is TONE, not dialect (docs/v1-storychange.md). You may color the",
    "captions with the genre's attitude — word choice, rhythm, one epic flourish.",
    "You may NOT:",
    '- use archaic or period dialect ("thou", "aye", "forsooth", "behold")',
    '- rename real things into genre objects (ideas are not "scrolls"; npm install is not "a journey through cursed lands")',
    "- drop a caption's anchors: file names, numbers, and timestamps MUST survive the rewrite verbatim",
    "",
    "Rewrite ONLY these fields, keeping every one within its limit:",
    '- every scene\'s "caption" (max 120 chars, AT MOST 10 WORDS — it is narrated aloud)',
    '- achievement "title" values (max 60 chars; keep each achievement\'s "id" exactly)',
    '- the stats scene\'s "grade" (max 3 chars) if present',
    "",
    "EVERYTHING ELSE IS FROZEN — including every dialogue line \"text\": the user's",
    "and agent's real words are documentary and are verified byte-for-byte. Same",
    "scenes, same order, same types, same targetSec, same title task, same coldOpen,",
    "same events, same artifacts, same verdicts, same counts. Do not add or remove",
    "anything. If you change structure the output is rejected by a machine, not a",
    "person — there is no partial credit.",
    "",
    "Recognition first, comedy second: the viewer lived this session, and every",
    "caption must still point at the real moment it narrates.",
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
    "Fix every issue. Remember: only captions, achievement titles and grade may",
    "differ from the input screenplay — dialogue text is frozen, and every file",
    "name, number and timestamp in a caption must survive. Output the corrected",
    "JSON only.",
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

    const violations = [
      ...structuralDiff(screenplay, validated.data),
      ...lostCaptionAnchors(screenplay, validated.data),
    ];
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
