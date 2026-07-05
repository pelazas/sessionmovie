# Audio: music & voiceover

Two layers, different maturity: **music/SFX is v1** (in flight), **voiceover is planned** (designed here, built later). Nothing in this doc changes the frozen v2 schema — voiceover explicitly waits for a versioned schema bump if it ever needs one.

## Music & SFX (v1)

Policy (binding, same as genre-packs.md):

- **CC0 only, verified.** "Royalty-free" and "free for YouTube" are not licenses. Check the actual license page of every asset (Pixabay license terms read carefully, Freesound filtered to CC0, FreePD). Attribution-required (CC-BY) is rejected even though we'd happily credit — because *downstream users* of this repo inherit the obligation and won't know.
- **Every asset lands in `CREDITS.md` in the same PR.** Source URL + license. A PR with an uncredited asset is rejected regardless of quality.
- **Beat grid is data.** Each track ships with a precomputed beat-timestamp array (`remotion/src/audio/beats.ts`); cuts and artifact reveals snap to it. Computed offline, committed as numbers with a comment on how.
- **Generic CC0 set, not genre-flavored.** With genre packs gone for now (docs/genre-packs.md), the bundled bed should read as one neutral energy kit rather than a per-genre soundtrack — the quest pack's fantasy-flavored battle track (`music-battle-theme-a.mp3` in `CREDITS.md`) is dropped in favor of a generic bed everyone shares. Tracked as follow-up work: swapping the actual asset (and its `CREDITS.md` entry) is a separate PR from this contract change.
- **Ducking:** music volume dips a constant −6dB under voiceover, via frame-math volume automation — no Web Audio, no nondeterminism.

## Voiceover — ElevenLabs (planned, not v1)

Design decisions locked now so the build is mechanical later.

### What gets narrated

**Dialogue lines only.** Title, action, and stats scenes are silent — no narration, no VO ducking needed there. Each dialogue line becomes one speaker-tagged narration cue, paired with its existing per-line caption (the bubble text and the narration are the same words, docs/v1-storychange.md's "one voice at a time").

- `ELEVENLABS_VOICE_USER` and `ELEVENLABS_VOICE_CLAUDE` pick a voice per speaker; both default to the **same one narrator voice** when unset, so voiceover works out of the box with zero configuration and only sounds like two distinct people once the user opts into that.
- No genre persona layer — dialogue text is documentary (docs/v1-storychange.md) and voiceover reads it exactly as written, same as captions.

### Where it sits in the pipeline

```
screenplay (dialogue lines, already condensed + redacted)
  → TTS step in the CLI (pre-render): ElevenLabs API → mp3 per dialogue line
  → cache by hash(text + voiceId + settings)
  → Remotion <Audio> sequences, timed per scene
```

**Hard rule: no network inside compositions.** TTS runs as an explicit CLI step before `remotion render`; the composition only ever consumes local audio files. This preserves render determinism and keeps Remotion Lambda viable.

### Determinism & caching

TTS output is nondeterministic per call, which breaks "same screenplay → bit-identical movie". Mitigation: content-addressed cache (`out/.tts-cache/<sha256>.mp3` keyed on text + voiceId + model + settings). Same screenplay re-renders reuse cached audio → deterministic in practice; regenerating the cache is an explicit `--refresh-voices` action.

### Design-pending spike: pipeline reorder for timing

Today, scene durations are locked before anything narrates them — voiceover has to fit whatever `targetSec` the screenwriter already picked. The better order, not yet built:

1. Write the screenplay (durations are provisional).
2. Synthesize each dialogue line's TTS **before** the duration lock.
3. Set that dialogue scene's `targetSec` to the measured VO duration + 1.5s, clamped to 3–9s.
4. Absorb the delta (versus the screenwriter's original guess) into that dialogue scene's **paired action scene**, so the movie's total stays on budget instead of drifting.

This reorders "TTS then duration lock" instead of today's "duration lock then hope TTS fits," and needs a spike before it's real: how the pairing is tracked through the pipeline, and what happens when the delta would push the paired action scene below a sane floor. Filed as a spike, not a commitment, until that's answered.

### Voices & ethics

- **Stock/designed ElevenLabs voices only.** No cloning of real people.
- Voiceover is **opt-in** (`--voiceover`), requires the user's own `ELEVENLABS_API_KEY`, and the redaction layer has already run upstream — narration text is screenplay text, which is redacted by construction.
- **Key permissions (field lesson, 2026-07-04):** ElevenLabs keys can be created scope-restricted. Synthesis needs **Text to Speech**; `doctor` validates keys with `GET /v1/voices`, which needs **Voices: Read** — so a TTS-only key renders fine but fails doctor with a bare 401 and a misleading "create a fresh key" hint. Known gap for v0.1.1: `checkApiKey` should surface the ElevenLabs error body (`missing_permissions` vs `invalid_api_key`, which is safe to print) and name the missing scope in the fix hint.

### Cost

~$0.10–0.30 per movie-minute of speech at current ElevenLabs pricing. With narration now scoped to dialogue lines only (a few seconds per pair, not most of the runtime), a typical movie's voiceover cost sits at the low end of that range. Still the only per-movie cost in the pipeline; everything else remains $0.

### Build order (when we come back to this)

1. Prototype behind `--voiceover`: narrate dialogue lines, one stock voice, cache in place, duration lock unchanged (VO clamped to fit rather than driving it).
2. The pipeline reorder above (TTS before duration lock), once the spike questions are answered.
3. Per-speaker voices (`ELEVENLABS_VOICE_USER`/`ELEVENLABS_VOICE_CLAUDE`) + ducking polish + Lambda-compatible cache upload.
