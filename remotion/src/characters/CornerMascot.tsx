import { useMemo } from "react";
import { interpolate, random, useCurrentFrame } from "remotion";
import { EASE_BACK_OUT } from "../easing";
import type { Emotion } from "../screenplay";
import { theme } from "../theme";
import { Mascot, type Pose } from "./Mascot";

/**
 * Corner-reaction mascot for action/showcase scenes: the agent types along,
 * facepalms on red, throws confetti on green (docs/characters.md). Sized at
 * the 120px floor the contact sheet verifies. Confetti is deterministic —
 * seeded random() offsets only, bursting on a fixed 70-frame loop.
 */

const CONFETTI_COLORS = [theme.green, theme.blue, theme.purple, theme.yellow, theme.red];
const CONFETTI_COUNT = 16;

const Confetti: React.FC<{ seed: string }> = ({ seed }) => {
  const frame = useCurrentFrame();
  const f = frame % 70;
  // Particle params depend on the seed only — computed once, not per frame.
  // Seed-scoped so two confetti bursts in one movie never share trajectories.
  const particles = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        angle: random(`${seed}-confetti-angle-${i}`) * Math.PI * 2,
        speed: 3 + random(`${seed}-confetti-speed-${i}`) * 4,
      })),
    [seed],
  );
  return (
    <>
      {particles.map(({ angle, speed }, i) => {
        const x = Math.cos(angle) * speed * f;
        const y = Math.sin(angle) * speed * f * 0.7 + f * f * 0.045; // gravity
        const fade = interpolate(f, [30, 62], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "20%",
              width: 14,
              height: 20,
              backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              opacity: fade,
              transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(f * (10 + i * 3)) % 360}deg)`,
            }}
          />
        );
      })}
    </>
  );
};

export const CornerMascot: React.FC<{
  emotion: Emotion;
  pose: Pose;
  size?: number;
  corner?: "bottom-left" | "bottom-right";
  confetti?: boolean;
  seed?: string;
}> = ({ emotion, pose, size = 150, corner = "bottom-right", confetti = false, seed }) => {
  const frame = useCurrentFrame();
  const pop = interpolate(frame, [0, 12], [0, 1], {
    easing: EASE_BACK_OUT,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        bottom: 34,
        [corner === "bottom-left" ? "left" : "right"]: 40,
        opacity: pop,
        transform: `scale(${0.5 + pop * 0.5})`,
        transformOrigin: "bottom center",
      }}
    >
      {confetti ? <Confetti seed={seed ?? "corner"} /> : null}
      <Mascot character="agent" emotion={emotion} pose={pose} size={size} seed={seed ?? "corner"} />
    </div>
  );
};
