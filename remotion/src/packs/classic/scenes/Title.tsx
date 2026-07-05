import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { titleSchedule } from "../../../timing";
import type { TitleScene } from "../../../screenplay";
import { theme } from "../../../theme";
import { EASE, popIn } from "../../../motion";
import { Character } from "../../../characters/Character";
import { useTitleMeta } from "../../sidecars";
import { Panel } from "../../Panel";
import { Caption } from "../../Caption";
import { ClockChip } from "../../ClockChip";

/** No cold open (docs/v1-storychange.md): both characters walk in from the
 * edges, settle to idle, then the mission types itself out. Title is SILENT —
 * no voiceover cue is ever assigned to it. */
export const Title: React.FC<{
  scene: TitleScene;
  durationInFrames: number;
}> = ({ scene, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const meta = useTitleMeta();

  const { walkInEnd, typingStart, charsPerFrame, captionIn: captionInAt } = titleSchedule(
    scene,
    durationInFrames,
  );

  const head = popIn(frame, fps);
  const typedChars = Math.max(0, Math.floor((frame - typingStart) * charsPerFrame));
  const typed = scene.task.slice(0, typedChars);
  const cursorOn = Math.floor(frame / (fps / 2)) % 2 === 0;

  const captionIn = interpolate(frame, [captionInAt, captionInAt + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const metaLine = [meta.repo, meta.dateLabel, meta.durationLabel]
    .filter((v): v is string => Boolean(v))
    .join(" · ");

  const walkIn = interpolate(frame, [0, walkInEnd], [1, 0], {
    easing: EASE,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        fontFamily: theme.mono,
        justifyContent: "center",
        alignItems: "center",
        padding: 70,
      }}
    >
      <div
        style={{
          color: theme.textPrimary,
          fontSize: 58,
          fontWeight: 700,
          textAlign: "center",
          marginBottom: 36,
          opacity: head.opacity,
          transform: `scale(${head.scale})`,
        }}
      >
        {scene.headline}
      </div>
      <Panel variant="code" title={meta.repo ?? "session"} style={{ width: "90%", maxWidth: 1500 }}>
        <div style={{ color: theme.textDim, fontSize: 32, marginBottom: 20 }}>{"$ claude"}</div>
        <div style={{ color: theme.textPrimary, fontSize: 46, lineHeight: 1.4, overflowWrap: "break-word" }}>
          <span style={{ color: theme.accent }}>{"> "}</span>
          {typed}
          <span
            style={{
              display: "inline-block",
              width: 24,
              height: 50,
              marginLeft: 6,
              verticalAlign: "text-bottom",
              backgroundColor: theme.textPrimary,
              opacity: cursorOn ? 1 : 0,
            }}
          />
        </div>
      </Panel>
      {metaLine ? <div style={{ color: theme.textDim, fontSize: 26, marginTop: 20 }}>{metaLine}</div> : null}

      {/* both characters walk in from the edges, then settle to idle — two
          Sequences so the squash-bounce hard-cut mask re-fires on the clip
          change (motion.ts squashBounce), not just once at frame 0. */}
      <div style={{ position: "absolute", bottom: 60, left: 100, transform: `translateX(${(-walkIn * 260).toFixed(1)}px)` }}>
        <Sequence from={0} durationInFrames={walkInEnd} layout="none">
          <Character who="user" emotion="neutral" clip="walk" sizePx={220} seed="title-user" />
        </Sequence>
        <Sequence from={walkInEnd} layout="none">
          <Character who="user" emotion="neutral" clip="idle" sizePx={220} seed="title-user" />
        </Sequence>
      </div>
      <div style={{ position: "absolute", bottom: 60, right: 100, transform: `translateX(${(walkIn * 260).toFixed(1)}px)` }}>
        <Sequence from={0} durationInFrames={walkInEnd} layout="none">
          <Character who="claude" emotion="neutral" clip="walk" sizePx={220} flip seed="title-claude" />
        </Sequence>
        <Sequence from={walkInEnd} layout="none">
          <Character who="claude" emotion="neutral" clip="idle" sizePx={220} flip seed="title-claude" />
        </Sequence>
      </div>

      <ClockChip />
      {scene.caption ? <Caption text={scene.caption} opacity={captionIn} /> : null}
    </AbsoluteFill>
  );
};
