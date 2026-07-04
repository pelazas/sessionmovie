# Audio: music & voiceover

Two layers, different maturity: **music/SFX is v1** (in flight), **voiceover is planned** (designed here, built later). Nothing in this doc changes the frozen v1 schema — voiceover explicitly waits for a versioned schema bump.

## Music & SFX (v1)

Policy (binding, same as genre-packs.md):

- **CC0 only, verified.** "Royalty-free" and "free for YouTube" are not licenses. Check the actual license page of every asset (Pixabay license terms read carefully, Freesound filtered to CC0, FreePD). Attribution-required (CC-BY) is rejected even though we'd happily credit — because *downstream users* of this repo inherit the obligation and won't know.
- **Every asset lands in `CREDITS.md` in the same PR.** Source URL + license. A PR with an uncredited asset is rejected regardless of quality.
- **Beat grid is data.** Each track ships with a precomputed beat-timestamp array (`remotion/src/audio/beats.ts`); cuts and chip landings snap to it. Computed offline, committed as numbers with a comment on how.
- **Event SFX vocabulary (classic pack):** keyboard thock (typing), soft tick (chip lands), record-scratch (verdict=fail), level-up chime (verdict=pass), rising drone (fail streak — later). Genre packs override via `audio.sfx` in the pack contract.
- **Ducking:** music volume dips under SFX moments and (later) voiceover, via frame-math volume automation — no Web Audio, no nondeterminism.

## Voiceover — ElevenLabs (planned, not v1)

The pitch: genre-persona narration. The nature-doc pack *speaking* its deadpan captions ("here we observe the agent, reading the same file for the fourth time") is a step change in whoa. Design decisions locked now so the build is mechanical later:

### Where it sits in the pipeline

Narration is **screenwriter output, punch-up pass flavored** — the same text pipeline as captions, never ad-libbed at render time:

```
screenplay (with narration lines, genre voice)
  → TTS step in the CLI (pre-render): ElevenLabs API → mp3 per line
  → cache by hash(text + voiceId + settings)
  → Remotion <Audio> sequences, timed per scene
```

**Hard rule: no network inside compositions.** TTS runs as an explicit CLI step before `remotion render`; the composition only ever consumes local audio files. This preserves render determinism and keeps Remotion Lambda viable.

### Schema impact (v2, not now)

Voiceover needs an optional `narration?: string` per scene (written by the beat pass, rewritten by the punch-up pass like captions). The v1 schema is frozen — this ships as **screenplay `version: 2`** with a documented migration, per the CLAUDE.md contract rules. Until then, a prototype may narrate `caption` fields without schema changes.

### Determinism & caching

TTS output is nondeterministic per call, which breaks "same screenplay → bit-identical movie". Mitigation: content-addressed cache (`out/.tts-cache/<sha256>.mp3` keyed on text + voiceId + model + settings). Same screenplay re-renders reuse cached audio → deterministic in practice; regenerating the cache is an explicit `--refresh-voices` action.

### Timing

Narration must fit its scene, not stretch it: the screenwriter writes narration to a ~2.4 words/second budget against `targetSec` (schema-enforceable cap later, like the 90-char dialogue rule). After TTS, measured durations that overflow the scene get flagged; v-next may auto-shorten via one repair round ("say this in under N words"). Scene durations never grow to fit audio — the duration budget stays king.

### Voices & ethics

- **Stock/designed ElevenLabs voices only.** No cloning of real people (no fake Attenborough — a *generic* measured-documentary delivery, not an imitation of a specific person's voice).
- Voice choice is a genre-pack property: packs gain `audio.voice?: { voiceId, delivery }` next to `captionPersona`, so the same narration text sounds like a heist briefing in heist and a field log in nature-doc.
- Voiceover is **opt-in** (`--voiceover`), requires the user's own `ELEVENLABS_API_KEY`, and the redaction layer has already run upstream — narration text is screenplay text, which is redacted by construction.
- **Key permissions (field lesson, 2026-07-04):** ElevenLabs keys can be created scope-restricted. Synthesis needs **Text to Speech**; `doctor` validates keys with `GET /v1/voices`, which needs **Voices: Read** — so a TTS-only key renders fine but fails doctor with a bare 401 and a misleading "create a fresh key" hint. Known gap for v0.1.1: `checkApiKey` should surface the ElevenLabs error body (`missing_permissions` vs `invalid_api_key`, which is safe to print) and name the missing scope in the fix hint.

### Cost

~$0.10–0.30 per movie-minute of speech at current ElevenLabs pricing (a 60s movie has maybe 30–40s of narration). Still the only per-movie cost in the pipeline; everything else remains $0. The cost table in distribution-and-cost.md gains a "with voiceover" row when this ships.

### Build order (when we come back to this)

1. Prototype behind `--voiceover`: narrate existing `caption` fields, classic pack, one stock voice, cache in place. No schema change.
2. Schema v2: per-scene `narration`, screenwriter writes it beat-aware, punch-up flavors it per genre.
3. Pack voices + ducking polish + Lambda-compatible cache upload.
