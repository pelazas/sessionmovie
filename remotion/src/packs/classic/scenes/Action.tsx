import {
  AbsoluteFill,
  interpolate,
  random,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { EASE_OUT } from "../../../easing";
import { actionSchedule } from "../../../timing";
import { CornerMascot } from "../../../characters/CornerMascot";
import type { ActionScene, ToolEvent } from "../../../screenplay";
import { theme } from "../../../theme";
import { Caption } from "../../Caption";

// Category palette covering the tools real sessions are made of; ok/fail
// status wins over category so the red/green beats always read.
const TOOL_COLORS: Record<string, string> = {
  Read: theme.blue,
  Glob: theme.blue,
  Grep: theme.purple,
  WebFetch: theme.purple,
  WebSearch: theme.purple,
  Task: theme.purple,
  Edit: theme.yellow,
  Write: theme.yellow,
  NotebookEdit: theme.yellow,
  Bash: theme.green,
  Skill: theme.green,
};

const toolColor = (event: ToolEvent): string => {
  if (event.ok === false) return theme.red;
  return TOOL_COLORS[event.tool] ?? theme.text;
};

const CHIP_GAP = 150;

export const Action: React.FC<{
  scene: ActionScene;
  caption?: string;
  durationInFrames: number;
}> = ({ scene, caption, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { height, fps } = useVideoConfig();

  // Chip pacing comes from the shared timing module — the audio layer reads
  // the same schedule for its per-chip ticks.
  const { slideDur, chipStart, chipLanded } = actionSchedule(scene, durationInFrames);

  // One progress evaluation per chip per frame, shared by scroll and render.
  const progresses = scene.events.map((_e, i) =>
    interpolate(frame, [chipStart(i), chipStart(i) + slideDur], [0, 1], {
      easing: EASE_OUT,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  // Every chip that lands pushes the whole stack up by one slot.
  const scrollUp = progresses.reduce((acc, p) => acc + p, 0);
  const baselineY = height * 0.62;

  // Landing frame of the most recent failed chip (-1 if none yet) —
  // drives the corner mascot's sweat beat.
  let recentFailFrames = -1;
  scene.events.forEach((event, i) => {
    const landed = chipLanded(i);
    if (event.ok === false && frame >= landed) recentFailFrames = landed;
  });

  const captionIn = interpolate(frame, [8, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{ backgroundColor: theme.bg, fontFamily: theme.mono, overflow: "hidden" }}
    >
      {scene.events.map((event, i) => {
        const p = progresses[i] ?? 0;
        if (p === 0) return null;
        const y = baselineY + i * CHIP_GAP - scrollUp * CHIP_GAP;
        // Fade chips out as they ride off the top.
        const fadeOut = interpolate(y, [120, height * 0.28], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        if (fadeOut === 0) return null; // fully scrolled off — stop painting it
        const jitter = (random(`chip-${i}`) - 0.5) * 4; // deterministic tilt, deg
        const color = toolColor(event);
        const isFail = event.ok === false;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: y,
              left: 90,
              right: 90,
              display: "flex",
              alignItems: "center",
              gap: 24,
              padding: "26px 36px",
              borderRadius: 18,
              backgroundColor: isFail ? theme.redBg : theme.panel,
              border: `2px solid ${isFail ? theme.red : theme.panelBorder}`,
              opacity: p * fadeOut,
              transform: `translateX(${(1 - p) * 900}px) rotate(${jitter * (1 - p) + jitter * 0.3}deg)`,
              fontSize: 40,
            }}
          >
            <span style={{ color, fontWeight: 700, flexShrink: 0 }}>{event.tool}</span>
            <span
              style={{
                color: theme.textDim,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {event.summary}
            </span>
            {isFail ? (
              <span
                style={{
                  color: theme.red,
                  marginLeft: "auto",
                  opacity: Math.floor(frame / (fps / 6)) % 2 === 0 ? 1 : 0.4,
                }}
              >
                ✗
              </span>
            ) : null}
            {event.ok === true ? (
              <span style={{ color: theme.green, marginLeft: "auto" }}>✓</span>
            ) : null}
          </div>
        );
      })}
      {/* Soft masks so chips dissolve at the edges instead of hard-clipping. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 220,
          background: `linear-gradient(${theme.bg}, transparent)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 300,
          background: `linear-gradient(transparent, ${theme.bg})`,
        }}
      />
      {/* corner-reaction mascot (issue #8): types along with the stream,
          sweats for a beat whenever a red chip lands. Rendered BEFORE the
          caption so editorial text always paints on top of the puppet. */}
      <CornerMascot
        pose="typing"
        emotion={recentFailFrames >= 0 && frame - recentFailFrames < 55 ? "panicking" : "neutral"}
        seed="action-corner"
      />
      {caption ? <Caption text={caption} opacity={captionIn} /> : null}
    </AbsoluteFill>
  );
};
