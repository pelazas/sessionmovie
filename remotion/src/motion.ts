import { Easing, interpolate, spring } from "remotion";

/** The single easing set (docs/visual-language.md "one motion grammar"). */
export const EASE = Easing.bezier(0.16, 1, 0.3, 1);      // entrances, reveals
export const EASE_POP = Easing.bezier(0.34, 1.56, 0.64, 1); // pops with overshoot

/** The three timing tokens — every transition uses one of these. */
export const MS = { fast: 200, normal: 400, slow: 800 } as const;
export const frames = (ms: number, fps: number): number => Math.max(1, Math.round((ms / 1000) * fps));

export interface Offset { x: number; y: number; }

/** Impact shake: decaying two-axis wobble; zero before/after — safe to add unconditionally. */
export const shake = (frame: number, start: number, intensity: number, durationFrames = 14): Offset => {
  const t = frame - start;
  if (t < 0 || t >= durationFrames) return { x: 0, y: 0 };
  const decay = 1 - t / durationFrames;
  return { x: Math.sin(t * 2.4) * intensity * decay, y: Math.cos(t * 1.7) * intensity * 0.6 * decay };
};

/** Scene-cut flash: opacity 1→0 over durationFrames from `at`; zero before. */
export const flash = (frame: number, at: number, durationFrames = 6): number =>
  frame < at ? 0 : interpolate(frame, [at, at + durationFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/** ~200ms squash-and-stretch that masks a character clip's hard cut (docs/characters.md).
 *  Fires from LOCAL frame 0 — wrap the character in a <Sequence> to re-fire on clip change. */
export const squashBounce = (localFrame: number, fps: number): { scaleX: number; scaleY: number } => {
  const d = frames(MS.fast, fps);
  if (localFrame >= d) return { scaleX: 1, scaleY: 1 };
  const s = spring({ frame: localFrame, fps, config: { damping: 12, stiffness: 260, mass: 0.6 }, durationInFrames: d });
  return { scaleX: 1.18 - 0.18 * s, scaleY: 0.82 + 0.18 * s };
};

/** Standard entrance: opacity + scale pop over `durationMs`. */
export const popIn = (localFrame: number, fps: number, durationMs = MS.normal): { opacity: number; scale: number } => {
  const p = interpolate(localFrame, [0, frames(durationMs, fps)], [0, 1], { easing: EASE_POP, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return { opacity: Math.min(1, p * 1.4), scale: 0.9 + 0.1 * p };
};

/** Standard fade. */
export const fade = (localFrame: number, fps: number, durationMs = MS.normal): number =>
  interpolate(localFrame, [0, frames(durationMs, fps)], [0, 1], { easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
