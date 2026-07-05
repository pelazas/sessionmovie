import type { CSSProperties } from "react";
import { interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Emotion } from "../screenplay";
import { theme } from "../theme";
import { shake, squashBounce } from "../motion";
import { CLAUDE_ART } from "./ClaudeArt";
import { makeUserArt } from "./UserArt";
import { useIdentity } from "./identity";
import { PIVOT, PuppetFrame, RIG_VIEWBOX, type RigTransforms } from "./rig";

export type Who = "claude" | "user";
export type Clip = "idle" | "walk" | "typing" | "thinking" | "celebrate" | "error-shake" | "subagent-spawn";

/** Emotion → clip (docs/characters.md lookup). error-shake & subagent-spawn are
 * renderer-triggered overrides (command-fail / subagents artifact), never here. */
const EMOTION_CLIP: Record<Emotion, Clip> = {
  neutral: "idle", confident: "idle", smug: "idle",
  confused: "thinking", defeated: "thinking", panicking: "thinking",
  celebrating: "celebrate",
};

const rot = (deg: number, p: readonly number[]): string => `rotate(${deg} ${p[0]} ${p[1]})`;

const ThinkingDots: React.FC = () => {
  const frame = useCurrentFrame();
  return <>{[0, 1, 2].map((i) => (
    <circle key={i} cx={150 + i * 14} cy={40 - i * 6} r={5} fill={theme.textDim}
      opacity={0.3 + 0.7 * Math.abs(Math.sin(frame * 0.08 - i * 0.5))} />
  ))}</>;
};

const MiniClaudes: React.FC<{ seed: string }> = ({ seed }) => {
  const frame = useCurrentFrame();
  return <>{Array.from({ length: 3 }, (_, i) => {
    const dir = (random(`${seed}-mini-${i}`) - 0.5) * 2;
    // Scurry out then HOLD (they went to their tasks, they stay) — a fade-out
    // would make the clip invisible at contact-sheet frame 45 and mid-scene.
    const dist = interpolate(frame, [0, 34], [0, 70], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const o = interpolate(frame, [0, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
      <g key={i} opacity={o} transform={`translate(${(dir * dist).toFixed(1)} ${(-Math.abs(dir) * 10).toFixed(1)})`}>
        <rect x={92} y={150} width={16} height={18} rx={4} fill={theme.accent} />
        <rect x={96} y={155} width={4} height={8} fill={theme.ink} />
        <rect x={100} y={155} width={4} height={8} fill={theme.ink} />
      </g>
    );
  })}</>;
};

export const Character: React.FC<{
  who: Who; emotion: Emotion; clip?: Clip; sizePx?: number; flip?: boolean; seed?: string; blink?: boolean; style?: CSSProperties;
}> = ({ who, emotion, clip, sizePx = 240, flip = false, seed, blink = true, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const identity = useIdentity();
  const s = seed ?? who;
  const t = frame + random(`char-${s}`) * 60;
  const active: Clip = clip ?? EMOTION_CLIP[emotion];

  let rig: RigTransforms = {};
  let lift = 0;
  let extra: React.ReactNode = null;

  switch (active) {
    case "idle": {
      const bob = Math.sin(t * 0.08) * 3;
      rig = { body: `translate(0 ${bob.toFixed(2)})`, head: rot(Math.sin(t * 0.05) * 2, PIVOT.head), armL: rot(Math.sin(t * 0.08) * 4, PIVOT.armL), armR: rot(Math.sin(t * 0.08 + Math.PI) * 4, PIVOT.armR) };
      break;
    }
    case "walk": {
      const sw = Math.sin(t * 0.5);
      rig = { body: `translate(0 ${(Math.abs(sw) * -3).toFixed(2)})`, legs: rot(6 * sw, PIVOT.legs), armL: rot(-18 * sw, PIVOT.armL), armR: rot(18 * sw, PIVOT.armR), head: rot(sw * 2, PIVOT.head) };
      break;
    }
    case "typing": {
      const alt = Math.sin(t * 0.55);
      const settle = spring({ frame, fps, config: { damping: 200 } });
      rig = { body: rot(2 * settle, PIVOT.body), head: `${rot(2 * settle, PIVOT.head)} translate(0 ${(Math.sin(t * 0.55 + 1) * 1.5).toFixed(2)})`, armL: rot(28 + 9 * alt, PIVOT.armL), armR: rot(-28 - 9 * alt, PIVOT.armR) };
      break;
    }
    case "thinking": {
      rig = { body: `translate(0 ${(Math.sin(t * 0.05) * 2.5).toFixed(2)})`, head: rot(-4 + Math.sin(t * 0.04) * 2, PIVOT.head), armL: rot(6, PIVOT.armL), armR: rot(-6, PIVOT.armR) };
      extra = <ThinkingDots />;
      break;
    }
    case "celebrate": {
      const b = spring({ frame, fps, config: { damping: 9, stiffness: 130 } });
      lift = Math.abs(Math.sin(t * 0.22)) * 10 * b;
      rig = { head: rot(Math.sin(t * 0.22) * 4 * b, PIVOT.head), armL: rot(130 * b, PIVOT.armL), armR: rot(-130 * b, PIVOT.armR) };
      break;
    }
    case "error-shake": {
      const sh = shake(frame, 0, 6, 18);
      rig = { body: `translate(${sh.x.toFixed(2)} ${sh.y.toFixed(2)})`, head: rot(6, PIVOT.head) };
      break;
    }
    case "subagent-spawn": {
      rig = { body: rot(-3 * spring({ frame, fps, config: { damping: 200 } }), PIVOT.body) };
      extra = <MiniClaudes seed={s} />;
      break;
    }
  }

  const blinking = blink && (frame + Math.floor(random(`char-${s}`) * 60)) % 72 < 5;
  const art = who === "claude" ? CLAUDE_ART : makeUserArt(identity);
  const sq = squashBounce(frame, fps); // local frame 0 — wrap in <Sequence> to re-fire on clip change
  const width = (sizePx * 200) / 240;

  return (
    <svg width={width} height={sizePx} viewBox={RIG_VIEWBOX} role="img" aria-label={`${who} ${emotion} ${active}`}
      style={{ ...style, overflow: "visible", transformOrigin: "bottom center",
        transform: `${flip ? "scaleX(-1) " : ""}translateY(${(-lift).toFixed(2)}px) scaleX(${sq.scaleX.toFixed(3)}) scaleY(${sq.scaleY.toFixed(3)})` }}>
      {extra}
      <PuppetFrame emotion={emotion} rig={rig} blink={blinking} art={art} />
    </svg>
  );
};
