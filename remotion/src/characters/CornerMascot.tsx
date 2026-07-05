import { useMemo } from "react";
import { interpolate, random, useCurrentFrame } from "remotion";
import { EASE_POP } from "../motion";
import type { Emotion } from "../screenplay";
import { theme } from "../theme";
import { Character, type Clip } from "./Character";

const CONFETTI_COLORS = [theme.ok, theme.accent, theme.accentBright, theme.fail, theme.textDim];
const CONFETTI_COUNT = 16;

const Confetti: React.FC<{ seed: string }> = ({ seed }) => {
  const frame = useCurrentFrame();
  const f = frame % 70;
  const particles = useMemo(() => Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
    angle: random(`${seed}-c-angle-${i}`) * Math.PI * 2, speed: 3 + random(`${seed}-c-speed-${i}`) * 4,
  })), [seed]);
  return <>{particles.map(({ angle, speed }, i) => {
    const x = Math.cos(angle) * speed * f;
    const y = Math.sin(angle) * speed * f * 0.7 + f * f * 0.045;
    const fade = interpolate(f, [30, 62], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return <div key={i} style={{ position: "absolute", left: "50%", top: "20%", width: 14, height: 20, backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length], opacity: fade, transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(f * (10 + i * 3)) % 360}deg)` }} />;
  })}</>;
};

/** Agent corner reaction for action/showcase scenes. Clip is renderer-chosen
 * (typing along, error-shake on a failed command, celebrate on success). */
export const CornerMascot: React.FC<{
  emotion: Emotion; clip: Clip; size?: number; corner?: "bottom-left" | "bottom-right"; confetti?: boolean; seed?: string;
}> = ({ emotion, clip, size = 150, corner = "bottom-right", confetti = false, seed }) => {
  const frame = useCurrentFrame();
  const pop = interpolate(frame, [0, 12], [0, 1], { easing: EASE_POP, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", bottom: 34, [corner === "bottom-left" ? "left" : "right"]: 40, opacity: pop, transform: `scale(${0.5 + pop * 0.5})`, transformOrigin: "bottom center" }}>
      {confetti ? <Confetti seed={seed ?? "corner"} /> : null}
      <Character who="claude" emotion={emotion} clip={clip} sizePx={size} seed={seed ?? "corner"} />
    </div>
  );
};
