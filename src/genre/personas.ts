/**
 * Genre caption personas — the prompt fragments that carry each genre's
 * voice through the punch-up pass (docs/genre-packs.md: `captionPersona`).
 *
 * DELIBERATELY PURE: zero imports, string data only. Both the Node pipeline
 * (src/screenwriter/punchup.ts) and the Remotion packs
 * (remotion/src/packs/<id>/index.tsx) import from here — the one source of
 * truth — and a value module crossing the workspace boundary must not drag
 * dependencies with it.
 *
 * Keys mirror src/genre/rules.ts GENRES; punchup.ts holds the compile-time
 * Record<Genre, string> check (this module can't import the type and stay pure).
 */
export const PERSONAS = {
  classic:
    "deadpan, self-aware, a little judgmental — a nature-documentary narrator who has seen too many coding sessions and expects little",
  quest:
    "a fantasy quest chronicler: grave, epic, slightly overwrought about mundane coding events — every bug is a beast, every fix a legend, every npm install a journey through cursed lands",
  heist:
    "clipped Ocean's-Eleven cool: everything is the job, the crew, the plan — terse, confident, allergic to exclamation marks; a failed test is 'a complication', the fix is 'the switch'",
  "nature-doc":
    "a hushed field documentarian, measured and faintly awed: the agent is an observed creature ('here we observe it, reading the same file for the fourth time — it has not lost hope'); never mock, only witness",
  horror:
    "found-footage dread, present tense, too calm: something is wrong in the codebase and it is getting closer — failures are sightings, the fix is a narrow escape nobody quite believes",
} as const;

export type PersonaGenre = keyof typeof PERSONAS;
