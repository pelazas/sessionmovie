import { BEATS } from "./beats";
import { makePackAudio } from "./makePackAudio";
import type { SfxKind } from "./events";

// All assets are CC0 and listed in CREDITS.md (repo root).

/** The v1 SFX set — shared by every pack until one brings its own. */
export const SHARED_SFX: Record<SfxKind, string> = {
  thock: "audio/sfx-key-thock.mp3",
  tick: "audio/sfx-chip-tick.mp3",
  fail: "audio/sfx-fail-thud.mp3",
  pass: "audio/sfx-pass-chime.mp3",
  // feat/effects (all CC0, CREDITS.md)
  whoosh: "audio/sfx-transition-whoosh.mp3",
  stinger: "audio/sfx-end-stinger.mp3",
};

export const SHARED_SFX_VOLUMES: Record<SfxKind, number> = {
  thock: 0.35,
  tick: 0.5,
  fail: 0.9,
  pass: 0.85,
  // feat/effects
  whoosh: 0.55,
  stinger: 0.75,
};

/** The classic pack's soundtrack: the lofi-chill bed over the shared SFX. */
export const ClassicAudio = makePackAudio({
  track: "audio/music-lofi-chill.mp3",
  beats: BEATS,
  sfx: SHARED_SFX,
  sfxVolumes: SHARED_SFX_VOLUMES,
});
