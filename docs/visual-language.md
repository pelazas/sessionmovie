# Visual language

## There is no footage

Nothing is screen-recorded. Every frame is motion graphics rendered from transcript data — a stylized *reconstruction*, not a capture. Think the replay screen in a sports game, not a screencast.

This is the advantage, not a compromise: crisp typography at any resolution, a vertical crop that actually works, consistent branding across every video, and total control of time — two hours compress into sixty seconds because we animate events, not scrub video. (It's also why v1 is weekends, not months.)

## The visual vocabulary (classic pack)

Dark, editor-aesthetic canvas. Recurring elements:

- **The prompt** — the user's request types itself out at the start; the inciting incident.
- **Tool-call chips** — animated cards streaming by: `Read auth.ts`, `Grep "session token"`, `npm test → exit 1` (red). Cascade fast during exploration montages.
- **The diff panel** — the star. Syntax-highlighted code, red lines collapsing out, green lines typing in as each Edit lands, filename tab visible. Real diffs, replayed from the transcript.
- **File tree** — grows and lights up as files get touched; territory covered.
- **Terminal strip** — command output; where the emotional beats live (the red FAIL flash, the green cascade).
- **Editorial captions** — written by the screenwriter with personality: *"turn 12 — the bug reveals itself."*
- **Timeline scrubber** — turn numbers along the bottom; where you are in the compressed session.

## Characters (dialogue scenes)

Full spec: **characters.md** (original mascot — never the Claude logo/starburst, trademark —, SVG puppet rig, emotion-enum faces, contact-sheet acceptance). Summary: two characters, visual-novel / comic-panel style: **the user** (generic dev avatar; configurable later) and **the agent** (small terminal-faced robot — also the corner-mascot and the brand).

**Tone rule: one code money-shot per movie; characters everywhere else.** One real diff/red test is proof; three is a lecture. The screenwriter weights dialogue + comedy up and caps showcase scenes at 1–2.

- **Poses, not animation.** Static sprites with expression variants + speech bubbles popping on the beat + slight bounce on emphasis.
- **The `Emotion` enum bounds the art budget**: ~7 expressions × 2 characters ≈ 14 sprites, one commission or one afternoon with an image model. The screenwriter picks emotion per line from the enum, so assets can never explode.
- **Lines are condensed, never verbatim** (≤ ~90 chars, schema-enforced). A 300-word prompt becomes `user (tired): "the login is broken again. please."` Real prompts shown condensed are free comedy.
- The mascot also reacts during action/showcase scenes: types along, facepalms on failures, sweats during red streaks, confetti on green. Reaction shots carry emotion; the mascot carries the brand in every shared clip.

## The energy kit

The data is already dramatic — real failure, real struggle, real triumph. The job is applying proven editing grammar to terminal events:

1. **Cold open (the highest-leverage 2 seconds).** Never start at turn 1. Open on the most dramatic frame — `17 tests failing`, a 400-line diff mid-flight — hold a beat, smash-cut to *"2 hours earlier…"* and the title card.
2. **Beat-synced everything.** Pick the track first, precompute its beat grid, snap every cut/chip/diff-apply to the beat. Remotion is frame-perfect; this is 80% of what separates "slideshow" from "edit."
3. **Speed ramping — anime-fight structure.** Exploration at ludicrous speed (10 chips/sec, file tree lighting up like a city at night) → the key moment SLAMS to slow motion: one line of code, huge, centered. Boilerplate types instantly; the crucial fix types character… by… character.
4. **Sound design sells every event.** Keyboard thock for typing, soft tick per chip, record-scratch + music cut on failure, rising drone during red streaks, level-up chime on the green cascade. All CC0 one-shots.
5. **Self-aware captions.** *"turn 23: the bug was in the first file it read."* / *"this is fine."* (red streak) / *"claude has entered its villain era"* (force-push).
6. **The stats end-card — engineered for screenshots.** *"2h 14m → 58s"*, files touched, +412/−118, longest struggle (*"14 turns on one bug"*), **achievements** (*One-Shot Wonder*, *Marathon*, *Archaeologist* — read 40 files before editing one, *Rage Quit Averted*), and a slightly judgmental letter grade. Collectible badges make people render more movies.
7. **Blooper reel mode** (`--bloopers`): only the failures, back to back, benny-hill pacing. Self-deprecating agent content arguably outshares the triumphant cut.
8. **Zero-friction sharing.** Vertical 9:16 default (square/landscape flags), auto-written post text with the stats, and a two-second *"made with sessionmovie — one command"* end card. Every shared movie is an ad with installation instructions.

## Reference storyboard (60s, classic pack)

| Time | Scene | Content |
|---|---|---|
| 0–5s | cold open + title | climax frame → *"2 hours earlier…"* → repo + typed prompt |
| 5–15s | action (montage) | exploration: chips flying, tree lighting up |
| 15–25s | showcase (fail) | first fix applies → tests run → **RED**, record-scratch, tempo drop |
| 25–35s | dialogue + showcase (reveal) | the insight beat — slow-mo, one snippet enlarged, caption |
| 35–45s | showcase (pass-pending) | the real fix types in line by line |
| 45–52s | showcase (pass) + stats | green cascade + chime → stats pop |
| 52–60s | stats / outro | achievements, grade, watermark card |

Struggle, insight, resolution — the screenwriter's beat-picking job is finding that arc in the turn data.

## Quality floor

If every movie that escapes the tool is good, the brand compounds; one lame auto-generated clip does the opposite. Sessions without a story (no edits, Q&A-only) are declined charmingly, not rendered limply. Later: sessions that produced visual artifacts (Playwright screenshots, rendered images in the transcript) can drop them in as real frames — the only "real pixels" the movie will ever contain.
