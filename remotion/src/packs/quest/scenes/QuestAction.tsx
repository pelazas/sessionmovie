import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { CornerMascot } from "../../../characters/CornerMascot";
import { EASE_OUT } from "../../../easing";
import type { ActionScene, ToolEvent } from "../../../screenplay";
import { actionSchedule } from "../../../timing";
import { Caption } from "../../Caption";
import { Monster } from "../Monster";
import { quest } from "../theme";

/**
 * The battle: every tool call is an attack (or, when ok === false, the
 * monster counters). The chip schedule is the shared one — each landed
 * attack knocks the boss's HP down and lines up with the audio tick.
 */
const moveName = (event: ToolEvent): string => {
  const MOVES: Record<string, string> = {
    Read: "scouts",
    Grep: "tracks",
    Glob: "surveys",
    Bash: "strikes",
    Edit: "slashes",
    Write: "casts",
    Skill: "channels",
    WebFetch: "summons",
    WebSearch: "divines",
  };
  return MOVES[event.tool] ?? "attacks";
};

export const QuestAction: React.FC<{
  scene: ActionScene;
  caption?: string;
  durationInFrames: number;
}> = ({ scene, caption, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { slideDur, chipStart, chipLanded } = actionSchedule(scene, durationInFrames);

  // Landed attacks so far → boss HP + hit flash beat.
  let landedCount = 0;
  let lastLanded = -999;
  let recentCounter = -999;
  scene.events.forEach((event, i) => {
    const landed = chipLanded(i);
    if (frame >= landed) {
      landedCount++;
      lastLanded = Math.max(lastLanded, landed);
      if (event.ok === false) recentCounter = Math.max(recentCounter, landed);
    }
  });
  const hp = 1 - landedCount / Math.max(1, scene.events.length);
  const hitFlash = interpolate(frame - lastLanded, [0, 3, 10], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const counterShake =
    frame - recentCounter < 12 ? Math.sin((frame - recentCounter) * 2.2) * (12 - (frame - recentCounter)) : 0;
  const wobble = Math.sin(frame * 0.12) * 6;

  const captionIn = interpolate(frame, [8, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Recent attack banners (keep the latest 5 visible).
  const visible = scene.events
    .map((event, i) => ({ event, i, p: interpolate(frame, [chipStart(i), chipStart(i) + slideDur], [0, 1], { easing: EASE_OUT, extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const }) }))
    .filter(({ p }) => p > 0)
    .slice(-5);

  return (
    <AbsoluteFill
      style={{ backgroundColor: quest.bg, fontFamily: quest.mono, overflow: "hidden" }}
    >
      {/* the boss, top half, staggering as attacks land */}
      <div
        style={{
          position: "absolute",
          top: 170,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          transform: `translateX(${counterShake}px)`,
        }}
      >
        <div style={{ position: "relative" }}>
          <Monster size={470} hp={hp} wobble={wobble} />
          {hitFlash > 0 ? (
            <div
              style={{
                position: "absolute",
                top: 100,
                left: 0,
                right: 0,
                textAlign: "center",
                fontSize: 110,
                opacity: hitFlash,
                transform: `scale(${1 + hitFlash * 0.4})`,
              }}
            >
              💥
            </div>
          ) : null}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 100,
          width: "100%",
          textAlign: "center",
          color: quest.red,
          fontSize: 40,
          fontWeight: 700,
          letterSpacing: 6,
        }}
      >
        THE BUG
      </div>

      {/* attack log — bottom half, newest slides in */}
      <div
        style={{
          position: "absolute",
          bottom: 300,
          left: 80,
          right: 80,
          display: "flex",
          flexDirection: "column",
          gap: 26,
        }}
      >
        {visible.map(({ event, i, p }) => {
          const isCounter = event.ok === false;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 22,
                padding: "22px 32px",
                borderRadius: 14,
                backgroundColor: isCounter ? quest.redBg : quest.panel,
                border: `2px solid ${isCounter ? quest.red : quest.panelBorder}`,
                opacity: p,
                transform: `translateX(${(1 - p) * (isCounter ? -700 : 700)}px)`,
                fontSize: 38,
              }}
            >
              <span style={{ flexShrink: 0 }}>{isCounter ? "🩸" : "⚔️"}</span>
              <span style={{ color: isCounter ? quest.red : quest.goldBright, fontWeight: 700, flexShrink: 0 }}>
                {isCounter ? "the bug counters" : `agent ${moveName(event)}`}
              </span>
              <span
                style={{
                  color: quest.textDim,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {event.summary}
              </span>
            </div>
          );
        })}
      </div>

      {/* the hero, bottom corner, fighting */}
      <CornerMascot
        pose="typing"
        emotion={frame - recentCounter < 55 ? "panicking" : "confident"}
        seed="quest-battle-corner"
      />
      {caption ? <Caption text={caption} opacity={captionIn} /> : null}
    </AbsoluteFill>
  );
};
