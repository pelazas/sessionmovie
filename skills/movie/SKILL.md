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
