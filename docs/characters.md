# Characters

Two puppet characters carry the movie's emotion: **the agent** (an original robot mascot) and **the user** (a hoodie-dev avatar). The code artifacts stay in the movie as proof — but the characters are the protagonists.

> Narrative rules moved up a level: see **storytelling.md** for the recognition
> contract, dialogue-is-documentary, and text economy. The money-shot rule below stands.

## Tone rule they exist to serve

**One code money-shot per movie; characters everywhere else.** One real diff or red test is proof this happened; three is a lecture. The screenwriter (prompt v2+) weights dialogue and comedy up, caps showcase scenes at 1–2, and keeps diffs to the focus lines. Sports-broadcast structure: game footage carries authenticity, characters carry emotion.

## The agent mascot — original design, deliberately

**Not the Claude logo, not the Anthropic starburst — ever.** Those are trademarks, and an OSS project shipping them as a dancing character invites a takedown. The mascot is an original "coding agent" character: small terminal-faced robot, cursor-blink eyes, flat geometric style. This is strictly better anyway: it's *our* brand in every shared clip, and it stays coherent when other agents' transcripts (Cursor, SDK sessions) are supported.

The user character: generic hoodie-dev avatar; customization (skin/hair/accessories) is a possible later feature, not v1.

## Puppet rig, not animation

Characters are **agent-authored SVG, rigged as puppets** — no raster sprites, no frame-by-frame animation:

- One SVG per character with **named groups**: `#body`, `#head`, `#eyes`, `#mouth`, `#arm-l`, `#arm-r`, `#accessory`.
- **Expressions are 7 swappable face groups, mapping 1:1 to the schema's `Emotion` enum** (`neutral | confident | confused | panicking | smug | defeated | celebrating`). The enum bounds the art budget by design — new emotions need schema + doc + art, which is the point.
- **Poses are transform presets** on limb/body groups (idle, typing, point, cheer, collapse), animated by Remotion springs (bounce, lean, shake, recoil). South Park-level motion reads as fully animated at 30fps.
- A `<Mascot character="agent|user" emotion={...} pose={...} />` component swaps groups and drives transforms. Deterministic (seeded `random()` only, as always).

Why SVG-as-code instead of image-model sprites: structural consistency (every expression is a variant of one base file — impossible to drift off-model), tiny diffable files, **zero licensing questions** (original code, no CREDITS.md entry), and genre packs reskin via theme tokens or extra groups (quest = knight helmet toggled on) instead of regenerating art.

## Where characters appear

- **Dialogue scenes** — the main stage: two puppets, speech bubbles, expression per line (the schema already carries `emotion` per dialogue line).
- **Corner reactions** in action/showcase scenes — mascot types along, facepalms on red, sweats during fail streaks, confetti on green.
- **Genre-pack worlds** (see genre-packs.md): in `quest`, the same two puppets fight the session's failures as monsters; the metaphor is a rendering decision, never a schema change.

## Acceptance harness: the contact sheet

Character work is judged visually, not by reading SVG paths. The deliverable includes a **contact-sheet still** — one Remotion frame rendering every character × emotion × pose in a grid — regenerated on every change. Review = look at one PNG. Requirements: must read clearly at 120px (corner-reaction size), flat colors from theme tokens, no gradients.
