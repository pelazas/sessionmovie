import { Audio, Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import type { Screenplay } from "../screenplay";
import { sceneStartFrame as sceneStartAt } from "../timing";
import { collectCues, sceneCutFrames, type SfxKind } from "./events";

// ── voiceover integration block, types (rewrite/voiceover-dialogue, PR-H) ───
// Renderer-side extension ONLY: the manifest is a sidecar in the composition
// input props (built pre-render by the CLI; docs/audio.md forbids network in
// compositions). The screenplay IR stays frozen. Types are type-only imports
// from the single source of truth — never re-declared (the PR #1 lesson).
import type { VoiceoverManifest } from "../../../src/voiceover/types";
import { sceneLocalTrack } from "../packs/voiceoverSync";
const VOICEOVER_VOLUME = 1.0;
/** −6dB duck, expressed as the LINEAR multiplier it actually is (not a dB
 * value) — constant under each line's whole window, ramped in/out. */
const VO_DUCK_LINEAR = 0.5;
const VO_DUCK_RAMP = 6; // frames to ramp in/out of the duck
// ── end voiceover integration block, types ──────────────────────────────────

const MUSIC_BASE = 0.4;
const DUCK_RADIUS = 12; // frames on each side of a duck point
const DUCK_FLOOR = 0.45; // music multiplier at the center of a duck

/** A pack's soundtrack ingredients — all assets CC0, listed in CREDITS.md. */
export interface PackAudioSpec {
  /** Music bed, as a public/ path for staticFile ("audio/…"). */
  track: string;
  /** The track's precomputed beat grid (docs/audio.md: beat grid is data). */
  beats: readonly number[];
  /** SFX assets by event kind, as public/ paths for staticFile. */
  sfx: Record<SfxKind, string>;
  sfxVolumes: Record<SfxKind, number>;
}

/**
 * Builds a pack's whole soundtrack layer: music bed under the full movie with
 * gentle ducks at scene cuts and verdict hits, plus per-event SFX and
 * per-line dialogue voiceover playback. Everything is scheduled with pure
 * frame math derived from the screenplay — no randomness, no clocks
 * (CLAUDE.md determinism rules). Extracted verbatim from ClassicAudio at the
 * second pack's own music bed (since removed — docs/genre-packs.md
 * "Extraction status"); packs differ only in the spec.
 */
export const makePackAudio = ({
  track,
  beats,
  sfx,
  sfxVolumes,
}: PackAudioSpec): React.FC<{
  screenplay: Screenplay & { voiceover?: VoiceoverManifest }; // voiceover (PR-H)
}> => {
  const PackAudio: React.FC<{
    screenplay: Screenplay & { voiceover?: VoiceoverManifest };
  }> = ({ screenplay }) => {
    const { fps, durationInFrames } = useVideoConfig();
    const cues = collectCues(screenplay, fps);
    // Duck under scene cuts and under the big verdict SFX (docs/audio.md).
    const duckFrames = [
      ...sceneCutFrames(screenplay, fps),
      ...cues.filter((c) => c.kind === "fail" || c.kind === "pass").map((c) => c.frame),
    ];

    // ── voiceover integration block, scheduling (PR-H) ────────────────────────
    // Each dialogue line gets its own global window: sceneStartFrame + its
    // sceneLocalTrack startFrame/endFrame (the SAME track Dialogue.tsx reads
    // via DialogueTrackContext — one source of truth for lips and music
    // alike). Narration windows duck the music to VO_DUCK_LINEAR with a
    // short deterministic ramp (pure frame math — no randomness, no clocks).
    const sceneStartFrame = (sceneIndex: number): number =>
      sceneStartAt(screenplay, sceneIndex, fps);
    const lineCues = screenplay.voiceover?.lineCues ?? [];
    const trackByScene = new Map<number, ReturnType<typeof sceneLocalTrack>>();
    for (const sceneIndex of new Set(lineCues.map((c) => c.sceneIndex))) {
      trackByScene.set(sceneIndex, sceneLocalTrack(lineCues, sceneIndex, fps));
    }
    const lineWindows = lineCues.map((cue) => {
      const local = trackByScene.get(cue.sceneIndex)?.find((t) => t.lineIndex === cue.lineIndex);
      const base = sceneStartFrame(cue.sceneIndex);
      return { cue, start: base + (local?.startFrame ?? 0), end: base + (local?.endFrame ?? 0) };
    });
    const voiceoverDuck = (f: number): number => {
      let duck = 1;
      for (const w of lineWindows) {
        const inRamp = interpolate(
          f,
          [w.start - VO_DUCK_RAMP, w.start, w.end, w.end + VO_DUCK_RAMP],
          [1, VO_DUCK_LINEAR, VO_DUCK_LINEAR, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        duck = Math.min(duck, inRamp);
      }
      return duck;
    };
    // ── end voiceover integration block, scheduling ────────────────────────────

    // Start playback on the track's first beat so the beat grid is phase-aligned
    // with frame 0 — scene cuts fall on whole seconds, which at ~120 BPM keeps
    // them within a frame of a beat (the pack's beats module).
    const musicStartFrom = Math.round(beats[0] * fps);

    const musicVolume = (f: number): number => {
      let duck = 1;
      for (const d of duckFrames) {
        const dist = Math.abs(f - d);
        if (dist < DUCK_RADIUS) {
          duck = Math.min(duck, DUCK_FLOOR + (1 - DUCK_FLOOR) * (dist / DUCK_RADIUS));
        }
      }
      const fadeIn = interpolate(f, [0, 10], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      const fadeOut = interpolate(f, [durationInFrames - 24, durationInFrames - 2], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      // voiceoverDuck(f) is 1 when --voiceover was not used (PR-H).
      return MUSIC_BASE * duck * voiceoverDuck(f) * fadeIn * fadeOut;
    };

    return (
      <>
        <Audio src={staticFile(track)} startFrom={musicStartFrom} volume={musicVolume} />
        {cues.map((cue, i) => (
          <Sequence
            key={i}
            from={cue.frame}
            {...(cue.maxFrames !== undefined ? { durationInFrames: Math.max(1, cue.maxFrames) } : {})}
            layout="none"
            name={`sfx-${cue.kind}`}
          >
            <Audio
              src={staticFile(sfx[cue.kind])}
              volume={(f) =>
                cue.maxFrames !== undefined
                  ? sfxVolumes[cue.kind] *
                    interpolate(f, [cue.maxFrames - 8, cue.maxFrames], [1, 0], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    })
                  : sfxVolumes[cue.kind]
              }
            />
          </Sequence>
        ))}
        {/* ── voiceover integration block, playback (PR-H) — one Sequence per
            dialogue LINE, not per scene ── */}
        {lineWindows.map(({ cue, start }) => (
          <Sequence
            key={`vo-${cue.sceneIndex}-${cue.lineIndex}`}
            from={start}
            layout="none"
            name={`voiceover-scene${cue.sceneIndex}-line${cue.lineIndex}`}
          >
            <Audio src={staticFile(cue.file)} volume={() => VOICEOVER_VOLUME} />
          </Sequence>
        ))}
        {/* ── end voiceover integration block, playback ── */}
      </>
    );
  };
  return PackAudio;
};
