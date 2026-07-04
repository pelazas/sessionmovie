import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { TitleScene } from "../screenplay/types";
import { theme } from "../theme";
import { Caption } from "./Caption";

export const Title: React.FC<{
  scene: TitleScene;
  caption?: string;
  repo?: string;
}> = ({ scene, caption, repo }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const panelIn = interpolate(frame, [0, 20], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // The prompt types itself out — the inciting incident.
  const typingStart = 15;
  const charsPerFrame = 0.9;
  const typedChars = Math.max(
    0,
    Math.floor((frame - typingStart) * charsPerFrame),
  );
  const typed = scene.task.slice(0, typedChars);
  const doneTyping = typedChars >= scene.task.length;
  const cursorOn = Math.floor(frame / (fps / 2)) % 2 === 0;

  const captionIn = doneTyping
    ? interpolate(frame, [typingStart + scene.task.length / charsPerFrame + 5, typingStart + scene.task.length / charsPerFrame + 20], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: theme.mono,
        padding: 60,
      }}
    >
      <div
        style={{
          width: "100%",
          backgroundColor: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          borderRadius: 24,
          overflow: "hidden",
          opacity: panelIn,
          transform: `translateY(${(1 - panelIn) * 80}px) scale(${0.94 + panelIn * 0.06})`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "24px 32px",
            borderBottom: `2px solid ${theme.panelBorder}`,
          }}
        >
          {[theme.red, theme.yellow, theme.green].map((c) => (
            <div
              key={c}
              style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c }}
            />
          ))}
          <span style={{ color: theme.textDim, fontSize: 30, marginLeft: 16 }}>
            {repo ?? "session"}
          </span>
        </div>
        <div style={{ padding: 48, minHeight: 420 }}>
          <div style={{ color: theme.textDim, fontSize: 34, marginBottom: 24 }}>
            {"$ claude"}
          </div>
          <div
            style={{
              color: theme.text,
              fontSize: 52,
              lineHeight: 1.4,
              overflowWrap: "break-word",
            }}
          >
            <span style={{ color: theme.blue }}>{"> "}</span>
            {typed}
            <span
              style={{
                display: "inline-block",
                width: 28,
                height: 58,
                marginLeft: 6,
                verticalAlign: "text-bottom",
                backgroundColor: theme.text,
                opacity: cursorOn ? 1 : 0,
              }}
            />
          </div>
        </div>
      </div>
      {caption ? <Caption text={caption} opacity={captionIn} /> : null}
    </AbsoluteFill>
  );
};
