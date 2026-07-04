import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { EASE_BACK_OUT, EASE_OUT } from "../easing";
import { Mascot } from "../characters/Mascot";
import type { DialogueScene } from "../screenplay";
import type { Emotion } from "../screenplay";
import { theme } from "../theme";
import { Caption } from "./Caption";

// The characters' main stage: both puppets stand at the bottom (user left/
// blue, claude right/purple) while speech bubbles pop in above them. The
// puppets replace the old name tags — the bubble tail side + puppet identify
// the speaker, and the speaking puppet wears the line's emotion.
export const Dialogue: React.FC<{
  scene: DialogueScene;
  caption?: string;
  durationInFrames: number;
}> = ({ scene, caption, durationInFrames }) => {
  const frame = useCurrentFrame();

  // All bubbles land within the first ~70% of the scene, however many there are.
  const usable = durationInFrames * 0.7;
  const interval = Math.max(6, (usable - 10) / scene.lines.length);
  const lineStart = (i: number) => 10 + i * interval;

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
  const activeSpeaker = activeIndex >= 0 ? scene.lines[activeIndex]?.speaker : undefined;

  const captionIn = interpolate(frame, [usable, usable + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const puppetsIn = interpolate(frame, [0, 12], [0, 1], {
    easing: EASE_OUT,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Last line index this speaker delivered at or before the active line.
  const speakerLineIndex = (speaker: "user" | "claude"): number => {
    for (let i = activeIndex; i >= 0; i--) {
      if (scene.lines[i]?.speaker === speaker) return i;
    }
    return -1;
  };

  // A puppet points while its line is on the air, keeps pointing while the
  // NEXT bubble pops in (the pop steals the eye, hiding the arm release),
  // and everyone relaxes to idle once the conversation is over — no statue
  // pointing at nothing through the caption beat.
  const HOLDOVER = 14;
  const conversationOver = frame >= usable + 15;
  const isPointing = (speaker: "user" | "claude"): boolean => {
    if (conversationOver) return false;
    const li = speakerLineIndex(speaker);
    if (li < 0) return false;
    if (activeSpeaker === speaker) return true;
    return li === activeIndex - 1 && frame < lineStart(activeIndex) + HOLDOVER;
  };

  const puppet = (speaker: "user" | "claude") => {
    const pointing = isPointing(speaker);
    const li = speakerLineIndex(speaker);
    const mascot = (
      <Mascot
        character={speaker === "user" ? "user" : "agent"}
        emotion={lastEmotion(speaker)}
        pose={pointing ? "point" : "idle"}
        size={290}
        seed={`dialogue-${speaker}`}
      />
    );
    // Restart the sequence clock at the speaker's own line so the "point"
    // spring re-fires per bubble (and stays settled through the holdover).
    return pointing && li >= 0 ? (
      <Sequence from={lineStart(li)} layout="none">
        {mascot}
      </Sequence>
    ) : (
      mascot
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
          // Short dialogues bottom-aligned leave ~55% dead space up top;
          // centering balances them. Long stacks stay bottom-anchored so the
          // chat-log supersede fade keeps working (issue #13).
          // Center only short exchanges: 3 near-max lines (~630px wrapped) can
          // overflow the 510px area DOWNWARD into the puppets' heads when
          // centered; bottom-anchoring keeps the hard clearance above them.
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
          const color = isUser ? theme.blue : theme.purple;
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
      </div>

      {/* the stage — puppets replace name tags; speaker points, listener idles */}
      <div
        style={{
          position: "absolute",
          bottom: 180,
          left: 55,
          opacity: puppetsIn,
          transform: `translateY(${(1 - puppetsIn) * 60}px)`,
        }}
      >
        {puppet("user")}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 180,
          right: 55,
          opacity: puppetsIn,
          transform: `translateY(${(1 - puppetsIn) * 60}px)`,
        }}
      >
        {puppet("claude")}
      </div>

      {caption ? <Caption text={caption} opacity={captionIn} /> : null}
    </AbsoluteFill>
  );
};
