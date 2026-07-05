import { theme } from "../theme";

/**
 * Editorial caption pinned to the bottom of a scene — plain schedule-driven
 * fade via the `opacity` prop the caller computed. Dialogue scenes never
 * render this (the bubble is the caption, rewrite/voiceover-dialogue PR-H);
 * every other scene type's caption is silent editorial text, no narration.
 */
export const Caption: React.FC<{ text: string; opacity: number }> = ({
  text,
  opacity,
}) => {
  if (opacity <= 0) return null;

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
        color: theme.textPrimary,
        opacity,
        padding: "0 80px",
      }}
    >
      {text}
    </div>
  );
};
