import { AbsoluteFill, Easing, Sequence, interpolate, useCurrentFrame } from "remotion";
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
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const puppet = (speaker: "user" | "claude") => {
    const speaking = activeSpeaker === speaker;
    const mascot = (
      <Mascot
        character={speaker === "user" ? "user" : "agent"}
        emotion={lastEmotion(speaker)}
        pose={speaking ? "point" : "idle"}
        size={290}
        seed={`dialogue-${speaker}`}
      />
    );
    // Restart the sequence clock on each spoken line so the "point" spring
    // re-fires per bubble instead of only once at scene start.
    return speaking && activeIndex >= 0 ? (
      <Sequence from={lineStart(activeIndex)} layout="none">
        {mascot}
      </Sequence>
    ) : (
      mascot
    );
  };

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, fontFamily: theme.mono }}>
      {/* bubble stack — bottom-aligned just above the puppets */}
      <div
        style={{
          position: "absolute",
          top: 70,
          left: 70,
          right: 70,
          bottom: 500,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          gap: 40,
        }}
      >
        {scene.lines.map((line, i) => {
          const start = lineStart(i);
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
