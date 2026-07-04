import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { EASE_OUT } from "../../../easing";
import type { TitleScene } from "../../../screenplay";
import { titleSchedule } from "../../../timing";
import { flash, shake } from "../../../effects";
import { Monster } from "../Monster";
import { Caption } from "../../Caption";
import { quest } from "../theme";

/**
 * The quest board: cold open = an ominous warning, then the quest posting
 * with the user's task typing out as the bounty text. Typing speed comes
 * from the shared schedule so the keystroke SFX line up in any pack.
 */
export const QuestTitle: React.FC<{
  scene: TitleScene;
  caption?: string;
  durationInFrames: number;
}> = ({ scene, caption, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { coldOpenFrames, typingStart, charsPerFrame, typingEnd } = titleSchedule(
    scene,
    durationInFrames,
  );
  const cardFrame = frame - coldOpenFrames;

  if (scene.coldOpen && frame < coldOpenFrames) {
    // feat/effects: the cold open is a PICTURE — THE BUG at full HP looming
    // over the battlefield (entry jolt + red wash), then the smash-cut to
    // the bounty board.
    const flashIn = interpolate(frame, [0, 6], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const jolt = shake(frame, 0, 10);
    const redWash = flash(frame, 0, 10);
    const loom = 1 + Math.sin(frame * 0.1) * 0.015;
    return (
      <AbsoluteFill
        style={{
          backgroundColor: quest.bg,
          justifyContent: "center",
          alignItems: "center",
          fontFamily: quest.mono,
          padding: 80,
          transform: `translate(${jolt.x}px, ${jolt.y}px)`,
        }}
      >
        <div style={{ opacity: flashIn, transform: `scale(${loom})`, transformOrigin: "center bottom" }}>
          <Monster size={560} hp={1} wobble={Math.sin(frame * 0.12) * 6} />
        </div>
        <div
          style={{
            color: quest.red,
            fontSize: 58,
            fontWeight: 700,
            textAlign: "center",
            lineHeight: 1.3,
            marginTop: 40,
            opacity: flashIn,
          }}
        >
          {scene.coldOpen.description}
        </div>
        <div style={{ color: quest.textDim, fontSize: 36, marginTop: 40, opacity: flashIn }}>
          our story begins…
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: quest.red,
            opacity: redWash * 0.18,
            pointerEvents: "none",
          }}
        />
      </AbsoluteFill>
    );
  }

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

  return (
    <AbsoluteFill
      style={{
        backgroundColor: quest.bg,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: quest.mono,
        padding: 60,
      }}
    >
      <div
        style={{
          width: "100%",
          backgroundColor: quest.panel,
          border: `3px solid ${quest.gold}`,
          borderRadius: 10,
          overflow: "hidden",
          opacity: panelIn,
          transform: `translateY(${(1 - panelIn) * 80}px) scale(${0.94 + panelIn * 0.06})`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            padding: "28px 32px",
            borderBottom: `3px solid ${quest.panelBorder}`,
            color: quest.goldBright,
            fontSize: 44,
            fontWeight: 700,
            letterSpacing: 4,
          }}
        >
          ⚔ A NEW QUEST ⚔
        </div>
        <div style={{ padding: 48, minHeight: 420 }}>
          <div style={{ color: quest.textDim, fontSize: 32, marginBottom: 24 }}>
            the bounty board reads:
          </div>
          <div
            style={{
              color: quest.parchment,
              fontSize: 52,
              lineHeight: 1.4,
              overflowWrap: "break-word",
            }}
          >
            <span style={{ color: quest.gold }}>{"❯ "}</span>
            {typed}
            <span
              style={{
                display: "inline-block",
                width: 28,
                height: 58,
                marginLeft: 6,
                verticalAlign: "text-bottom",
                backgroundColor: quest.parchment,
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
