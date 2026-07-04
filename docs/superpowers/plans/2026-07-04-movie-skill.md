# /movie Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `/movie` Claude Code skill (in-session screenwriter) plus the two CLI additions it needs (`sessionmovie prompt`, `--screenplay`), packaged as a plugin from this repo.

**Architecture:** The CLI grows a `prompt` subcommand (emit the versioned screenwriter prompt for a transcript) and a `--screenplay <file>` render input (skip the LLM stage). The skill is a SKILL.md that drives: locate transcript → `prompt` → in-session Claude writes JSON → render `--screenplay`. Spec: `docs/superpowers/specs/2026-07-04-claude-skill-design.md`.

**Tech Stack:** TypeScript, node:test + tsx, zod (existing), Claude Code plugin manifests.

## Global Constraints

- **No publish, no push**: npm publish (0.2.0) and `git push` are gated on explicit user confirmation. Local commits are fine.
- Redaction, determinism, and the screenplay IR are untouched (spec "Constraints check").
- `npm test` enumerates test files explicitly in package.json — new test files must be added there.
- The prompt template (`src/screenwriter/prompts/v4.md`) is product code — this plan must NOT modify it.
- All existing tests (97) stay green; `npm run typecheck` stays clean.

---

### Task 1: Shared screenwriter surface (`structuralDecline`, `buildScreenwriterPrompt`, `validateScreenwriterJson`)

**Files:**
- Modify: `src/screenwriter/heuristic.ts:66-76`
- Modify: `src/screenwriter/llm.ts` (exports near lines 59-63, 72, 135-136)
- Create: `src/screenwriter/skill-surface.test.ts`
- Modify: `package.json` (test script list)

**Interfaces:**
- Produces: `structuralDecline(timeline: Timeline): { decline: true; reason: string } | null` (heuristic.ts); `buildScreenwriterPrompt(timeline: Timeline, targetDurationSec?: number): string` and `validateScreenwriterJson(json: string): ScreenwriterOutput | { issues: string }` (llm.ts). Tasks 2 and 3 consume these exact names.

- [ ] **Step 1: Write the failing tests**

Create `src/screenwriter/skill-surface.test.ts`:

```ts
/**
 * The three exports the /movie skill path rides on (sessionmovie prompt +
 * --screenplay). Fixtures are the contract: real transcripts in fixtures/raw.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseTranscript } from "../parser/index.js";
import { structuralDecline } from "./heuristic.js";
import { buildScreenwriterPrompt, validateScreenwriterJson } from "./llm.js";

const fixture = (name: string) =>
  parseTranscript(
    readFileSync(join(import.meta.dirname, "..", "..", "fixtures", "raw", name), "utf8"),
  );

test("structuralDecline: null for a session with footage", () => {
  assert.equal(structuralDecline(fixture("feature-build-remotion.jsonl")), null);
});

test("structuralDecline: declines a session with no user prompt", () => {
  const declined = structuralDecline(fixture("code-review-bash-heavy.jsonl"));
  assert.ok(declined);
  assert.match(declined.reason, /no user prompt/);
});

test("buildScreenwriterPrompt: fully interpolated, duration override lands", () => {
  const prompt = buildScreenwriterPrompt(fixture("feature-build-remotion.jsonl"), 57);
  assert.ok(!prompt.includes("{{"), "no template placeholders may survive");
  assert.match(prompt, /\b57\b/);
  assert.ok(prompt.length > 1000, "digest must be embedded");
});

test("validateScreenwriterJson: decline passes through", () => {
  const out = validateScreenwriterJson('{"decline": true, "reason": "too boring"}');
  assert.deepEqual(out, { decline: true, reason: "too boring" });
});

test("validateScreenwriterJson: non-JSON yields issues", () => {
  const out = validateScreenwriterJson("not json at all");
  assert.ok("issues" in out);
  assert.match(out.issues, /not valid JSON/);
});

test("validateScreenwriterJson: invalid screenplay yields per-path issues", () => {
  const out = validateScreenwriterJson('{"version": 1}');
  assert.ok("issues" in out);
  assert.match(out.issues, /- at /);
});
```

Add the file to the test script in `package.json` (append to the existing list):

```
"test": "node --import tsx --test scripts/golden.test.ts src/voiceover/voiceover.test.ts src/voiceover/sync.test.ts src/genre/rules.test.ts src/screenwriter/punchup.test.ts src/screenwriter/skill-surface.test.ts src/quantize.test.ts src/facts/facts.test.ts",
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | grep -E "skill-surface|# fail"`
Expected: failures — `structuralDecline`, `buildScreenwriterPrompt`, `validateScreenwriterJson` are not exported.

