# Architecture

The pipeline is a film-studio chain. Each stage has one job, data flows one way, and the screenplay JSON in the middle is the load-bearing contract.

```
transcript JSONL
  → Parser        (deterministic)
  → Screenwriter  (LLM)
  → Genre pack    (strategy)
  → Remotion      (render)
```

## Stage 1 — Parser (deterministic, no LLM)

Input: a Claude Code session transcript (`~/.claude/projects/<project>/<session>.jsonl`).

Output: a structured **timeline** of events — turns, messages, tool calls (with inputs/outputs), file mutations, command runs with exit codes, test results.

Responsibilities:

- **Defensive parsing.** The transcript format is undocumented and shifts between Claude Code versions. Unknown event types are skipped with a debug log, never a crash. Developed against `fixtures/` golden tests, not live-format assumptions.
- **Diff reconstruction without snapshots.** Edit/Write tool calls carry old/new content in the transcript, so file evolution is reconstructed from tool calls alone — no shadow-git needed for v1. (Bash-driven file changes are invisible; acceptable v1 scope, documented limitation.)
- **Secret redaction.** Runs here, at the door — see `security-and-privacy.md`. Nothing unredacted flows downstream.
- **Digest generation.** The raw transcript can be hundreds of thousands of tokens. The parser emits a compressed digest (per-turn metadata, message summaries, files touched, diff sizes, exit codes) so the Screenwriter reads ~20–80k tokens, never the raw log.

## Stage 2 — Screenwriter (the only LLM stage)

Input: the digest. Output: a **screenplay** — genre-neutral JSON conforming to the schema in `screenplay-format.md`.

The Screenwriter does judgment work only:

- Finds the narrative arc (struggle → insight → resolution) in the turn data.
- Picks which turns are beats and which get montaged or cut.
- Condenses real messages into punchy dialogue lines (≤ ~90 chars) with an emotion per line.
- Assigns scene types and target durations within the total duration budget.
- Detects "not enough footage" (boring/Q&A-only sessions) and declines instead of forcing a bad movie.

Two-pass design:

1. **Beat pass (expensive, genre-neutral):** analysis → screenplay. Cached per session.
2. **Punch-up pass (cheap, genre-specific):** rewrites captions/dialogue in the genre's voice using the pack's `captionPersona`. Re-rendering the same session in a new genre re-runs only this pass.

Output is zod-validated with a repair loop — the model retries on schema mismatch. Inside the Claude Code skill, Claude in-session *is* the Screenwriter (zero marginal cost); the CLI can alternatively call the API.

The Screenwriter prompt is product code: versioned, and evaluated against every fixture on change.

## Stage 3 — Genre pack (the strategy pattern)

A genre pack renders the screenplay in its style. It must implement a renderer for **every** scene type — that contract is what keeps packs interchangeable:

```ts
interface GenrePack {
  id: string                                        // 'classic' | 'heist' | 'nature-doc' | ...
  components: Record<SceneType, React.FC<SceneProps>>
  theme: ThemeTokens                                // colors, fonts, transitions
  audio: { track: AudioAsset; beatGrid: number[]; sfx: Record<SfxEvent, AudioAsset> }
  captionPersona: string                            // prompt fragment: the genre's voice
  pacing: PacingRules                               // scene duration clamps, cut style
}
```

Packs register into a registry (`registerGenre(heistPack)`); the CLI selects by `--genre`. A pack decides *what a scene type is* in its world: a `dialogue` scene is a dim planning table in heist, a commentary booth in sports-replay, subtitled field observations in nature-doc. The screenwriter never knows genres exist.

`classic` is the reference pack and permanent fallback: minimal, genre-free, always works.

## Stage 4 — Remotion render

Scenes become a Remotion `<Series>`; durations snap to the pack's music beat grid. Output MP4 — vertical 9:16 default, square/landscape as flags.

Determinism is mandatory: no `Math.random()`/`Date.now()` in compositions (frames render across threads; nondeterminism = flicker). Seeded `random()` only. Same inputs → bit-identical movie.

## Why the boundaries sit where they sit

1. **Genre-neutral screenplay → re-skinning is nearly free.** The expensive analysis is cached; `--genre horror` costs one cheap punch-up pass. Replay value and architecture agreeing with each other.
2. **Closed scene vocabulary → the pack contract stays finite.** Five scene types, fixed for a long time. Every added type multiplies work for every existing pack. If a pack needs something exotic, the escape hatch is an optional `custom` scene with a required fallback rendering — not a new core type.
3. **Genre packs as the contribution surface.** The core (parser, screenwriter, redaction, render pipeline) is hard; a pack is a folder of React components + a CC0 track + an SFX map + a persona string. Shallow ramp, fun payoff — the VS Code themes play.

## Build-order guardrail

Implement `classic` hardcoded, end-to-end, before extracting the `GenrePack` interface. The interface gets extracted when genre #2 (heist) is built — that's when its real requirements are known. The screenplay IR, by contrast, is defined early: that contract is load-bearing from day one.
