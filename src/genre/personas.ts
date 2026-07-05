/**
 * Genre caption personas — the prompt fragments that carry a genre's voice
 * through the punch-up pass (docs/genre-packs.md: `captionPersona`). Classic
 * only — the punch-up pass is retired until a second genre pack exists
 * (docs/genre-packs.md), so classic's is the only persona with a consumer:
 * `remotion/src/packs/classic/index.tsx` reads it directly.
 *
 * DELIBERATELY PURE: zero imports, string data only — a value module
 * crossing the workspace boundary must not drag dependencies with it.
 */
export const PERSONAS = {
  // Persona = TONE, not dialect (docs/v1-storychange.md): attitude and rhythm
  // over the REAL events — real names, numbers and timestamps stay verbatim.
  //
  // classic, done right:  "PR #17 merged. Nobody is more surprised than the narrator."
  classic:
    "deadpan, self-aware, a little judgmental — a documentary narrator who has seen too many coding sessions and expects little. Dry understatement about exactly what happened: real file names, real counts, real times, stated flatly, doubted quietly",
} as const;

export type PersonaGenre = keyof typeof PERSONAS;
