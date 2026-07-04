import {
  AbsoluteFill,
  Easing,
  interpolate,
  random,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { ActionScene, ToolEvent } from "../screenplay/types";
import { theme } from "../theme";
import { Caption } from "./Caption";

const toolColor = (event: ToolEvent): string => {
  if (event.status === "fail") return theme.red;
  if (event.status === "ok") return theme.green;
  switch (event.tool) {
    case "Read":
      return theme.blue;
    case "Grep":
      return theme.purple;
    case "Edit":
      return theme.yellow;
    default:
      return theme.text;
  }
};

const CHIP_GAP = 150;

export const Action: React.FC<{
  scene: ActionScene;
  caption?: string;
  durationInFrames: number;
}> = ({ scene, caption, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { height, fps } = useVideoConfig();

  // Chips stream in over the first ~80% of the scene; montage packs them tighter.
  const streamFrames = durationInFrames * (scene.intensity === "montage" ? 0.75 : 0.9);
  const interval = Math.max(4, (streamFrames - 10) / scene.events.length);

  const slideDur = Math.min(12, interval);
  const chipProgress = (i: number) =>
    interpolate(frame, [10 + i * interval, 10 + i * interval + slideDur], [0, 1], {
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  // Every chip that lands pushes the whole stack up by one slot.
  const scrollUp = scene.events.reduce((acc, _e, i) => acc + chipProgress(i), 0);
  const baselineY = height * 0.62;

  const captionIn = interpolate(frame, [8, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{ backgroundColor: theme.bg, fontFamily: theme.mono, overflow: "hidden" }}
    >
      {scene.events.map((event, i) => {
        const p = chipProgress(i);
        if (p === 0) return null;
        const y = baselineY + i * CHIP_GAP - scrollUp * CHIP_GAP;
        // Fade chips out as they ride off the top.
        const fadeOut = interpolate(y, [120, height * 0.28], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const jitter = (random(`chip-${i}`) - 0.5) * 4; // deterministic tilt, deg
        const color = toolColor(event);
        const isFail = event.status === "fail";
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: y,
              left: 90,
              right: 90,
              display: "flex",
              alignItems: "center",
              gap: 24,
              padding: "26px 36px",
              borderRadius: 18,
              backgroundColor: isFail ? theme.redBg : theme.panel,
              border: `2px solid ${isFail ? theme.red : theme.panelBorder}`,
              opacity: p * fadeOut,
              transform: `translateX(${(1 - p) * 900}px) rotate(${jitter * (1 - p) + jitter * 0.3}deg)`,
              fontSize: 40,
            }}
          >
            <span style={{ color, fontWeight: 700 }}>{event.tool}</span>
            <span style={{ color: theme.textDim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {event.detail}
            </span>
            {event.status === "fail" ? (
              <span style={{ color: theme.red, marginLeft: "auto", opacity: Math.floor(frame / (fps / 6)) % 2 === 0 ? 1 : 0.4 }}>
                ✗
              </span>
            ) : null}
            {event.status === "ok" ? (
              <span style={{ color: theme.green, marginLeft: "auto" }}>✓</span>
            ) : null}
          </div>
        );
      })}
      {/* Soft masks so chips dissolve at the edges instead of hard-clipping. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 220,
          background: `linear-gradient(${theme.bg}, transparent)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 300,
          background: `linear-gradient(transparent, ${theme.bg})`,
        }}
      />
      {caption ? <Caption text={caption} opacity={captionIn} /> : null}
    </AbsoluteFill>
  );
};
