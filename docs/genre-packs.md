# Genre packs

A genre pack is a costume for the screenplay. Same story, different world. Packs remain the project's extension seam and its main contribution ramp — but for now there is exactly one: **`classic`**, the reference implementation and permanent fallback. `quest` is removed; the no-genre rewrite (docs/visual-language.md, docs/characters.md) is the single shipped look until a second pack earns its keep.

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

Registration: `registerGenre(pack)` into the registry; selected via `--genre <id>`. `classic` is the reference implementation and permanent fallback — minimal, genre-free, always works, and the template a second pack would copy.

## Writing a pack (contributor path, once genre #2 is worth building)

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

## Punch-up: retired until genre #2

The punch-up pass (rewriting screenplay text in a genre's persona voice, structure frozen and enforced by code — see the old `src/screenwriter/punchup.ts`) only does anything when there's a second voice to punch up *into*. With one pack, there's nothing to differentiate, so the pass is retired rather than kept running a no-op. It returns, unchanged in design, the day a second genre pack ships: same structural-fingerprint enforcement, same frozen dialogue text, same caption-anchor survival rules (docs/v1-storychange.md).

## Extraction status

The `GenrePack` interface above, the registry, and the per-pack composition wiring were built for two packs (`classic` + `quest`, PR #17) and are still in the tree at `remotion/src/packs/` — this doc describes the interface as it exists, not as an aspiration. With `quest` removed and no second pack currently shipping, the abstraction is dormant rather than deleted: `classic` is hardcoded as the one true look for now (docs/visual-language.md), and the registry/interface stay in place as the seam a real genre #2 would plug into, per the project's "abstraction is extracted at the second consumer" rule (CLAUDE.md) — the second consumer already existed once; it isn't currently shipping.

## Planned packs

- **Shipped:** `classic` (reference, permanent fallback).
- **Removed:** `quest` — was the session-as-monster-hunt flagship; retired with the no-genre rewrite.
- **Future:** a second pack revives the extension seam (and punch-up) when one is worth building. Copy `packs/classic/` as the template.
