# Genre packs

A genre pack is a costume for the screenplay. Same story, different world. Packs are the project's plugin surface and its main contribution ramp — the core is hard, a pack is fun.

## The contract

A pack must render **every** scene type. That's what keeps packs interchangeable and the screenwriter genre-blind.

```ts
interface GenrePack {
  id: string
  name: string
  components: Record<SceneType, React.FC<SceneProps>>  // title | dialogue | action | showcase | stats
  theme: ThemeTokens          // palette, fonts, transition style
  audio: {
    track: AudioAsset         // CC0 only, listed in CREDITS.md
    beatGrid: number[]        // precomputed beat timestamps; cuts snap to these
    sfx: Record<SfxEvent, AudioAsset>  // typing, chip-tick, fail-scratch, pass-chime, ...
  }
  captionPersona: string      // prompt fragment for the punch-up pass — the genre's voice
  pacing: PacingRules         // scene duration clamps, cut aggressiveness
}
```

Registration: `registerGenre(pack)` into the registry; selected via `--genre <id>`. `classic` is the reference implementation and permanent fallback — minimal, genre-free, always works, and the template new packs copy.

## A genre decides what a scene *is*

The screenplay says `dialogue`; the pack decides what that means in its world:

| Scene | classic | heist | sports replay | nature documentary | horror |
|---|---|---|---|---|---|
| `title` | clean typographic card | *"THE JOB: 1 bug. 9 files. 47 min."* | matchday graphics | episode title over landscape | grainy warning card |
| `dialogue` | speech bubbles, editor backdrop | dim planning-table scene | commentary booth, two pundits | subtitled field observations | flashlight-lit exchanges |
| `action` | tool-chip montage | slick multi-cam prep montage | play-by-play with telestrator arrows | time-lapse of the habitat | tense corridor cuts |
| `showcase(fail)` | red flash, record scratch | alarm trips, plan interrupted | slow-mo replay of the miss | *"the hunt fails. the pack goes hungry."* | jump scare |
| `stats` | stat card + achievements | *"CLEAN GETAWAY"* debrief | full-time scoreboard | end-of-episode narration | survivor card |

The `captionPersona` carries the voice: deadpan Attenborough for nature-doc (*"here we observe the agent, reading the same file for the fourth time. it has not lost hope."*), clipped Ocean's-Eleven cool for heist, breathless pundits for sports.

## Writing a pack (contributor path)

1. Copy `packs/classic/`.
2. Replace the five scene components (theme tokens do most of the visual lifting).
3. Pick a CC0 track, precompute its `beatGrid` (script provided), map the SFX events. Add entries to `CREDITS.md`.
4. Write the `captionPersona` — the fun part. Test it with the punch-up pass on the fixture screenplays.
5. Set `pacing` clamps. Render all fixtures; every scene type must render acceptably.

Rules:

- **CC0 assets only**, verified redistributable, credited. PRs with unverifiable licenses are rejected regardless of quality.
- Packs restyle; they never restructure. Scene order, timings, and emotions come from the screenplay.
- No new scene types. The escape hatch (post-v1) is an optional `custom` scene with a mandatory fallback rendering.
- Determinism rules apply (seeded `random()` only).

## Genre selection — who picks, and how

Two layers, deliberately separate:

**Layer 1 — deterministic default (CLI, no LLM).** `Timeline.totals` is a session fingerprint; a rules table evaluated top-down, first match wins:

| Session shape (from totals) | Auto genre | Why |
|---|---|---|
| `failedCommands ≥ 3`, final command green | `quest` | the comeback story — battles lost, war won |
| `failedCommands ≥ 3`, ends red | `horror` | it never worked |
| clean run (0 failures), files touched | `heist` | in, out, nobody saw us |
| read-heavy (reads ≫ edits), long duration | `nature-doc` | observing the agent forage |
| everything else | `classic` | the reference look |

Rules are code, testable: each fixture's golden pins its auto-genre, so a rules change shows up as a reviewed diff. Until a pack ships, its rule falls through to `classic`.

**Layer 2 — overrides.** `--genre <id>` always wins. Optionally the screenwriter *suggests* a genre during the beat pass (it's the only thing that has read the story) — the suggestion travels as a **sidecar next to the screenplay, never inside it**: the screenplay stays genre-neutral so re-rendering in another genre never re-runs analysis.

## Extraction status (honest)

Today there is one hardcoded pack (`classic`) — deliberate, per the "extract at genre #2" guardrail. The seams are ready: one dispatch switch in `Classic.tsx`, all styling via `theme.ts`, audio as a self-contained layer. Building `quest` performs the extraction: `packs/<id>/` + registry, one `<Composition>` per pack in Root, `--genre` in the CLI, and **a shared per-scene timing module** that scenes and audio both read (killing the mirrored constants in `audio/events.ts` — the one real extraction hazard, flagged in-code).

## Planned packs

- **v1:** `classic` (reference). ✅ shipped
- **Next:** `quest` — the flagship: the session as a monster hunt, the two characters (see characters.md) center stage, failures as bosses. Built second on purpose; the GenrePack extraction happens here. The metaphor is a rendering decision: `action` events = attacks, `showcase(fail)` = the boss lands a hit, `showcase(pass)` = boss defeated, `dialogue` = campfire, `stats` = victory screen with loot.
- **Then:** `heist`, `nature-doc`, `horror`, `sports-replay` — and community PRs.
