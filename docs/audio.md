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

### The pipeline (ratified)

Today, scene durations are locked before anything narrates them. The ratified design reorders that — durations are set FROM the measured audio, not the other way around:

```
parse → screenwriter → zod validate
  → synth each dialogue line (ElevenLabs; per-speaker ELEVENLABS_VOICE_USER/
    ELEVENLABS_VOICE_CLAUDE, both defaulting to one narrator voice; content-
    addressed cache per line)
  → resize each dialogue scene:
      targetSec = clamp(Σ lineAudioSec + 0.35s × (n−1) inter-line gaps
                         + 0.75s lead + 0.75s tail, 3, 9)
  → renormalize every non-dialogue scene proportionally, so the movie still
    hits targetDurationSec, with floors: action >= 5s, title >= 3s,
    showcase >= 4s, stats >= 4s
  → assert the duration invariant (same superRefine check the schema always ran)
  → quantize to the beat grid
  → render
```

**Hard rule: no network inside compositions.** TTS runs as an explicit CLI step before `remotion render`; the composition only ever consumes local audio files. This preserves render determinism and keeps Remotion Lambda viable.

The 0.35s inter-line gap is a tunable, not a magic constant.

**Overflow.** A dialogue scene whose measured audio would need more than 9s drops the trailing line's cue rather than let the scene run long — one line loses its voiceover (its caption still shows, silently). A single line that alone exceeds 9s of audio just clamps to the 9s ceiling and logs a warning; it still gets voiced, truncated.

**Synth failure.** Any TTS failure — network, quota, bad key mid-run — falls back for the **whole movie**: every scene reverts to the screenwriter's original durations, voiceover is off entirely, and the CLI prints a loud warning. Never a half-narrated movie with some scenes on VO timing and others on guessed timing; that would look like a bug, not a feature.

**What's off-limits here:** dialogue text still never has numerals rewritten or checked by code — this pipeline consumes whatever condensed line the screenwriter wrote (heuristic or LLM), verbatim, same as always (docs/v1-storychange.md). The one place numerals get discouraged is the LLM screenwriter's *prompt*: numbers make ElevenLabs TTS read roughly 2.6x slower (digit expansion — "47" becomes "forty-seven"), which eats into the 90-char/9s budget for no narrative gain, and numbers belong in the stats scene's fact tiles anyway. This is prompt guidance, not a schema rule or a heuristic-screenwriter check.

Non-dialogue captions (title/action/showcase/stats) are always text-only — never narrated, never queued for TTS, regardless of this pipeline.

### Determinism & caching

TTS output is nondeterministic per call, which breaks "same screenplay → bit-identical movie". Mitigation: content-addressed cache (`out/.tts-cache/<sha256>.mp3` keyed on text + voiceId + model + settings). Same screenplay re-renders reuse cached audio → deterministic in practice; regenerating the cache is an explicit `--refresh-voices` action.

### Voices & ethics

- **Stock/designed ElevenLabs voices only.** No cloning of real people.
- Voiceover is **opt-in** (`--voiceover`), requires the user's own `ELEVENLABS_API_KEY`, and the redaction layer has already run upstream — narration text is screenplay text, which is redacted by construction.
- **Key permissions (field lesson, 2026-07-04):** ElevenLabs keys can be created scope-restricted. Synthesis needs **Text to Speech**; `doctor` validates keys with `GET /v1/voices`, which needs **Voices: Read** — so a TTS-only key renders fine but fails doctor with a bare 401 and a misleading "create a fresh key" hint. Known gap for v0.1.1: `checkApiKey` should surface the ElevenLabs error body (`missing_permissions` vs `invalid_api_key`, which is safe to print) and name the missing scope in the fix hint.

### Cost

~$0.10–0.30 per movie-minute of speech at current ElevenLabs pricing. With narration now scoped to dialogue lines only (a few seconds per pair, not most of the runtime), a typical movie's voiceover cost sits at the low end of that range. Still the only per-movie cost in the pipeline; everything else remains $0.

### Build order (when we come back to this)

1. Prototype behind `--voiceover`: narrate dialogue lines, one stock voice, cache in place, the ratified duration-resize pipeline above.
2. Per-speaker voices (`ELEVENLABS_VOICE_USER`/`ELEVENLABS_VOICE_CLAUDE`) + ducking polish + Lambda-compatible cache upload.
