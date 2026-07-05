import { useContext } from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { EASE, EASE_POP } from "../../../motion";
import { dialogueBubbleSchedule } from "../../../timing";
import { Character } from "../../../characters/Character";
import type { DialogueScene, Emotion } from "../../../screenplay";
import { theme } from "../../../theme";
import { Caption } from "../../Caption";
import { ClockChip } from "../../ClockChip";
import { VoiceoverCueContext } from "../../types";

// The characters' main stage: both stand at the bottom (user left/coral
// border, claude right/neutral border) while speech bubbles pop in above
// them. Bubble border color + puppet side identify the speaker; the
// speaking puppet wears the line's emotion.
export const Dialogue: React.FC<{
  scene: DialogueScene;
  durationInFrames: number;
}> = ({ scene, durationInFrames }) => {
  const frame = useCurrentFrame();
  const cue = useContext(VoiceoverCueContext);

  // THE VO SEAM (PR-H): this scene calls ONLY dialogueBubbleSchedule — today
  // it's a thin wrapper over dialogueLeadSchedule (one caption cue drives the
  // whole scene's lead-in); PR-H reimplements the seam to start each bubble
  // at its own line's cue without touching this file.
  const { usable, lineStart } = dialogueBubbleSchedule(
    scene,
    durationInFrames,
    cue ? cue.endFrame : null,
  );

  // The line currently "on the air" drives the puppets.
  let activeIndex = -1;
  for (let i = 0; i < scene.lines.length; i++) {
    if (frame >= lineStart(i)) activeIndex = i;
  }

  // Each puppet holds its most recent line's emotion; neutral before speaking.
  const lastEmotion = (speaker: "user" | "claude"): Emotion => {
    for (let i = activeIndex; i >= 0; i--) {
      const line = scene.lines[i];
      if (line && line.speaker === speaker) return line.emotion;
    }
    return "neutral";
  };

  // Index of this speaker's own latest line at or before the active line —
  // -1 if they haven't spoken yet.
  const speakerLineIndex = (speaker: "user" | "claude"): number => {
    for (let i = activeIndex; i >= 0; i--) {
      if (scene.lines[i]?.speaker === speaker) return i;
    }
    return -1;
  };

  // Closing-beat caption opacity for cueless captions (with a cue, Caption
  // runs narration-driven in sync mode and ignores this schedule opacity).
  const captionIn = interpolate(frame, [usable, usable + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const puppetsIn = interpolate(frame, [0, 12], [0, 1], {
    easing: EASE,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Each puppet's squash-bounce beat re-fires at ITS OWN latest line (motion.ts:
  // wrap in a <Sequence> to re-fire on cut) — before their first line, render
  // unwrapped (no line to key a Sequence's `from` off yet).
  const puppet = (speaker: "user" | "claude", flip: boolean) => {
    const emotion = lastEmotion(speaker);
    const el = <Character who={speaker} emotion={emotion} sizePx={290} flip={flip} seed={`dialogue-${speaker}`} />;
    const li = speakerLineIndex(speaker);
    return li >= 0 ? (
      <Sequence from={lineStart(li)} layout="none">
        {el}
      </Sequence>
    ) : (
      el
    );
  };

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, fontFamily: theme.mono }}>
      {/* bubble stack — just above the puppets */}
      <div
        style={{
          position: "absolute",
          top: 70,
          left: 70,
          right: 70,
          bottom: 500,
          display: "flex",
          flexDirection: "column",
          // Short dialogues bottom-aligned leave dead space up top; centering
          // balances them. Long stacks stay bottom-anchored so the chat-log
          // supersede fade keeps working.
          justifyContent: scene.lines.length <= 2 ? "center" : "flex-end",
          gap: 40,
        }}
      >
        {scene.lines.map((line, i) => {
          const start = lineStart(i);
          const p = interpolate(frame, [start, start + 12], [0, 1], {
            easing: EASE_POP,
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          if (p === 0) return null;
          // The stack area fits ~4 big bubbles (schema has no cap on lines):
          // chat-log style, each bubble fades out as its 4th successor lands,
          // so long dialogues never push bubbles off the top of the frame.
          const superseded =
            i + 4 < scene.lines.length
              ? interpolate(frame, [lineStart(i + 4), lineStart(i + 4) + 10], [1, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              : 1;
          if (superseded === 0) return null;
          const isUser = line.speaker === "user";
          const color = isUser ? theme.accent : theme.panelBorder;
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
                  backgroundColor: theme.panel,
                  border: `2px solid ${color}`,
                  borderRadius: 24,
                  [isUser ? "borderBottomLeftRadius" : "borderBottomRightRadius"]: 4,
                  padding: "30px 40px",
                  color: theme.textPrimary,
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

      {/* the stage — user left (coral border echoed by bubbles), claude
          right (flipped) */}
      <div style={{ position: "absolute", bottom: 180, left: 55, opacity: puppetsIn, transform: `translateY(${(1 - puppetsIn) * 60}px)` }}>
        {puppet("user", false)}
      </div>
      <div style={{ position: "absolute", bottom: 180, right: 55, opacity: puppetsIn, transform: `translateY(${(1 - puppetsIn) * 60}px)` }}>
        {puppet("claude", true)}
      </div>

      <ClockChip />

      {scene.caption ? <Caption text={scene.caption} opacity={captionIn} /> : null}
    </AbsoluteFill>
  );
};
