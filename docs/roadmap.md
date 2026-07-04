# Roadmap

## v1 — three weekends, one great template executed hard

**Weekend 1 — the spine.**

- Collect the fixture corpus: 10–15 real sessions from `~/.claude/projects`, deliberately diverse (clean one-shot fix, long debugging slog, big refactor, Q&A-only, failed session). Redact before committing.
- Parser: JSONL → timeline (turns, tool calls, diffs from Edit/Write payloads, command exit codes), defensive, golden-tested against fixtures. Redaction layer included from the first commit.
- Bare `classic` Remotion composition (chat pane + diff panel), hardcoded — no GenrePack abstraction yet.
- **Exit criterion:** one real session → one ugly-but-real MP4, end to end.

**Weekend 2 — the brain and the polish.**

- Screenwriter: digest generation, beat-pass prompt, screenplay schema + zod validation + repair loop, duration-budget solver, "not enough footage" decline.
- Make the one template genuinely great: cold open, beat-synced cuts, speed ramping, sound design, editorial captions, stats end-card. The polish of this single template is 80% of the whoa.
- Evaluate the screenwriter against every fixture; iterate the prompt like product code.

**Weekend 3 — the ship.**

- CLI packaging (`npx sessionmovie`, `doctor` setup step, format flags, `--list-redactions`).
- Skill packaging (SKILL.md + scripts; Claude in-session as Screenwriter).
- Vertical 9:16 output polish, watermark end card, auto-written post text.
- Launch clip: a movie of Claude building the movie tool. Publish repo + npm + skill.

**v1 feature cut (deliberate):** one genre (`classic`), captions + music (no voiceover), no Lambda rendering, no character sprites if art isn't ready (mascot reactions can ship in v1.1), dialogue scenes can render as styled chat bubbles without sprites.

## v1.1 — the candy (and a content calendar)

Each item is a feature launch = a new movie, made by the tool:

- **`heist` pack** — and with it, extract the real `GenrePack` interface (rule: abstraction is extracted at the second consumer, not before).
- **Characters** — the two-sprite set (user + Claude robot), ~7 emotions each, dialogue scenes go visual-novel.
- **Achievements + grade** on the stats card.
- **`--bloopers` mode.**
- **More packs:** `nature-doc`, `sports-replay`, `horror`. Open the contribution path (pack authoring guide, CC0 asset checklist).

## Later / exploratory

- **Remotion Lambda** rendering (~$0.02–0.05/movie, ~1 min turnaround) for a hosted "paste a transcript, get a movie" web demo.
- **Other agents' transcripts** — Cursor, Windsurf, Claude Agent SDK sessions: new parsers, same pipeline.
- **"Wrapped for your coding agent"** — monthly recap movie (lines shipped, bugs fixed, longest session, achievements) from many transcripts.
- **Real-pixel inserts** — Playwright screenshots / rendered images found in transcripts as real frames.
- **Voiceover** — ElevenLabs narration per genre persona (~$0.10–0.30/min).
- **Shadow-git capture mode** — a Stop-hook snapshotter for bash-driven file changes the transcript can't see (routes through redaction like everything else).

## Non-goals (v1 era)

- No hosted service, no accounts, no uploads — local-first is both the trust story and the scope guard.
- No timeline-scrubbing debugger UI — that's a different product (the Time-Travel Debugger) even though it reads the same data.
- No custom scene types in packs; no scene-vocabulary growth without a doc-updating PR and a very good reason.
