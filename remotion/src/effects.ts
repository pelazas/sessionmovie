import { interpolate, random } from "remotion";
import { EASE_OUT } from "./easing";

/**
 * The energy kit's effect primitives (docs/visual-language.md): pure,
 * deterministic, frame-driven — every function is (frame, …) → numbers, no
 * clocks, no Math.random (CLAUDE.md determinism rules; randomness only via
 * Remotion's seeded random()). Scenes compose these into transforms; the
 * primitives own the curves so both packs shake the same way.
 */

export interface Offset {
  x: number;
  y: number;
}

/**
 * Impact shake: decaying two-axis wobble starting at `start`. Zero before
 * the hit and after the decay — safe to add unconditionally.
 */
export const shake = (
  frame: number,
  start: number,
  intensity: number,
  durationFrames = 14,
): Offset => {
  const t = frame - start;
  if (t < 0 || t >= durationFrames) return { x: 0, y: 0 };
  const decay = 1 - t / durationFrames;
  return {
    x: Math.sin(t * 2.4) * intensity * decay,
    y: Math.cos(t * 1.7) * intensity * 0.6 * decay,
  };
};

/** Screen flash: opacity 1 → 0 over `durationFrames`, starting at `at`. */
export const flash = (frame: number, at: number, durationFrames = 6): number =>
  interpolate(frame, [at, at + durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/** Scale pulse: 1+amount at the hit, easing back to exactly 1. */
export const zoomPulse = (frame: number, at: number, amount = 0.06, durationFrames = 12): number => {
  const t = frame - at;
  if (t < 0 || t >= durationFrames) return 1;
  return 1 + amount * (1 - EASE_OUT(t / durationFrames));
};

export interface FreezeSlam {
  /** Feed THIS to inner animation instead of the real frame: time stops during the hold. */
  effectiveFrame: number;
  /** Scale for the frozen subject (slams in, holds, releases). */
  scale: number;
  /** True while frozen — callers can style the beat (dim chrome, vignette). */
  active: boolean;
}

/**
 * The anime beat: at `at`, time FREEZES for `holdFrames` while the subject
 * zooms in; then time resumes where it left off (the hold is inserted, not
 * skipped — inner animation continues seamlessly after release).
 */
export const freezeSlam = (
  frame: number,
  at: number,
  holdFrames = 18,
  zoom = 1.22,
): FreezeSlam => {
  if (frame < at) return { effectiveFrame: frame, scale: 1, active: false };
  if (frame < at + holdFrames) {
    const t = (frame - at) / holdFrames;
    const slamIn = EASE_OUT(Math.min(1, t * 3)); // reach full zoom in the first third
    return { effectiveFrame: at, scale: 1 + (zoom - 1) * slamIn, active: true };
  }
  const release = interpolate(frame, [at + holdFrames, at + holdFrames + 6], [zoom, 1], {
    easing: EASE_OUT,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { effectiveFrame: frame - holdFrames, scale: release, active: false };
};

export interface CameraDrift {
  scale: number;
  x: number;
  y: number;
  /** Ready-made CSS transform. */
  transform: string;
}

/**
 * Subtle per-scene camera life: a slow push-in (≤3%) with a seeded pan
 * direction, so no two scenes drift identically and no frame is ever
 * static. Deterministic: direction comes from Remotion's seeded random().
 */
export const cameraDrift = (
  frame: number,
  seed: string,
  durationInFrames: number,
): CameraDrift => {
  const progress = Math.min(1, Math.max(0, frame / Math.max(1, durationInFrames)));
  const angle = random(`drift-${seed}`) * Math.PI * 2;
  const scale = 1 + 0.025 * progress;
  const x = Math.cos(angle) * 8 * progress;
  const y = Math.sin(angle) * 8 * progress;
  return { scale, x, y, transform: `scale(${scale}) translate(${x}px, ${y}px)` };
};
