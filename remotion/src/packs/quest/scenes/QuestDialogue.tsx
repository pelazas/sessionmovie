import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Mascot } from "../../../characters/Mascot";
import { EASE_BACK_OUT, EASE_OUT } from "../../../easing";
import { cameraDrift } from "../../../effects";
import type { DialogueScene, Emotion } from "../../../screenplay";
import { dialogueSchedule } from "../../../timing";
import { Caption } from "../../Caption";
import { ClockChip } from "../../ClockChip";
import { quest } from "../theme";

/**
 * The campfire: the party talks it over between battles. Same bubble
 * schedule as classic (shared timing module) — only the world changes:
 * firelight, log seating, parchment bubbles.
 */
export const QuestDialogue: React.FC<{
  scene: DialogueScene;
  caption?: string;
  durationInFrames: number;
}> = ({ scene, caption, durationInFrames }) => {
  const frame = useCurrentFrame();
  const drift = cameraDrift(frame, "quest-dialogue", durationInFrames);
  const { usable, lineStart } = dialogueSchedule(scene, durationInFrames);

  let activeIndex = -1;
  for (let i = 0; i < scene.lines.length; i++) {
    if (frame >= lineStart(i)) activeIndex = i;
  }
  const lastEmotion = (speaker: "user" | "claude"): Emotion => {
    for (let i = activeIndex; i >= 0; i--) {
      const line = scene.lines[i];
      if (line && line.speaker === speaker) return line.emotion;
    }
    return "neutral";
  };

  const puppetsIn = interpolate(frame, [0, 12], [0, 1], {
    easing: EASE_OUT,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const captionIn = interpolate(frame, [usable, usable + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Deterministic fire flicker: two out-of-phase sines, no randomness.
  const flicker = 1 + Math.sin(frame * 0.45) * 0.08 + Math.sin(frame * 0.23 + 2) * 0.05;
  const glow = 0.5 + Math.sin(frame * 0.3) * 0.08;

  return (
    <AbsoluteFill style={{ backgroundColor: quest.bg, fontFamily: quest.mono, transform: drift.transform }}>
      {/* firelight pool on the ground */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: "12%",
          right: "12%",
          height: 500,
          borderRadius: "50%",
          background: `radial-gradient(ellipse at center bottom, rgba(${quest.fireRgb},${0.18 * glow}) 0%, transparent 70%)`,
        }}
      />

      {/* bubble stack — same balance rule as classic (issue #13) */}
      <div
        style={{
          position: "absolute",
          top: 70,
          left: 70,
          right: 70,
          bottom: 560,
          display: "flex",
          flexDirection: "column",
          justifyContent: scene.lines.length <= 2 ? "center" : "flex-end",
          gap: 40,
        }}
      >
        {scene.lines.map((line, i) => {
          const start = lineStart(i);
          const p = interpolate(frame, [start, start + 12], [0, 1], {
            easing: EASE_BACK_OUT,
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          if (p === 0) return null;
          const superseded =
            i + 4 < scene.lines.length
              ? interpolate(frame, [lineStart(i + 4), lineStart(i + 4) + 10], [1, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              : 1;
          if (superseded === 0) return null;
          const isUser = line.speaker === "user";
          const color = isUser ? quest.green : quest.gold;
          return (
            <div
              key={i}
              style={{
                alignSelf: isUser ? "flex-start" : "flex-end",
                maxWidth: "82%",
                opacity: p * superseded,
                maxHeight: superseded < 1 ? `${superseded * 400}px` : undefined,
                overflow: superseded < 1 ? "hidden" : undefined,
                transform: `scale(${0.7 + p * 0.3}) translateY(${(1 - p) * 30}px)`,
                transformOrigin: isUser ? "bottom left" : "bottom right",
              }}
            >
              <div
                style={{
                  backgroundColor: quest.panel,
                  border: `2px solid ${color}`,
                  borderRadius: 20,
                  [isUser ? "borderBottomLeftRadius" : "borderBottomRightRadius"]: 4,
                  padding: "30px 40px",
                  color: quest.text,
                  fontSize: 44,
                  lineHeight: 1.35,
                }}
              >
                {line.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* the campfire between the party */}
      <div
        style={{
          position: "absolute",
          bottom: 210,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <svg viewBox="0 0 200 160" width={230} style={{ transform: `scaleY(${flicker})`, transformOrigin: "bottom" }}>
          <path d="M100 8 C124 44 146 60 146 100 A46 46 0 0 1 54 100 C54 60 76 44 100 8" fill={quest.fire} />
          <path d="M100 46 C112 68 124 76 124 102 A24 24 0 0 1 76 102 C76 76 88 68 100 46" fill={quest.goldBright} />
        </svg>
        {/* logs */}
        <div style={{ position: "absolute", bottom: -18, display: "flex", gap: 8 }}>
          <div style={{ width: 190, height: 26, borderRadius: 13, backgroundColor: quest.panelBorder, transform: "rotate(-8deg)" }} />
          <div style={{ width: 190, height: 26, borderRadius: 13, backgroundColor: quest.panelBorder, transform: "rotate(8deg)", marginLeft: -120 }} />
        </div>
      </div>

      {/* the party, warmed by the fire */}
      <div
        style={{
          position: "absolute",
          bottom: 180,
          left: 70,
          opacity: puppetsIn,
          transform: `translateY(${(1 - puppetsIn) * 60}px)`,
        }}
      >
        <Mascot character="user" emotion={lastEmotion("user")} pose="idle" size={270} seed="quest-fire-user" />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 180,
          right: 70,
          opacity: puppetsIn,
          transform: `translateY(${(1 - puppetsIn) * 60}px)`,
        }}
      >
        <Mascot character="agent" emotion={lastEmotion("claude")} pose="idle" size={270} seed="quest-fire-agent" />
      </div>

      <ClockChip color={quest.textDim} background={quest.panel} border={quest.panelBorder} />

      {caption ? <Caption text={caption} opacity={captionIn} /> : null}
    </AbsoluteFill>
  );
};
