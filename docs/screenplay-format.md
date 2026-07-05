# Screenplay format (the IR)

The screenplay is the genre-neutral JSON intermediate representation between the Screenwriter (LLM or heuristic) and the renderer. It is the project's load-bearing contract: zod-validated at the boundary, versioned, and changed only deliberately (schema changes update this doc in the same PR).

## Design rules

- **Genre-neutral.** `classic` is the only shipped pack and the permanent fallback (docs/genre-packs.md); nothing genre-specific belongs in the IR.
- **Closed scene vocabulary.** Five types. Adding one multiplies work for every genre pack.
- **Bounded text.** Dialogue lines are condensed, never verbatim — max ~90 chars/line, enforced in schema, and the whole screenplay has a hard budget of at most 6 dialogue lines total (`MAX_DIALOGUE_LINES`). Walls of text must be structurally impossible.
- **Bounded emotion enum.** Emotions map 1:1 to character sprite poses; the enum bounds the art budget.
- **Duration budget.** The screenwriter receives a total target (45–60s) and assigns per-scene targets; validation rejects screenplays that don't sum within tolerance.
- **One artifact per action/showcase scene.** `action` and `showcase` scenes both carry a single `ActionArtifact` — the renderer never receives a list to summarize, and the screenwriter never invents a fact from nothing.
- **Stats carries no numbers.** The screenwriter never invents a statistic, and the renderer never derives one from raw timeline data — the CLI's facts pipeline (`src/facts/`) computes real numbers once and hands them to the renderer as a sidecar, keyed by scene index. See "Stats numbers live outside the IR" below.

## Schema sketch (TypeScript / zod shapes)

```ts
type Emotion =
  | 'neutral' | 'confident' | 'confused' | 'panicking'
  | 'smug' | 'defeated' | 'celebrating'

type ActionArtifact =
  | { kind: 'edit'; file: string; added: number; removed: number
      snippet?: string                  // redacted BEFORE it enters the IR
      focus?: LineRange }                // the lines to enlarge in slow-mo
  | { kind: 'command'; command: string; exitCode: number; summary?: string }
  | { kind: 'create'; files: string[] }  // 1..12 — heuristic screenwriter never emits this
  | { kind: 'subagents'; tasks: string[] } // 1..8, each <= 60 chars

type Scene =
  | { type: 'title'
      headline: string                  // one line, <= 80 chars
      task: string }                    // the user's mission, condensed, <= 120 chars
  | { type: 'dialogue'
      lines: Array<{
        speaker: 'user' | 'claude'
        text: string                    // condensed, <= 90 chars, documentary (never persona-rewritten)
        emotion: Emotion
      }> }
  | { type: 'action'                    // "doing something" — one real artifact
      artifact: ActionArtifact }
  | { type: 'showcase'                  // "showing something" — the finale artifact
      artifact: ActionArtifact }
  | { type: 'stats' }                   // bare — numbers ride the CLI facts sidecar

interface Screenplay {
  version: 2
  sessionMeta: { repo?: string; startedAt?: string }
  targetDurationSec: number             // 45–60
  scenes: Array<Scene & {
    targetSec: number
    caption?: string                    // editorial caption (text only, never structure)
  }>
}
```

## The narrative grammar

The screenwriter is prompted toward a rhythm, not free composition:

- **Title** — the mission, stated plainly. No cold open: the rewrite drops the "flash-forward then cut to title" beat entirely: the movie starts at the start.
- **Alternation** — 2–3 `dialogue → action` pairs: a beat of the session's real words, then a beat of real work (one artifact). Each action scene shows exactly one real artifact — never a montage of many.
- **Optional showcase finale** — when the session produced at least two real edits, the biggest one gets a dedicated showcase scene as the closing beat before stats; the rest stay in their action scenes. Sessions without enough edits skip straight to stats.
- **Stats** — always last, always bare in the IR; the rendered numbers come from the facts sidecar (see below).

The heuristic screenwriter (`src/screenwriter/heuristic.ts`) is a simpler deterministic subset of this grammar — one dialogue scene, one line — used as a structural fallback and pipeline exerciser. The LLM screenwriter is where the full pairs grammar is composed.

## Stats numbers live outside the IR

A `stats` scene in the screenplay is just `{ type: 'stats', targetSec, caption? }` — no `counts`, no `achievements`, no `grade`. The real numbers (cost estimate, subagent count, git activity, cache savings, longest pause, ...) are computed once, deterministically, from the `Timeline` by `src/facts/facts.ts` and handed to the renderer as a parallel sidecar keyed by scene index (`pickFactTiles`, `sceneTimesFor`). This split is deliberate: the renderer never derives a number from raw data (it only ever displays a pre-formatted tile), and the LLM never invents one (it doesn't have the numbers to invent from). Same session + same facts sidecar always produces the same tiles.

## Failure modes

- Schema mismatch → repair loop (re-prompt with validation errors), bounded retries.
- Not enough footage (no edits / too few turns) → the screenwriter returns a typed `decline` with a reason instead of a screenplay; the CLI reports it charmingly and exits. Never render a bad movie.