- [ ] **Step 3: Implement the three exports**

In `src/screenwriter/heuristic.ts`, above `writeScreenplay` (line 66), add — and make `writeScreenplay` use it (replace its two inline checks at lines 71-76):

```ts
/**
 * Pre-LLM decline: the structural "not enough footage" checks, shared by the
 * heuristic screenwriter and `sessionmovie prompt` (the skill path declines
 * BEFORE the user's session spends effort writing a screenplay).
 */
export function structuralDecline(
  timeline: Timeline,
): { decline: true; reason: string } | null {
  if (timeline.turns.length === 0) {
    return { decline: true, reason: "no user prompt found — nothing to make a movie about" };
  }
  if (timeline.toolCalls.length === 0) {
    return { decline: true, reason: "not enough footage: the session used no tools" };
  }
  return null;
}
```

```ts
export function writeScreenplay(timeline: Timeline): ScreenwriterOutput {
  const declined = structuralDecline(timeline);
  if (declined) return declined;
  // …existing body continues unchanged…
```

In `src/screenwriter/llm.ts`:

1. Below `buildPrompt` (line 63), add:

```ts
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
```

2. Rename `validateOutput` → `validateScreenwriterJson` and export it (update both internal call sites, lines 159 and the `validateOutput` definition at line 72):

```ts
export function validateScreenwriterJson(
  json: string,
): ScreenwriterOutput | ValidationFailure {
```

3. In `writeScreenplayLLMDetailed`, replace lines 135-136 with:

```ts
  const originalPrompt = buildScreenwriterPrompt(timeline, targetDurationSec);
```

