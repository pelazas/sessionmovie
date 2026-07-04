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

## Planned packs

- **v1:** `classic` (reference).
- **v1.1:** `heist` — built second on purpose; extracting the `GenrePack` interface happens here, when its real requirements are known.
- **Then:** `nature-doc`, `sports-replay`, `horror` — and community PRs.
