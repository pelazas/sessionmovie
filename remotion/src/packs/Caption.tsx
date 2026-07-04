import { useContext } from "react";
import { useCurrentFrame } from "remotion";
import { captionRenderState } from "../../../src/voiceover/sync";
import { theme } from "../theme";
import { VoiceoverCueContext } from "./types";

/**
 * Editorial caption pinned to the bottom of a scene.
 *
 * With a narration cue in context (feat/vo-sync): measured narration is
 * reality — the caption appears when the cue starts, highlights word-by-word
 * from the cached timestamps, and releases within ~15 frames of narration
 * end. The scene's `opacity` prop is ignored in that mode; scene components
 * stay untouched. Without a cue: exactly the schedule-driven behavior.
 */
export const Caption: React.FC<{ text: string; opacity: number }> = ({
  text,
  opacity,
}) => {
  const cue = useContext(VoiceoverCueContext);
  const frame = useCurrentFrame();
  const state = captionRenderState(cue, frame, opacity);
  if (state.opacity <= 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 120,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: theme.mono,
        fontSize: 38,
        fontStyle: "italic",
        color: theme.textDim,
        opacity: state.opacity,
        padding: "0 80px",
      }}
    >
      {state.mode === "sync" && state.words && state.words.length > 0
        ? state.words.map((word, i) => (
            <span key={i} style={{ color: word.spoken ? theme.text : theme.textDim }}>
              {i > 0 ? " " : ""}
              {word.text}
            </span>
          ))
        : text}
    </div>
  );
};
