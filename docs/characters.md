# Characters

Two puppet characters carry the movie's emotion: **the agent** (a pixel-art Claude Code homage) and **the user** (the same body rig, topped with their own avatar). The code artifacts stay in the movie as proof — but the characters are the protagonists.

> Narrative rules moved up a level: see **v1-storychange.md** for the recognition contract, dialogue-is-documentary, and text economy.

## Tone rule they exist to serve

**Each action scene shows exactly one real artifact; characters everywhere else.** One real diff or command result is proof this happened; a wall of chips is a lecture. The screenwriter caps each action/showcase scene to a single artifact by schema (`ActionArtifactSchema`), and keeps diffs to the focus lines. Sports-broadcast structure: the artifact carries authenticity, the characters carry emotion.

## The agent mascot — pixel-art homage, deliberately

**Owner decision, recorded here:** the agent is a *deliberately recognizable* pixel-art homage to Claude Code — original artwork, drawn in-repo, pixel by pixel. It is never the actual Claude logo or the Anthropic starburst asset, never traced from either, never exported from any Anthropic brand file. The homage is in silhouette and vibe (terminal-cursor energy, the coral accent from visual-language.md), not in tracing a trademark. This is the same reasoning the project has always applied to brand assets — recognizable enough to read as "the agent," safe enough to ship.

**The user shares the agent's body rig** — same proportions, same joints, same ~8 animation clips — but with one sanctioned exception to the SVG-only rule: the user's **head** is a pixelated raster image of their own public GitHub avatar, not a drawn face. This is deliberate: it's the one piece of the cast that should look like *you*, not a generic dev avatar.

- Resolved at pipeline time (CLI-side, not inside a Remotion composition — no network calls from compositions).
- Downsampled to 48×48 at a 32-color palette via median-cut quantization, then rendered with `image-rendering: pixelated` so it reads as pixel art at any output scale, matching the agent's drawn style instead of clashing as a smooth photo.
- The body gets a tint pulled from the avatar's dominant color, clamped in HSL to lightness 0.45–0.65 and saturation 0.35–0.8 — enough to feel personalized, never so dark/washed-out or neon that it breaks the palette or fails contrast against the dark canvas.
- No avatar available (private profile, fetch failure, no GitHub identity) → a generic default head, same rig, no crash. A character render path never depends on network availability.

## Shared rig: clips, not freeform transforms

Both characters are **agent-authored SVG puppets** (raster exception above aside) sharing one **body rig** and one library of **~8 animation clips**: `idle` (holds, breathing), `blink`, `walk`, `typing`, `thinking`, `celebrate`, `error-shake`, `subagent-spawn`. One clip library, two skins — this is what makes the user's raster head a small, contained exception rather than a second rig to maintain.

- Named SVG groups: `#body`, `#head`, `#eyes`, `#mouth`, `#arm-l`, `#arm-r` (the user's `#head` is the raster image element instead of paths).
- **An emotion → pose lookup table** maps the schema's `Emotion` enum (`neutral | confident | confused | panicking | smug | defeated | celebrating`) to one of the shared clips — the enum still bounds the art budget by design.
- **Hard cuts, not blending.** Switching clips is a hard cut masked by a ~200ms squash-and-stretch bounce (a Remotion spring), never a cross-fade or a runtime blend tree. This keeps the rig deterministic (seeded `random()` only) and the clip set genuinely fixed — no in-between poses to maintain.
- A `<Mascot character="agent|user" emotion={...} />` component resolves the pose from the lookup table and plays the clip. Deterministic, as always.

Why SVG-as-code (plus the one raster exception) instead of image-model sprites: structural consistency, tiny diffable files, and zero licensing questions for the drawn parts — the one raster asset per render is the user's own public image, which they already control the rights to.

## Where characters appear

- **Dialogue scenes** — the main stage: two puppets, speech bubbles, expression per line (the schema already carries `emotion` per dialogue line).
- **Corner reactions** in action/showcase scenes — mascot types along, facepalms on failure, sweats during fail streaks, celebrates on success.
- **`subagent-spawn`** plays when the session's artifact pool includes a `subagents` artifact — the one clip that's session-shape-specific rather than emotion-driven.

## Acceptance harness: the contact sheet

Character work is judged visually, not by reading SVG paths. The deliverable includes a **contact-sheet still** — one Remotion frame rendering every character × emotion (agent) and every clip (both characters, with a placeholder avatar for the user) in a grid — regenerated on every change. Review = look at one PNG. Requirements: must read clearly at 120px (corner-reaction size), flat colors from theme tokens, no gradients.
