# Screenplay format (the IR)

The screenplay is the genre-neutral JSON intermediate representation between the Screenwriter (LLM) and genre packs. It is the project's load-bearing contract: zod-validated at the boundary, versioned, and changed only deliberately (schema changes update this doc in the same PR).

## Design rules

- **Genre-neutral.** No genre may leak into the beat pass output. Genre flavor lives in the punch-up pass, which rewrites `text`/caption fields only — never structure.
- **Closed scene vocabulary.** Five types. Adding one multiplies work for every genre pack.
- **Bounded text.** Dialogue lines are condensed, never verbatim — max ~90 chars, enforced in schema. Walls of text must be structurally impossible.
- **Bounded emotion enum.** Emotions map 1:1 to character sprite poses; the enum bounds the art budget (~7 poses × 2 characters).
- **Duration budget.** The screenwriter receives a total target (45–60s) and assigns per-scene targets; validation rejects screenplays that don't sum within tolerance. Packs may clamp via `pacing` but not restructure.

## Schema sketch (TypeScript / zod shapes)

```ts
type Emotion =
  | 'neutral' | 'confident' | 'confused' | 'panicking'
  | 'smug' | 'defeated' | 'celebrating'

type Scene =
  | { type: 'title'
      task: string                      // the user's mission, condensed
      coldOpen?: ShowcaseRef }          // most dramatic moment, shown before the title
  | { type: 'dialogue'
      lines: Array<{
        speaker: 'user' | 'claude'
        text: string                    // condensed, <= 90 chars
        emotion: Emotion
      }> }
  | { type: 'action'                    // "doing something"
      events: ToolEvent[]               // tool chips, file-tree lights, command runs
      intensity: 'montage' | 'steady' } // montage = hyper-speed, beat-synced
  | { type: 'showcase'                  // "showing something"
      artifact: Diff | TestRun | Screenshot
      verdict: 'fail' | 'pass' | 'reveal'
      focus?: LineRange }               // the lines to enlarge in slow-mo
  | { type: 'stats'
      compressed: { realDuration: string; movieDuration: string }
      counts: { files: number; added: number; removed: number; tools: number }
      achievements: Achievement[]
      grade?: string }                  // slightly judgmental, deliberately

interface Screenplay {
  version: 1
  sessionMeta: { repo?: string; startedAt?: string }
  targetDurationSec: number             // 45–60
  scenes: Array<Scene & {
    targetSec: number
    caption?: string                    // editorial caption, punch-up pass rewrites
  }>
}
```

## The narrative grammar

The screenwriter is prompted toward a rhythm, not free composition:

- **Cold open** — never start at turn 1; open on the climax frame, then cut to title (*"2 hours earlier…"*).
- **Alternation** — dialogue (setup/joke/breather) → action (energy) → showcase (payoff) → dialogue (reaction) → …
- **Arc** — struggle → insight → resolution. The red `showcase(fail)` before the green `showcase(pass)` is the emotional spine; the insight beat gets slow-motion (`focus` on the key lines).
- **Compression honesty** — the stats scene always shows real duration vs. movie duration.

## Punch-up pass contract

Input: a valid screenplay + a pack's `captionPersona`. Output: the same screenplay with only `caption`, `grade`, and achievement titles rewritten. Structure, timings, scene order, emotions, and every dialogue line's `text` are immutable in this pass — dialogue is documentary (docs/v1-storychange.md): the session's real words are condensed by the beat pass and never persona-translated. Caption anchors (file names, numbers, timestamps) must survive a rewrite verbatim. This is what makes `--genre` re-renders cheap and safe.

## Failure modes

- Schema mismatch → repair loop (re-prompt with validation errors), bounded retries.
- Not enough footage (no edits / too few turns) → the screenwriter returns a typed `decline` with a reason instead of a screenplay; the CLI reports it charmingly and exits. Never render a bad movie.
