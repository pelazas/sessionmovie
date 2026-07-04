import { Audio, Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import type { Screenplay } from "../screenplay";
import { BEATS } from "./beats";
import { collectCues, sceneCutFrames, type SfxKind } from "./events";

// All assets are CC0 and listed in CREDITS.md (repo root).
const SRC: Record<"music" | SfxKind, string> = {
  music: "audio/music-cyber-runner.ogg",
  thock: "audio/sfx-key-thock.ogg",
  tick: "audio/sfx-chip-tick.ogg",
  fail: "audio/sfx-fail-thud.ogg",
  pass: "audio/sfx-pass-chime.ogg",
};

const SFX_VOLUME: Record<SfxKind, number> = {
  thock: 0.35,
  tick: 0.5,
  fail: 0.9,
  pass: 0.85,
};

const MUSIC_BASE = 0.4;
const DUCK_RADIUS = 12; // frames on each side of a duck point
const DUCK_FLOOR = 0.45; // music multiplier at the center of a duck

/**
 * The classic pack's whole soundtrack: music bed under the full movie with
 * gentle ducks at scene cuts and verdict hits, plus per-event SFX. Everything
 * is scheduled with pure frame math derived from the screenplay — no
 * randomness, no clocks (CLAUDE.md determinism rules).
 */
export const ClassicAudio: React.FC<{ screenplay: Screenplay }> = ({ screenplay }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const cues = collectCues(screenplay, fps);
  // Duck under scene cuts and under the big verdict SFX (docs/audio.md).
  const duckFrames = [
    ...sceneCutFrames(screenplay, fps),
    ...cues.filter((c) => c.kind === "fail" || c.kind === "pass").map((c) => c.frame),
  ];

  // Start playback on the track's first beat so the beat grid is phase-aligned
  // with frame 0 — scene cuts fall on whole seconds, which at ~120 BPM keeps
  // them within a frame of a beat (BEATS in ./beats.ts).
  const musicStartFrom = Math.round(BEATS[0] * fps);

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
    return MUSIC_BASE * duck * fadeIn * fadeOut;
  };

  return (
    <>
      <Audio src={staticFile(SRC.music)} startFrom={musicStartFrom} volume={musicVolume} />
      {cues.map((cue, i) => (
        <Sequence key={i} from={cue.frame} layout="none" name={`sfx-${cue.kind}`}>
          <Audio src={staticFile(SRC[cue.kind])} volume={() => SFX_VOLUME[cue.kind]} />
        </Sequence>
      ))}
    </>
  );
};
