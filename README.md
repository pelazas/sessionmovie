# sessionmovie 🎬

**Turn your Claude Code session into a 45–60 second movie.**

Your agent just spent two hours hunting a bug — exploring files, failing tests, finding the fix. That session has a story arc: struggle, insight, resolution. `sessionmovie` reads the transcript and renders it as a snappy, beat-synced, shareable film. No screen recording. No editing. One command.

```
you:    /movie
claude: 🎬 rendering "the-login-bug.mp4" ... done (58s, 9 files, +412/−118)
```

> **Status: pre-v1.** The design is complete (see [docs/](docs/)); the code is being built in public. Every feature launch ships with a movie of the feature being built — made by the tool, obviously.

## How it works

There is no screen capture. Every frame is **motion graphics rendered from transcript data** — a stylized reconstruction of the session, like the replay screen in a sports game:

```
transcript JSONL
  → Parser        deterministic: events, diffs, test results (+ secret redaction)
  → Screenwriter  LLM: picks the beats, writes a screenplay (genre-neutral JSON IR)
  → Genre pack    strategy: renders the screenplay in its visual style
  → Remotion      React-driven video → MP4
```

Because frames come from data, not pixels: crisp typography at any resolution, vertical 9:16 that actually works, and total control of time — two hours compress into sixty seconds because we animate *events*, not video.

As a **Claude Code skill**, the LLM step runs inside your existing session — no API key, no server, no marginal cost. Rendering is local CPU via [Remotion](https://remotion.dev). A movie costs approximately **$0**.

## What the movie looks like

Cold open on the most dramatic moment (`17 tests failing`) → *"2 hours earlier…"* → title card → hyper-fast exploration montage, tool chips machine-gunning past → first fix attempt → tests **RED**, record-scratch → tempo drops, the key line of code enlarges, slow-motion → the real fix types in character by character → green cascade with a level-up sound → stats card: *"2h 14m → 58s. 9 files. +412/−118. Achievement: Rage Quit Averted."*

Dialogue scenes star two characters — you and Claude — visual-novel style, with real (condensed) lines from the session and expressions picked per beat. See [docs/visual-language.md](docs/visual-language.md).

## Genre packs

The same session, rendered as:

- 🕶️ **Heist** — *"THE JOB: 1 bug. 9 files. 47 minutes."*
- 🌿 **Nature documentary** — *"Here we observe the agent, reading the same file for the fourth time. It has not lost hope."*
- 🏟️ **Sports replay** — two commentators in the booth: *"he's going for the regex, Dave — bold choice."*
- 👻 **Horror** — for the debugging sessions you'd rather forget.

Genres are a strategy pattern over a fixed screenplay format: a pack is React components + a music track + an SFX map + a caption persona. Writing one is the fun, shallow-ramp way to contribute — see [docs/genre-packs.md](docs/genre-packs.md).

## Planned usage

```bash
# CLI (the product)
npx sessionmovie path/to/session.jsonl            # classic pack, vertical 58s
npx sessionmovie --genre heist --bloopers         # replay value

# Claude Code skill (the distribution)
/movie                                            # movie of the current session
```

CLI first, skill as a thin wrapper — so any agent with transcripts is a future market.

## Docs

| Doc | What's in it |
|---|---|
| [architecture.md](docs/architecture.md) | The four-stage pipeline and why the boundaries sit where they sit |
| [screenplay-format.md](docs/screenplay-format.md) | The genre-neutral JSON IR — the project's load-bearing contract |
| [genre-packs.md](docs/genre-packs.md) | The GenrePack interface and how to write one |
| [visual-language.md](docs/visual-language.md) | Footage philosophy, the energy kit, characters, the stats card |
| [distribution-and-cost.md](docs/distribution-and-cost.md) | CLI vs. skill, cost model, first-run UX |
| [security-and-privacy.md](docs/security-and-privacy.md) | Secret redaction — a v1 blocker, not a nice-to-have |
| [roadmap.md](docs/roadmap.md) | The three-weekend v1 plan and the v1.1 candy |

## License & credits

MIT. Bundled music/SFX are CC0 only, tracked in `CREDITS.md`.

Note: [Remotion has its own license](https://remotion.dev/license) — free for individuals and companies of up to 3 people; larger companies need a Remotion company license to render.
