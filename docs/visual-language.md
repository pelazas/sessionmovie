# Visual language

## There is no footage

Nothing is screen-recorded. Every frame is motion graphics rendered from transcript data — a stylized *reconstruction*, not a capture. Think the replay screen in a sports game, not a screencast.

This is the advantage, not a compromise: crisp typography at any resolution, a vertical crop that actually works, consistent branding across every video, and total control of time — two hours compress into sixty seconds because we animate events, not scrub video.

## The visual identity (no genre — there is one look)

Dark terminal canvas, one coral accent color, off-white text. Pixel-art characters (docs/characters.md) operate crisp vector panels — the contrast between the two rendering styles (chunky pixel cast, clean vector chrome) *is* the look, not a mismatch to fix.

**One shared panel chrome**, reused across every scene type instead of a per-scene bespoke background: a single panel component styled as a code window / terminal / file tree / stat card depending on what it's showing, sharing the same frame, corner radius, title-bar treatment, and drop shadow. Consistency here is what makes the movie read as one product instead of five demos glued together.

Recurring elements inside that shared chrome:

- **The prompt** — the user's request types itself out at the start; the inciting incident.
- **The artifact panel** — one real artifact per action/showcase scene, shown in the shared chrome: a diff (syntax-highlighted, red lines collapsing out, green lines typing in), a command's terminal output, or a subagent task list. Never a montage of many.
- **File tree** — grows and lights up as files get touched; territory covered.
- **Editorial captions** — short, plain-spoken: *"turn 12 — the bug reveals itself."*
- **Stat card** — the same shared chrome, populated by the facts sidecar (docs/screenplay-format.md).

## One motion grammar

A single easing set and three timing tokens — **200ms / 400ms / 800ms** — cover every transition in every scene type: chip pops, panel slides, caption fades, the squash-bounce that masks a character clip's hard cut (docs/characters.md). No scene invents its own easing curve or duration. This is what "no genre" buys structurally: one grammar to get right instead of one per pack.

## Tone rule

**Each action scene shows exactly one real artifact; characters carry everything else.** One real diff or command result is proof this happened; three in one scene is a lecture. The screenwriter enforces this by schema (`ActionArtifactSchema`, one per scene), not by editorial discipline alone.

- **Poses, not blending.** Characters cut between clips on emotion/pose changes — no runtime cross-fade (docs/characters.md).
- **Lines are condensed, never verbatim** (≤90 chars/line, ≤6 lines/movie, schema-enforced). A 300-word prompt becomes `user: "the login is broken again. please."` Real prompts shown condensed are free comedy.
- The mascot reacts during action/showcase scenes: types along, facepalms on failure, celebrates on success.

## The energy kit

The data is already dramatic — real failure, real struggle, real triumph. The job is applying proven editing grammar to terminal events:

1. **Beat-synced everything.** Pick the track first, precompute its beat grid, snap every cut/chip/artifact-reveal to the beat. Remotion is frame-perfect; this is 80% of what separates "slideshow" from "edit."
2. **Speed ramping.** The one artifact per scene gets room to breathe — the crucial line of a diff types character-by-character; everything leading up to it can move fast.
3. **Sound design sells every event.** Keyboard thock for typing, soft tick per beat, a tonal shift on a failed command, a resolving chime on success. All CC0 one-shots.
4. **Plain captions.** *"turn 23: the bug was in the first file it read."* Recognition first (docs/v1-storychange.md) — a caption that needs decoding has failed.
5. **The stats end-card — engineered for screenshots.** *"2h 14m → 58s"*, files touched, +412/−118, and whichever 2-3 fact tiles the deterministic interestingness rules pick (docs/screenplay-format.md) — cost estimate, subagent count, longest pause, cache savings.
6. **Zero-friction sharing.** Vertical 9:16 default (square/landscape flags), auto-written post text with the stats, and a two-second *"made with sessionmovie — one command"* end card. Every shared movie is an ad with installation instructions.

## Reference storyboard (50s, the pair structure)

| Time | Scene | Content |
|---|---|---|
| 0–5s | title | repo + typed prompt, plainly stated — no cold open |
| 5–11s | dialogue → action | a beat of real words, then one real artifact |
| 11–20s | dialogue → action | second pair |
| 20–29s | dialogue → action | third pair (when the pool supports it) |
| 29–37s | showcase (optional) | the biggest edit, when the session had ≥2 — the closing beat before stats |
| 37–50s | stats | fact tiles pop in, watermark card |

Exact per-scene seconds come from the heuristic's fixed duration tables or the LLM screenwriter's budget (docs/screenplay-format.md); this storyboard is the shape, not the schedule.

## Quality floor

If every movie that escapes the tool is good, the brand compounds; one lame auto-generated clip does the opposite. Sessions without a story (no edits, Q&A-only) are declined charmingly, not rendered limply.

## Out of scope (for now)

Explicitly not part of the no-genre visual language — each would need its own design pass before it's worth building:

- Word-karaoke captions (word-by-word highlight timed to speech).
- Pose blending between character clips (hard cuts only, see docs/characters.md).
- Camera systems (pan/zoom/depth) — panels animate in place.
- Bespoke per-scene backgrounds — everything lives in the one shared panel chrome.
- Content-adaptive layout — panel shapes are fixed, not reflowed per artifact size.
