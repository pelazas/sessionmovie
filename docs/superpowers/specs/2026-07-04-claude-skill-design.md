# /movie Claude Code skill — design

**Date:** 2026-07-04
**Status:** approved
**Scope:** the skill + the two CLI additions it needs + plugin packaging. Publishing (npm 0.2.0, git push, marketplace announce) is explicitly gated on user confirmation.

## Problem

The skill is the distribution vector (docs/distribution-and-cost.md): "Claude, make a movie
of what you just did." The docs' design has **in-session Claude as the Screenwriter** — no
nested `claude -p`, no marginal LLM cost, and the screenwriter has full memory of the
session it is dramatizing. The published CLI (0.1.0) only supports the full-auto path where
it spawns `claude -p` itself.

## Decision

In-session screenwriter, distributed as a plugin from this repo. Confirmed with the user
against two alternatives:

- **Thin wrapper** (skill just runs `npx sessionmovie <t>`): zero new code but nests a
  fresh `claude -p` conversation inside a session — slower, context-blind, double-bills
  the digest.
- **Separate plugin repo**: two repos to sync for one markdown file.

## Design

### 1. CLI: `sessionmovie prompt <transcript>` (new subcommand)

- `bin.ts` router gains `prompt` (alongside `doctor`); new `src/cli/prompt.ts`.
- Flow: read + parse transcript → structural decline check (same pre-LLM logic the
  pipeline uses; decline exits 2 with the reason) → print the complete screenwriter
  prompt to stdout.
- The prompt is built by a new export in `llm.ts` — `buildScreenwriterPrompt(timeline)` —
  which wraps the existing private `digestTimeline` + `prompts/v4.md` template +
  `DEFAULT_TARGET_DURATION_SEC` interpolation. `writeScreenplayLLMDetailed` switches to
  the same export internally, so the CLI's `claude -p` path and the skill path can never
  drift: one prompt, one source of truth.
- The emitted prompt already carries the decline contract (`DeclineSchema`): in-session
  Claude may answer with `{"decline": …}` exactly like `claude -p` does today.

### 2. CLI: `sessionmovie <transcript> --screenplay <file>` (new flag)

- Skips the screenwriter block in `movie.ts`; everything downstream is untouched and
  already validates at the render boundary.
- Accepts the same output contract as the LLM stage (mirrors `validateOutput`):
  - decline JSON → `🎬 no movie: <reason>`, exit 2;
  - valid screenplay → render;
  - anything else → the zod issues printed one per line (`- at <path>: <message>`),
    exit 1. That stderr is the skill's repair-loop signal.
- `--screenplay` and `--no-llm` together is a usage error (contradictory intents).
- Constraint note: nothing unvalidated reaches `--props` — the existing re-validation at
  the render boundary is the gate, unchanged.

### 3. The skill (`skills/movie/SKILL.md`)

Frontmatter: `name: movie`, description triggering on "make a movie of this session",
`/movie`, "sessionmovie". Body instructs in-session Claude to:

1. **Locate the transcript**: most-recently-modified `*.jsonl` in
   `~/.claude/projects/<cwd-slug>/` (that is the current session; verified). A
   user-supplied path or session reference overrides.
2. **First-use**: before the first render, warn that a first run downloads a headless
   browser (~150 MB). Do not run `doctor` preemptively; run it when a render fails and
   relay its output honestly (never a silent multi-minute hang).
3. **Screenplay**: run `npx sessionmovie prompt <t>`; follow the emitted prompt; write
   the JSON to a temp file. Exit 2 from `prompt` → relay the decline verbatim and stop.
4. **Render**: `npx sessionmovie <t> --screenplay <file> --out <slug>.mp4`. On
   validation failure, fix the listed issues and retry — max 2 repairs, then fall back to
   plain `npx sessionmovie <t>` so the user still gets a movie.
5. **Deliver**: print the mp4 path + the CLI's stats line. Voiceover only when the user
   explicitly asks AND `ELEVENLABS_API_KEY` is set (never auto-spend); if asked without a
   key, point at the README's voiceover section.

**v1 scope cut (matches roadmap):** auto-picked genre, no genre punch-up pass in-session
(classic needs none; punch-up in-session is v1.1).

### 4. Packaging (plugin from this repo)

```
.claude-plugin/marketplace.json   # this repo is a marketplace (one entry)
.claude-plugin/plugin.json        # name: sessionmovie
skills/movie/SKILL.md
```

Install: `/plugin marketplace add pelazas/sessionmovie` → `/plugin install sessionmovie`.
The skill invokes `npx sessionmovie@latest`, so CLI and plugin update independently.
CLI version gate: the skill needs `prompt`/`--screenplay`, which ship in **0.2.0**.

## Error handling

| Case | Behavior |
|---|---|
| No transcript found | Say where it looked; ask for a path |
| Boring session (exit 2) | Relay "not enough footage" verbatim; no retry |
| Screenplay rejected twice | Fall back to full-auto CLI |
| Render failure | Point at `sessionmovie doctor`; relay output |
| Voiceover asked, no key | README voiceover section; render without |

## Testing

- Unit: `buildScreenwriterPrompt` — emitted prompt contains the digest and the duration
  constant; `writeScreenplayLLMDetailed` uses it (no drift); the `prompt` command declines
  a boring fixture with exit 2.
- E2E smoke: `--screenplay` with the canonical sample renders; a malformed screenplay
  prints zod issues and exits 1; a decline JSON exits 2.
- Skill: dogfood `/movie` on this repo's own session — which is also the launch demo.

## Constraints check (CLAUDE.md)

- Screenplay IR untouched (v1 schema, closed vocabulary; the skill writes to it, adds nothing).
- Redaction untouched: the emitted digest is built from the post-redaction timeline — the
  same text `claude -p` receives today.
- No composition changes → determinism untouched. No new assets.
