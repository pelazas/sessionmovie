import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import type { DialogueScene } from "../screenplay";
import { theme } from "../theme";
import { Caption } from "./Caption";

// Speech-bubble dialogue: user on the left (blue), claude on the right
// (purple), popping in sequentially. Character sprites replace the name
// tags in v1.1; the layout and beat timing stay.
export const Dialogue: React.FC<{
  scene: DialogueScene;
  caption?: string;
  durationInFrames: number;
}> = ({ scene, caption, durationInFrames }) => {
  const frame = useCurrentFrame();

  // All bubbles land within the first ~70% of the scene, however many there are.
  const usable = durationInFrames * 0.7;
  const interval = Math.max(6, (usable - 10) / scene.lines.length);

  const captionIn = interpolate(frame, [usable, usable + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        fontFamily: theme.mono,
        justifyContent: "center",
        padding: "80px 70px",
        gap: 44,
      }}
    >
      {scene.lines.map((line, i) => {
        const start = 10 + i * interval;
        const p = interpolate(frame, [start, start + 12], [0, 1], {
          easing: Easing.bezier(0.34, 1.56, 0.64, 1),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        if (p === 0) return null;
        const isUser = line.speaker === "user";
        const color = isUser ? theme.blue : theme.purple;
        return (
          <div
            key={i}
            style={{
              alignSelf: isUser ? "flex-start" : "flex-end",
              maxWidth: "82%",
              opacity: p,
              transform: `scale(${0.7 + p * 0.3}) translateY(${(1 - p) * 30}px)`,
              transformOrigin: isUser ? "bottom left" : "bottom right",
            }}
          >
            <div
              style={{
                color,
                fontSize: 30,
                marginBottom: 12,
                textAlign: isUser ? "left" : "right",
              }}
            >
              {line.speaker} · {line.emotion}
            </div>
            <div
              style={{
                backgroundColor: theme.panel,
                border: `2px solid ${color}`,
                borderRadius: 24,
                [isUser ? "borderBottomLeftRadius" : "borderBottomRightRadius"]: 4,
                padding: "30px 40px",
                color: theme.text,
                fontSize: 44,
                lineHeight: 1.35,
              }}
            >
              {line.text}
            </div>
          </div>
        );
      })}
      {caption ? <Caption text={caption} opacity={captionIn} /> : null}
    </AbsoluteFill>
  );
};
