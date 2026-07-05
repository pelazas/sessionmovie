# sessionmovie 🎬

**Turn your Claude Code session into a 45–60 second movie.**

Your agent just spent two hours hunting a bug — exploring files, failing tests, finding the fix. That session has a story arc: struggle, insight, resolution. `sessionmovie` reads the transcript and renders it as a snappy, beat-synced, shareable film. No screen recording. No editing. One command.

```
you:    /movie
claude: 🎬 rendering "the-login-bug.mp4" ... done (58s, 9 files, +412/−118)
```

> **Status: v0.1 on npm** (`npx sessionmovie`). The design docs in [docs/](docs/) remain the source of truth for what's built next. Every feature launch ships with a movie of the feature being built — made by the tool, obviously.

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

There's no genre costume — one look, dark terminal canvas with a coral accent (see [docs/visual-language.md](docs/visual-language.md)). Title card, plainly stated (no cold open) → a few rounds of dialogue → one real artifact each, one code window / terminal / stat card chrome shared by every scene → an optional showcase of the biggest edit when the session earned one → a stats card built from real numbers: *"2h 14m → 58s. 9 files. +412/−118."*

Dialogue scenes star two pixel-art characters — you and Claude — with real (condensed) lines from the session and an emotion picked per beat. The agent is an original pixel-art homage to Claude Code; you're the same rig topped with your own GitHub avatar, pixelated and tinted to match. See [docs/characters.md](docs/characters.md).

## Genre packs — a future extension point

`classic` is the only shipped pack and the permanent fallback; there's currently no second genre to pick between. The `GenrePack` interface (a costume: React components + a music track + an SFX map + a caption persona) stays in the tree as the seam a future pack would plug into — see [docs/genre-packs.md](docs/genre-packs.md).

## Usage

```bash
npx sessionmovie doctor                        # first-run check (downloads the render browser once)
npx sessionmovie path/to/session.jsonl         # vertical, ~50s, no genre to pick
npx sessionmovie session.jsonl --no-llm        # fast heuristic screenwriter, no claude call
```

Claude Code transcripts live in `~/.claude/projects/<project>/*.jsonl`. The screenwriter step shells out to your existing `claude` CLI — no API key needed; `--no-llm` skips it entirely.

The Claude Code skill (`/movie` — movie of the current session) is the planned distribution: CLI first, skill as a thin wrapper — so any agent with transcripts is a future market.

### Voiceover (optional)

Narration via ElevenLabs, on your own API key, of **dialogue lines only** — title/action/stats scenes stay silent (see [docs/audio.md](docs/audio.md)). Off by default — nothing calls ElevenLabs unless you pass `--voiceover`.

```bash
export ELEVENLABS_API_KEY=sk_...   # from elevenlabs.io → Developers → API keys
npx sessionmovie doctor            # validates the key before you spend a render on it
npx sessionmovie session.jsonl --voiceover
```

**Key permissions matter.** A default full-access key just works. If you create a *restricted* key, it needs at least **Text to Speech** (synthesis) and **Voices: Read** (what `doctor` probes) — a fresh key that fails doctor with `HTTP 401` is almost always missing scopes, not a bad key.

Knobs: `ELEVENLABS_VOICE_ID` forces one voice everywhere, `ELEVENLABS_MODEL` picks the TTS model. Per-speaker `ELEVENLABS_VOICE_USER`/`ELEVENLABS_VOICE_CLAUDE` arrive with the dialogue-only voiceover rewrite (docs/audio.md); until then, the single voice applies to everything. Synthesized audio is cached content-addressed, so re-renders of the same screenplay don't re-bill. Cost: roughly $0.10–0.30 per movie-minute of narration.

## Docs

| Doc | What's in it |
|---|---|
| [architecture.md](docs/architecture.md) | The four-stage pipeline and why the boundaries sit where they sit |
| [screenplay-format.md](docs/screenplay-format.md) | The genre-neutral JSON IR — the project's load-bearing contract |
| [genre-packs.md](docs/genre-packs.md) | The GenrePack interface — a dormant extension point until a second pack ships |
| [visual-language.md](docs/visual-language.md) | The no-genre look, the shared panel chrome, the energy kit, the stats card |
| [audio.md](docs/audio.md) | Music/SFX rules (CC0, beat grids) and the dialogue-only ElevenLabs voiceover design |
| [characters.md](docs/characters.md) | The two puppet characters — pixel-art mascot homage, avatar-head user, shared clip rig |
| [v1-storychange.md](docs/v1-storychange.md) | Recognition first, dialogue is documentary, persona = tone, one voice at a time |
| [distribution-and-cost.md](docs/distribution-and-cost.md) | CLI vs. skill, cost model, first-run UX |
| [security-and-privacy.md](docs/security-and-privacy.md) | Secret redaction — a v1 blocker, not a nice-to-have |
| [roadmap.md](docs/roadmap.md) | The three-weekend v1 plan and the v1.1 candy |

## License & credits

MIT. Bundled music/SFX are CC0 only, tracked in `CREDITS.md`.

Note: [Remotion has its own license](https://remotion.dev/license) — free for individuals and companies of up to 3 people; larger companies need a Remotion company license to render.