(The `digestTimeline` import stays — it is now used by `buildScreenwriterPrompt`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# tests 103`, `# pass 103`, `# fail 0` (97 existing + 6 new). Also run `npm run typecheck` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/screenwriter/heuristic.ts src/screenwriter/llm.ts src/screenwriter/skill-surface.test.ts package.json
git commit -m "feat(screenwriter): export the skill surface — structuralDecline, buildScreenwriterPrompt, validateScreenwriterJson"
```

---

### Task 2: `sessionmovie prompt <transcript>` subcommand

**Files:**
- Create: `src/cli/prompt.ts`
- Modify: `src/cli/bin.ts` (router)
- Modify: `src/cli/movie.ts:43-47` (usage)

**Interfaces:**
- Consumes: `structuralDecline`, `buildScreenwriterPrompt` from Task 1.
- Produces: `sessionmovie prompt <t>` — stdout = full prompt (exit 0); stderr `🎬 no movie: <reason>` (exit 2); usage/read errors (exit 1). Task 4's SKILL.md relies on exactly these exit codes.

- [ ] **Step 1: Create `src/cli/prompt.ts`**

```ts
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
```

- [ ] **Step 2: Route it in `src/cli/bin.ts`**

Replace the router with:

```ts
if (process.argv[2] === "doctor") {
  process.argv.splice(2, 1);
  await import("./doctor.js");
} else if (process.argv[2] === "prompt") {
  process.argv.splice(2, 1);
  await import("./prompt.js");
} else {
  await import("./movie.js");
}
```

- [ ] **Step 3: Extend usage() in `src/cli/movie.ts`**

The usage string gains one line (after the `sessionmovie doctor` line):

```ts
      "       sessionmovie prompt <transcript.jsonl> — print the screenwriter prompt (skill path)\n",
```

- [ ] **Step 4: Smoke-test all three exit paths**

```bash
npx tsx src/cli/prompt.ts fixtures/raw/feature-build-remotion.jsonl | head -3   # prompt text
npx tsx src/cli/prompt.ts fixtures/raw/code-review-bash-heavy.jsonl; echo "exit=$?"  # 🎬 no movie…, exit=2
npx tsx src/cli/prompt.ts; echo "exit=$?"                                        # usage, exit=1
```

Also `npm run typecheck` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/cli/prompt.ts src/cli/bin.ts src/cli/movie.ts
git commit -m "feat(cli): sessionmovie prompt — emit the screenwriter prompt for the skill path"
```

---

### Task 3: `--screenplay <file>` render input

**Files:**
- Modify: `src/cli/movie.ts` (imports line 11, usage line 45, arg loop lines 90-118, screenwriter block lines 137-152)

**Interfaces:**
- Consumes: `validateScreenwriterJson` from Task 1.
- Produces: `sessionmovie <t> --screenplay <file>` — renders (exit 0), relays decline (exit 2), prints zod issues one per line prefixed `- at ` (exit 1). Task 4's SKILL.md repair loop keys off the exit-1 stderr.

- [ ] **Step 1: Wire the flag**

Import (extend line 11): `import { validateScreenwriterJson, writeScreenplayLLMDetailed } from "../screenwriter/llm.js";`

Arg state (next to `let refreshVoices = false;`): `let screenplayFile: string | null = null;`

Arg loop branch (before the final `else if (arg && !arg.startsWith("-"))`):

```ts
  } else if (arg === "--screenplay") {
    const next = args[++i];
    if (!next) usage();
    screenplayFile = next;
```

After the loop, next to `if (!input) usage();`:

```ts
if (screenplayFile && !useLlm) usage(); // contradictory: --screenplay already skips the LLM
```

Usage first line gains `[--screenplay <file>]` after `[--refresh-voices]`.

- [ ] **Step 2: Skip the screenwriter when a screenplay is provided**

Replace `let result;` + the `if (useLlm) { … } else { … }` block with:

```ts
let result;
if (screenplayFile) {
  let screenplayJson = "";
  try {
    screenplayJson = readFileSync(resolve(screenplayFile), "utf8");
  } catch (err) {
    fail(`cannot read --screenplay file: ${err instanceof Error ? err.message : String(err)}`);
  }
  const provided = validateScreenwriterJson(screenplayJson);
  if ("issues" in provided) {
    process.stderr.write(`--screenplay rejected by the schema:\n${provided.issues}\n`);
    process.exit(1);
  }
  result = provided;
  process.stdout.write("   screenwriter: provided via --screenplay\n");
} else if (useLlm) {
  process.stdout.write("   writing screenplay with claude (~1 min; --no-llm for the fast heuristic)…\n");
  const detailed = writeScreenplayLLMDetailed(timeline);
  result = detailed.output;
  process.stdout.write(
    `   screenwriter: ${detailed.source}${detailed.attempts ? ` (${detailed.attempts} attempt${detailed.attempts > 1 ? "s" : ""})` : ""}\n`,
  );
} else {
  result = writeScreenplay(timeline);
}
```

(The existing `if ("decline" in result)` right below already handles a decline JSON → exit 2. Everything downstream — quantize, facts, voiceover, render — is untouched.)

- [ ] **Step 3: Smoke-test the three paths**

```bash
# valid screenplay renders end-to-end (~40s)
npx tsx src/cli/movie.ts fixtures/raw/feature-build-remotion.jsonl \
  --screenplay remotion/src/screenplay/sample.json --out /tmp/skilltest.mp4 && ls -la /tmp/skilltest.mp4

# malformed → issues, exit 1
echo '{"version": 1}' > /tmp/bad.json
npx tsx src/cli/movie.ts fixtures/raw/feature-build-remotion.jsonl --screenplay /tmp/bad.json; echo "exit=$?"

# decline JSON → exit 2
echo '{"decline": true, "reason": "test decline"}' > /tmp/decline.json
npx tsx src/cli/movie.ts fixtures/raw/feature-build-remotion.jsonl --screenplay /tmp/decline.json; echo "exit=$?"
```

Expected: mp4 exists; `- at ` issue lines with exit=1; `🎬 no movie: test decline` with exit=2. Then `npm test` + `npm run typecheck` — green.

- [ ] **Step 4: Commit**

```bash
git add src/cli/movie.ts
git commit -m "feat(cli): --screenplay <file> — render a provided screenplay, skipping the LLM stage"
```

---

### Task 4: The skill (`skills/movie/SKILL.md`)

**Files:**
- Create: `skills/movie/SKILL.md`

**Interfaces:**
- Consumes: `sessionmovie prompt` (Task 2 exit codes), `--screenplay` (Task 3 exit codes), `npx sessionmovie@latest` (published 0.2.0 — until then, test with local `npx tsx src/cli/…`).

- [ ] **Step 1: Write `skills/movie/SKILL.md`**

````markdown
---
name: movie
description: Turn a Claude Code session into a 45-60s rendered movie. Use when the user types /movie or asks for a movie, film, or video of this session or of a session transcript.
---

# /movie — a movie of this session

You are the screenwriter. The CLI parses, redacts, validates, and renders; you
write the screenplay JSON from a digest it gives you. Never write screenplay
content from memory of the session — always work from the emitted prompt.

## 1. Find the transcript

- If the user named a transcript path, use it.
- Otherwise use the current session's transcript — the most recently modified
  `.jsonl` for this project:

  ```bash
  ls -t ~/.claude/projects/$(pwd | sed 's|[/.]|-|g')/*.jsonl | head -1
  ```

- If nothing is found, say where you looked and ask for a path. Do not guess.

## 2. Screenplay (you, in-session)

```bash
npx sessionmovie@latest prompt <transcript>
```

- Exit 2 → relay the decline reason verbatim (it starts with `🎬 no movie:`) and
  stop. Do not retry, do not lower standards — the quality floor is a feature.
- Otherwise: follow the printed prompt exactly and write the JSON it asks for to
  a temp file (e.g. `/tmp/screenplay.json`). Do not paste the JSON into chat; a
  one-line summary ("6 scenes, 52s") is plenty.

## 3. Render

If this machine has never rendered before, warn the user: the first render
downloads a ~150 MB headless browser (one time).

```bash
npx sessionmovie@latest <transcript> --screenplay /tmp/screenplay.json --out <slug>.mp4
```

- Exit 1 with `- at <path>: <message>` lines → fix exactly those issues in your
  JSON and retry. Maximum 2 repair rounds; after that fall back to
  `npx sessionmovie@latest <transcript>` (full-auto) so the user still gets a movie.
- Render failure (not validation) → run `npx sessionmovie@latest doctor`, relay
  its output honestly, and follow its fix hints.

## 4. Deliver

- Print the mp4 path and the CLI's closing stats line.
- Voiceover: only when the user explicitly asked for it AND `ELEVENLABS_API_KEY`
  is set — add `--voiceover` to the render. Never enable it unasked (it spends
  the user's ElevenLabs credit). Asked but no key → point at the README's
  "Voiceover (optional)" section and render without.
````

- [ ] **Step 2: Dry-run the instructions manually**

Follow the SKILL.md steps by hand in this repo (using `npx tsx src/cli/prompt.ts` and `npx tsx src/cli/movie.ts` as local stand-ins for `npx sessionmovie@latest`): locate this session's transcript, generate the prompt, write a screenplay, render it. Expected: an mp4 of the current session.

- [ ] **Step 3: Commit**

```bash
git add skills/movie/SKILL.md
git commit -m "feat(skill): /movie — in-session screenwriter over the sessionmovie CLI"
```

---

### Task 5: Plugin + marketplace manifests

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `.claude-plugin/marketplace.json`

**Interfaces:**
- Produces: installable plugin — `/plugin marketplace add pelazas/sessionmovie` then `/plugin install sessionmovie@sessionmovie`. Skills in `skills/` are auto-discovered (docs: code.claude.com/docs/en/plugins.md).

- [ ] **Step 1: Create `.claude-plugin/plugin.json`**

```json
{
  "name": "sessionmovie",
  "description": "Turn a Claude Code session into a 45-60s rendered movie — /movie films the current session.",
  "version": "0.2.0",
  "author": { "name": "Carlos Pelazas" },
  "homepage": "https://github.com/pelazas/sessionmovie",
  "repository": "https://github.com/pelazas/sessionmovie",
  "license": "MIT"
}
```

- [ ] **Step 2: Create `.claude-plugin/marketplace.json`**

```json
{
  "name": "sessionmovie",
  "description": "sessionmovie — movies of Claude Code sessions",
  "owner": { "name": "Carlos Pelazas" },
  "plugins": [
    {
      "name": "sessionmovie",
      "source": "./",
      "description": "Turn a Claude Code session into a 45-60s rendered movie — /movie films the current session."
    }
  ]
}
```

- [ ] **Step 3: Validate JSON + commit**

```bash
node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf8')); JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json','utf8')); console.log('manifests parse')"
git add .claude-plugin
git commit -m "feat(plugin): marketplace + plugin manifests — repo is its own marketplace"
```

---

### Task 6: Version 0.2.0, build, tarball verification (NO publish)

**Files:**
- Modify: `package.json` (version)

- [ ] **Step 1: Bump version**

`"version": "0.1.0"` → `"version": "0.2.0"` in package.json.

- [ ] **Step 2: Full local gate**

```bash
npm run typecheck && npm test && npm run build
```

Expected: clean, 103/103, build success.

- [ ] **Step 3: Tarball end-to-end (the 0.1.0 lesson: always test the tarball)**

```bash
SCRATCH=<scratchpad dir>
npm pack --pack-destination "$SCRATCH"
cd "$SCRATCH/pack-test" && npm install "$SCRATCH/sessionmovie-0.2.0.tgz"
# new surface through the installed bin:
./node_modules/.bin/sessionmovie prompt <repo>/fixtures/raw/feature-build-remotion.jsonl | head -3
./node_modules/.bin/sessionmovie <repo>/fixtures/raw/feature-build-remotion.jsonl \
  --screenplay <repo>/remotion/src/screenplay/sample.json --out ./skill-e2e.mp4
```

Expected: prompt text prints; mp4 renders. **Do not `npm publish` — user gate.**

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: 0.2.0 — prompt subcommand + --screenplay for the /movie skill"
```
