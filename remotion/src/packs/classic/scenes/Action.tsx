import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { artifactSchedule } from "../../../timing";
import { Character } from "../../../characters/Character";
import { CornerMascot } from "../../../characters/CornerMascot";
import type { ActionScene } from "../../../screenplay";
import { theme } from "../../../theme";
import { Caption } from "../../Caption";
import { ClockChip } from "../../ClockChip";
import { ArtifactPanel, SubagentTasks } from "../ArtifactPanel";

/** One real artifact, characters carry the rest (docs/visual-language.md
 * "tone rule"). Action is SILENT — no voiceover cue is ever assigned to it. */
export const Action: React.FC<{
  scene: ActionScene;
  caption?: string;
  durationInFrames: number;
}> = ({ scene, caption, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { revealStart, captionIn: captionInAt } = artifactSchedule(durationInFrames);
  const captionIn = interpolate(frame, [captionInAt, captionInAt + 17], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (scene.artifact.kind === "subagents") {
    return (
      <AbsoluteFill
        style={{ backgroundColor: theme.bg, fontFamily: theme.mono, justifyContent: "center", alignItems: "center" }}
      >
        <div style={{ marginBottom: 60, maxWidth: "80%" }}>
          <SubagentTasks tasks={scene.artifact.tasks} />
        </div>
        <Character who="claude" emotion="neutral" clip="subagent-spawn" sizePx={280} seed="action-subagents" />
        <ClockChip />
        {caption ? <Caption text={caption} opacity={captionIn} /> : null}
      </AbsoluteFill>
    );
  }

  const failed = scene.artifact.kind === "command" && scene.artifact.exitCode !== 0;
  const passed = scene.artifact.kind === "command" && scene.artifact.exitCode === 0;

  return (
    <AbsoluteFill
      style={{ backgroundColor: theme.bg, fontFamily: theme.mono, justifyContent: "center", alignItems: "center", padding: 60 }}
    >
      <ArtifactPanel artifact={scene.artifact} durationInFrames={durationInFrames} style={{ width: "88%", maxWidth: 1500 }} />

      {/* corner reaction: types along, then reacts at the reveal — two
          Sequences so the squash-bounce hard-cut mask re-fires on the clip
          change (motion.ts squashBounce). */}
      <Sequence from={0} durationInFrames={revealStart} layout="none">
        <CornerMascot clip="typing" emotion="confident" seed="action-corner" />
      </Sequence>
      <Sequence from={revealStart} layout="none">
        <CornerMascot
          clip={failed ? "error-shake" : passed ? "celebrate" : "typing"}
          emotion={failed ? "panicking" : passed ? "celebrating" : "confident"}
          confetti={passed}
          seed="action-corner"
        />
      </Sequence>

      <ClockChip />
      {caption ? <Caption text={caption} opacity={captionIn} /> : null}
    </AbsoluteFill>
  );
};
