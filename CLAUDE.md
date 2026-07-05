# CLAUDE.md

sessionmovie turns a Claude Code session transcript (JSONL) into a 45–60s rendered movie via Remotion. Read `docs/architecture.md` before touching pipeline code; `docs/screenplay-format.md` defines the contract everything hangs off.

## Project status

Pre-v1, docs-first. The design in `docs/` is the source of truth until code exists; when code and docs disagree, flag it — don't silently pick one.

## Hard constraints (not preferences)

- **Secret redaction is a v1 blocker.** Every string that can reach a rendered frame must pass through the redaction layer (secret-pattern regexes + entropy detection + path/username scrubbing). Never add a render path that bypasses it. See `docs/security-and-privacy.md`.
- **Determinism in compositions.** No `Math.random()`, `Date.now()`, or `new Date()` inside Remotion components — frames render across threads and nondeterminism causes flicker. Use Remotion's seeded `random()`. Same session + same screenplay must produce a bit-identical movie.
- **The screenplay IR is a closed, versioned contract.** Scene vocabulary is fixed (`title | dialogue | action | showcase | stats`). Do not add scene types or emotion enum values casually — every scene type multiplies work for every genre pack. Schema changes require updating `docs/screenplay-format.md` in the same PR.
- **Zod-validate all LLM output** (screenplays) at the boundary; repair/retry on failure. Never trust raw model JSON downstream.
- **CC0 assets only.** Any bundled music/SFX/sprite must be redistributable (CC0) and listed in `CREDITS.md` in the same PR that adds it. "Royalty-free" is not sufficient — verify redistribution rights.
- **Dialogue lines are condensed, never verbatim** — max ~90 chars, enforced in the schema.

## Architecture boundaries (see docs/architecture.md)

- Parser → Screenwriter → GenrePack → Remotion. Data flows one way.
- The screenplay is **genre-neutral**; genre flavor (captions, dialogue voice) is a separate cheap punch-up pass, so re-rendering in another genre never re-runs beat analysis.
- Genre packs implement a renderer for **every** scene type. `classic` is the reference pack and permanent fallback — it must always work.
- Do not build speculative abstraction: `classic` was deliberately built hardcoded first; extract shared interfaces only when a second consumer exists.

## Testing approach

- Parser and screenwriter are developed against `fixtures/` — real session transcripts (diverse: one-shot fix, long debugging slog, big refactor, Q&A-only, failed session). Fixtures are golden tests for the parser and the eval set for screenwriter prompt changes.
- The transcript format is **undocumented and shifts between Claude Code versions**. Parse defensively: unknown event types are skipped with a debug log, never a crash.
- Boring sessions (no edits, few turns) must be detected and declined gracefully ("not enough footage") — never render a bad movie. The quality floor is a feature.
- The screenwriter prompt is product code: version it, and re-run against all fixtures when changing it.

## Conventions

- TypeScript throughout. CLI is the product (`npx sessionmovie`); the Claude Code skill is a thin adapter over it.
- Prefer boring, explicit code in the parser (it eats untrusted, shifting input); save cleverness for compositions.

## Orchestration workflow (subagents)

Two project subagents live in `.claude/agents/`. Split work by whether the thinking is already done:

- **`deep-reasoner`** (opus, write-capable) — dispatch *before* touching code for reasoning-heavy work: implementation plans, architecture decisions, debugging complex or intermittent issues, algorithmic design. It returns a conclusion and a numbered plan; it edits only when explicitly dispatched to fix, apply review findings, or resolve conflicts — large mechanical build-outs still go to the executor.
- **`executor`** (sonnet, write access) — dispatch for mechanical, well-specified work: boilerplate, tests following an existing pattern, formatting, renames, simple edits. Give it exact instructions and the pattern to copy; it escalates ambiguity instead of improvising design decisions.
- Typical flow for nontrivial features: `deep-reasoner` plans → you review the plan against the hard constraints above → hand discrete steps to `executor` (in parallel when independent) → you verify the integrated result.
- Don't delegate what doesn't pay for the handoff: one-line edits and quick lookups you do yourself.
- Anything touching a hard constraint (redaction paths, screenplay IR schema, determinism) you verify personally — never accept a subagent's report on those unchecked.
