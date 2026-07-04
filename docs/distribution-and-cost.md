# Distribution & cost

## CLI first, skill as a thin wrapper

The product is a standalone CLI; the Claude Code skill is a small adapter over it.

```bash
npx sessionmovie <session.jsonl> [--genre classic] [--format 9x16|1x1|16x9] [--bloopers]
npx sessionmovie doctor      # setup: node deps, headless browser, asset check
```

Why this split:

- npm **and** skill-marketplace distribution from one codebase.
- Any agent with transcripts (Cursor, Windsurf, custom SDK agents) is a future market via new parsers — the pipeline after the parser is agent-agnostic.
- A CLI is testable; a skill is not, easily.

## The skill (the magic distribution vector)

Inside a skill, **Claude in-session is the Screenwriter** — no API key, no server, no marginal LLM cost. The intelligence comes from the session the user already pays for.

Flow:

1. User finishes a session, types `/movie` (or asks for one).
2. Skill script locates the transcript in `~/.claude/projects/.../<session>.jsonl`, runs the parser/digest.
3. Claude — in-session — writes the screenplay JSON (beat pass + punch-up pass).
4. Script runs `npx remotion render` on the bundled composition with the screenplay as props → MP4, preview shown.

The demo is self-referential in the best way: **"Claude, make a movie of what you just did."**

## Cost per movie

| Stage | Via API (CLI standalone) | As a Claude Code skill |
|---|---|---|
| Parse + digest | free (local) | free |
| Screenwriter | ~$0.10–0.30 (Sonnet on a 20–80k-token digest) | **$0 marginal** (user's existing plan) |
| Remotion render (60s, 1080p) | ~$0.02–0.05 on Remotion Lambda | **$0** (local CPU, 2–10 min) |

Two structural reasons it's this cheap: the model never reads the raw transcript (digest only, judgment only), and rendering is deterministic code-driven video — no generative-video costs, ever. Optional later: ElevenLabs voiceover at ~$0.10–0.30/min. v1 is captions + music.

**End-to-end time per movie:** digest + screenplay ~1–2 min, local render ~2–10 min depending on machine. Under 10 minutes total; ~1 min if Remotion Lambda is added later.

## First-run UX (a real risk)

Remotion pulls a headless browser on first render — potentially minutes of downloading before any magic. Mitigations:

- `doctor`/setup is a separate explicit step with honest progress output; the skill runs it with clear messaging on first use.
- `render` never silently blocks on downloads; if setup is missing it says so and points at `doctor`.
- First impressions are the whole game for a tool whose pitch is "one command → movie."

## Licensing

- Project: MIT.
- Bundled assets: CC0 only, tracked in `CREDITS.md` (see genre-packs.md rules).
- **Remotion:** free for individuals and companies up to 3 people; larger companies need a Remotion company license to render. That obligation is the user's, but the README states it plainly.
