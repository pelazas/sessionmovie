import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { EASE_POP } from "../../../motion";
import { artifactSchedule } from "../../../timing";
import { Character } from "../../../characters/Character";
import type { ShowcaseScene } from "../../../screenplay";
import { theme } from "../../../theme";
import { Caption } from "../../Caption";
import { ClockChip } from "../../ClockChip";
import { ArtifactPanel, SubagentTasks } from "../ArtifactPanel";

const WASH = "#060809";

/** The finale remix — SAME artifact panel (or subagents choreography) as
 * Action, just larger/centered with a slow scale-in; zero duplicate artifact
 * code. Panels animate in place, no camera (docs/visual-language.md). */
export const Showcase: React.FC<{
  scene: ShowcaseScene;
  durationInFrames: number;
}> = ({ scene, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { captionIn: captionInAt } = artifactSchedule(durationInFrames);
  const captionIn = interpolate(frame, [captionInAt, captionInAt + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const panelIn = interpolate(frame, [0, 15], [0, 1], {
    easing: EASE_POP,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Slow push-in over the whole scene — the panel animates in place, never a camera.
  const slowScale = interpolate(frame, [0, durationInFrames], [1, 1.04], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{ backgroundColor: theme.bg, fontFamily: theme.mono, justifyContent: "center", alignItems: "center", padding: 40 }}
    >
      {/* darker wash — the finale remix reuses the same canvas, just quieter */}
      <div style={{ position: "absolute", inset: 0, backgroundColor: WASH, opacity: 0.5, pointerEvents: "none" }} />

      {scene.artifact.kind === "subagents" ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 48,
            opacity: panelIn,
            transform: `scale(${(0.9 + panelIn * 0.1) * slowScale})`,
          }}
        >
          <SubagentTasks tasks={scene.artifact.tasks} fontSize={32} gap={28} />
          <Character who="claude" emotion="celebrating" clip="subagent-spawn" sizePx={320} seed="showcase-subagents" />
        </div>
      ) : (
        // Transform lives on the SAME element as width/maxWidth (not a
        // wrapping div): a percentage width resolved against an unsized flex-
        // item wrapper is indeterminate and the panel overflows the frame.
        <div
          style={{
            width: "94%",
            maxWidth: 1600,
            opacity: panelIn,
            transform: `scale(${(0.9 + panelIn * 0.1) * slowScale})`,
            transformOrigin: "center",
          }}
        >
          <ArtifactPanel artifact={scene.artifact} durationInFrames={durationInFrames} />
        </div>
      )}

      {/* both characters, small, celebrating — the cast at curtain call */}
      <div style={{ position: "absolute", bottom: 40, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 40 }}>
        <Character who="user" emotion="celebrating" clip="celebrate" sizePx={140} seed="showcase-cast-user" />
        <Character who="claude" emotion="celebrating" clip="celebrate" sizePx={140} flip seed="showcase-cast-claude" />
      </div>

      <ClockChip />
      {scene.caption ? <Caption text={scene.caption} opacity={captionIn} /> : null}
    </AbsoluteFill>
  );
};
