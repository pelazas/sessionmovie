import { BEATS } from "./beats";
import { makePackAudio } from "./makePackAudio";
import type { SfxKind } from "./events";

// All assets are CC0 and listed in CREDITS.md (repo root).

/** The v1 SFX set — shared by every pack until one brings its own. */
export const SHARED_SFX: Record<SfxKind, string> = {
  thock: "audio/sfx-key-thock.ogg",
  tick: "audio/sfx-chip-tick.ogg",
  fail: "audio/sfx-fail-thud.ogg",
  pass: "audio/sfx-pass-chime.ogg",
  // feat/effects (all CC0, CREDITS.md)
  whoosh: "audio/sfx-transition-whoosh.ogg",
  drone: "audio/sfx-tension-drone.ogg",
  stinger: "audio/sfx-end-stinger.ogg",
};

export const SHARED_SFX_VOLUMES: Record<SfxKind, number> = {
  thock: 0.35,
  tick: 0.5,
  fail: 0.9,
  pass: 0.85,
  // feat/effects
  whoosh: 0.55,
  drone: 0.4,
  stinger: 0.75,
};

/** The classic pack's soundtrack: the cyber-runner bed over the shared SFX. */
export const ClassicAudio = makePackAudio({
  track: "audio/music-cyber-runner.ogg",
  beats: BEATS,
  sfx: SHARED_SFX,
  sfxVolumes: SHARED_SFX_VOLUMES,
});
