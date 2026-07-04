import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { EASE_OUT } from "../../../easing";
import { titleSchedule } from "../../../timing";
import { cameraDrift, flash, shake } from "../../../effects";
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
  const drift = cameraDrift(frame, "classic-title", durationInFrames);
  const { fps } = useVideoConfig();

  // Schedule (cold open, typing speed) comes from the shared timing module —
  // the audio layer reads the same numbers for its keystroke SFX.
  const { coldOpenFrames, typingStart, charsPerFrame, typingEnd } = titleSchedule(
    scene,
    durationInFrames,
  );
  const cardFrame = frame - coldOpenFrames;

  const panelIn = interpolate(cardFrame, [0, 20], [0, 1], {
    easing: EASE_OUT,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const typedChars = Math.max(0, Math.floor((cardFrame - typingStart) * charsPerFrame));
  const typed = scene.task.slice(0, typedChars);
  const cursorOn = Math.floor(frame / (fps / 2)) % 2 === 0;
  const captionIn = interpolate(cardFrame, [typingEnd + 5, typingEnd + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (scene.coldOpen && frame < coldOpenFrames) {
    // feat/effects: the cold open is a PICTURE — the climax as a red terminal
    // frame mid-catastrophe (impact shake + red flash on entry), then the
    // smash-cut to the title card.
    const flashIn = interpolate(frame, [0, 6], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const jolt = shake(frame, 0, 10);
    const redWash = flash(frame, 0, 10);
    return (
      <AbsoluteFill
        style={{
          backgroundColor: theme.bg,
          justifyContent: "center",
          alignItems: "center",
          fontFamily: theme.mono,
          padding: 70,
          transform: `${drift.transform} translate(${jolt.x}px, ${jolt.y}px)`,
        }}
      >
        <div
          style={{
            width: "100%",
            backgroundColor: theme.panel,
            border: `3px solid ${theme.red}`,
            borderRadius: 20,
            overflow: "hidden",
            opacity: flashIn,
            transform: `scale(${0.94 + flashIn * 0.06})`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "22px 32px",
              borderBottom: `2px solid ${theme.panelBorder}`,
            }}
          >
            {[theme.red, theme.yellow, theme.green].map((c) => (
              <div key={c} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c }} />
            ))}
            <span style={{ color: theme.red, fontSize: 30, marginLeft: 14 }}>terminal — the bad moment</span>
          </div>
          <div style={{ padding: 44, backgroundColor: theme.redBg }}>
            {[0.4, 0.7, 0.55].map((w, i) => (
              <div
                key={i}
                style={{
                  height: 20,
                  width: `${w * 100}%`,
                  borderRadius: 6,
                  backgroundColor: theme.red,
                  opacity: 0.35,
                  marginBottom: 18,
                }}
              />
            ))}
            <div style={{ color: theme.red, fontSize: 62, fontWeight: 700, lineHeight: 1.25 }}>
              ✗ {scene.coldOpen.description}
            </div>
          </div>
        </div>
        <div style={{ color: theme.textDim, fontSize: 36, marginTop: 44, opacity: flashIn }}>
          2 hours earlier…
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: theme.red,
            opacity: redWash * 0.2,
            pointerEvents: "none",
          }}
        />
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
        transform: drift.transform,
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
