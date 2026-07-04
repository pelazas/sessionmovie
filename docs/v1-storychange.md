# v1 story change: recognition & text economy

The rules that decide whether a movie *lands* for the person who lived the session. Written after the first full-pipeline render (2026-07-04): the quest persona translated a real day into fantasy dialect, and the owner of the session couldn't recognize his own moments. These rules fix that class of failure. They govern prompt v4+, the punch-up pass, and both packs' renderers.

## The prime directive: the you-were-there test

**The viewer lived this session. Every scene must let them say "oh right, THAT moment."**

Recognition first; comedy second — and comedy *emerges from* recognition (a true thing said dryly), never replaces it. A joke that obscures what actually happened is a defect, however clever. This also serves strangers: authenticity is what makes shared clips feel real instead of templated.

Concretely, every scene must carry at least one **anchor** the session's owner recognizes on sight:

- a near-verbatim quote fragment ("Don't squash. Rebase from now on.")
- a real file / PR / branch / feature name ("PR #17", "Showcase.tsx")
- a real number (17 tests, 46 files, 6 API calls)
- a real time of day ("08:34 — the org chart is now one human and a fleet of Claudes")

## Metaphor lives in the visuals; words stay anchored to reality

THE BUG with an HP bar *works* — because the content it dramatizes is real (`Bash: npm test → exit 1` on the attack chips). The moment the *words* get costumed too ("thy Notion scrolls", "cursed lands"), the viewer loses the last thread back to what happened. One layer of metaphor, always the visual one.

## Dialogue is documentary (decided, enforced structurally)

The user's and agent's real words are the movie's most powerful asset. Dialogue text is:

- **condensed** by the beat pass (≤90 chars, schema-enforced) — yes
- **persona-translated** — never

Enforcement is code, not trust: dialogue text is part of the punch-up's frozen structural fingerprint, exactly like emotions and timings. The punch-up pass cannot touch it.

## Persona = tone, not dialect

The punch-up may color captions with the genre's *attitude* — word choice, rhythm, one epic flourish. It may not:

- use archaic/step dialect ("thou", "aye", "forsooth")
- rename real things into genre objects (ideas ≠ "scrolls", npm install ≠ "a journey through cursed lands")
- drop the caption's anchor (file name, number, timestamp must survive the rewrite)

Quest voice done right narrates *real events epically*: "PR #17 arrives — six commits deep, one boss inside." Same energy, zero translation.

A full-costume mode ("translate my session into a medieval saga") may exist someday as an explicit opt-in flag (`--dramatic`) for the meme use-case. It is not the default and is not currently planned.

## The cold open is a moment, not a riddle

Open on the most recognizable dramatic beat, stated plainly: a real quote ("Try it on this chat."), a real failure (17 tests red), a real render bar. Conceptual wordplay ("The movie being rendered: the session rendering it") fails the you-were-there test in the one slot where recognition matters most. If the line needs to be decoded, it's not a cold open.

## Timestamps are memory anchors

Time-of-day is one of the strongest "that's when" cues for a day you lived. "07:04 — twelve files, seven docs, zero lines of product" grounded scenes before the persona pass erased it.

- The screenwriter is encouraged to carry time-of-day into captions where it helps.
- The packs render a small **clock chip** per scene (from the digest's turn timestamps) so the day visibly progresses even when no caption mentions it.

## Text economy: one voice at a time

Three text channels exist — dialogue bubbles, the caption, and narration. **A viewer should never have to read two of them at once.** Rules:

1. **Caption and narration are one channel by construction** — narration speaks the caption, the caption word-highlights along. They never disagree and never coexist with a second caption.
2. **In dialogue scenes, the bubbles are the words.** Dialogue scenes should usually be *captionless* (screenwriter rule: a caption in a dialogue scene must earn its place, e.g. a closing beat after the last bubble). Narration in a dialogue scene may only play as a lead-in **before the first bubble pops** — never over bubbles.
3. **Reading-load budget:** target ≤ ~15 words readable on screen at any moment. The beat pass already caps captions at ~10 words (v3) and dialogue lines at 90 chars; the renderer's job is to never stack them.
4. **Silence is allowed.** Action montages carry energy visually; not every scene needs words. A scene with a strong visual beat and no text is a choice, not a gap (and the punch-up may not "fix" it — caption presence is structurally frozen).

## Where each rule is implemented

| Rule | Lives in |
|---|---|
| you-were-there anchors, plain cold open, captionless dialogue scenes, timestamps in captions | screenwriter prompt (v4+) — evaluated against all fixtures |
| dialogue frozen, caption-presence frozen | `src/screenwriter/punchup.ts` structural fingerprint |
| tone-not-dialect, anchors survive rewrite | punch-up prompt + review of persona strings in `src/genre/personas.ts` |
| clock chip, no caption/narration over bubbles | pack renderers (both packs) |
| caption == narration | voiceover manifest (already true) |
