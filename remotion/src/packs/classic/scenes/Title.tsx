import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { EASE_OUT } from "../../../easing";
import type { TitleScene } from "../../../screenplay";
import { theme } from "../../../theme";
import { Caption } from "../../Caption";

export const Title: React.FC<{
  scene: TitleScene;
  caption?: string;
  repo?: string;
  durationInFrames: number;
}> = ({ scene, caption, repo, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Cold open: the most dramatic moment flashes before the title card.
  const coldOpenFrames = scene.coldOpen ? Math.round(durationInFrames * 0.22) : 0;
  const cardFrame = frame - coldOpenFrames;

  const panelIn = interpolate(cardFrame, [0, 20], [0, 1], {
    easing: EASE_OUT,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // The prompt types itself out — speed fits the scene budget: typing always
  // finishes by ~65% of the card's frames, however long the task is.
  const typingStart = 15;
  const cardFrames = durationInFrames - coldOpenFrames;
  const charsPerFrame = Math.max(
    0.9,
    scene.task.length / Math.max(10, cardFrames * 0.65 - typingStart),
  );
  const typedChars = Math.max(0, Math.floor((cardFrame - typingStart) * charsPerFrame));
  const typed = scene.task.slice(0, typedChars);
  const cursorOn = Math.floor(frame / (fps / 2)) % 2 === 0;

  const typingEnd = typingStart + scene.task.length / charsPerFrame;
  const captionIn = interpolate(cardFrame, [typingEnd + 5, typingEnd + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (scene.coldOpen && frame < coldOpenFrames) {
    const flashIn = interpolate(frame, [0, 6], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return (
      <AbsoluteFill
        style={{
          backgroundColor: theme.bg,
          justifyContent: "center",
          alignItems: "center",
          fontFamily: theme.mono,
          padding: 90,
        }}
      >
        <div
          style={{
            color: theme.red,
            fontSize: 72,
            fontWeight: 700,
            textAlign: "center",
            lineHeight: 1.3,
            opacity: flashIn,
            transform: `scale(${0.92 + flashIn * 0.08})`,
          }}
        >
          {scene.coldOpen.description}
        </div>
        <div style={{ color: theme.textDim, fontSize: 36, marginTop: 48, opacity: flashIn }}>
          2 hours earlier…
        </div>
      </AbsoluteFill>
    );
  }

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
