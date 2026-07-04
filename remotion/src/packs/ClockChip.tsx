import { createContext, useContext } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";

/**
 * Timestamps are memory anchors (docs/v1-storychange.md): a small, dim
 * time-of-day chip in the top corner of every scene, so the day visibly
 * progresses even when no caption mentions it.
 *
 * The time arrives via the `sceneTimes` input-props sidecar — index-aligned
 * "HH:MM" strings (or null), formatted UPSTREAM where the transcript
 * timestamps live. The renderer never does Date/timezone math: formatting
 * here would make frames depend on the render host's TZ (determinism rule).
 * The frozen screenplay IR is untouched; this rides input props exactly like
 * the voiceover manifest does.
 */

/** The current scene's pre-formatted time-of-day; provided by PackComposition. */
export const SceneTimeContext = createContext<string | null>(null);

export const ClockChip: React.FC<{
  /** Pack palette overrides — defaults are the classic theme tokens. */
  color?: string;
  background?: string;
  border?: string;
}> = ({ color = theme.textDim, background = theme.panel, border = theme.panelBorder }) => {
  const time = useContext(SceneTimeContext);
  const frame = useCurrentFrame();
  if (!time) return null;

  const fadeIn = interpolate(frame, [6, 22], [0, 0.9], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        top: 44,
        right: 44,
        fontFamily: theme.mono,
        fontSize: 27,
        letterSpacing: 2,
        color,
        backgroundColor: background,
        border: `1px solid ${border}`,
        borderRadius: 999,
        padding: "10px 22px",
        opacity: fadeIn,
      }}
    >
      {time}
    </div>
  );
};
