import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { EASE_BACK_OUT } from "../../../easing";
import { cameraDrift } from "../../../effects";
import type { StatsScene } from "../../../screenplay";
import { statsSchedule } from "../../../timing";
import { Caption } from "../../Caption";
import { ClockChip } from "../../ClockChip";
import { quest } from "../theme";

/**
 * The victory screen: the session's counts as loot, achievements as
 * trophies, the grade as the party's rank. Beat anchors come from the
 * shared schedule (compression honesty stays: real time vs movie time).
 */
const pop = (frame: number, start: number): number =>
  interpolate(frame, [start, start + 14], [0, 1], {
    easing: EASE_BACK_OUT,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const countUp = (frame: number, start: number, value: number): number =>
  Math.round(
    interpolate(frame, [start, start + 45], [0, value], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

export const QuestStats: React.FC<{
  scene: StatsScene;
  caption?: string;
  durationInFrames: number;
}> = ({ scene, caption, durationInFrames }) => {
  const frame = useCurrentFrame();
  const drift = cameraDrift(frame, "quest-stats", durationInFrames);
  const { countsStart, achievementsStart, gradeStart } = statsSchedule(scene, durationInFrames);
  const cardIn = pop(frame, 0);
  const { counts } = scene;

  const loot = [
    { icon: "🛡", label: "files conquered", value: `${countUp(frame, countsStart, counts.files)}` },
    { icon: "⚔", label: "attacks made", value: `${countUp(frame, countsStart + 8, counts.tools)}` },
    { icon: "📜", label: "lines won", value: `+${countUp(frame, countsStart + 16, counts.added)}` },
    { icon: "🔥", label: "lines burned", value: `−${countUp(frame, countsStart + 24, counts.removed)}` },
  ];

  const captionIn = interpolate(frame, [gradeStart + 20, gradeStart + 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: quest.bg,
        fontFamily: quest.mono,
        justifyContent: "center",
        alignItems: "center",
        transform: drift.transform,
        padding: 70,
      }}
    >
      <div
        style={{
          width: "100%",
          backgroundColor: quest.panel,
          border: `3px solid ${quest.gold}`,
          borderRadius: 12,
          padding: 56,
          opacity: cardIn,
          transform: `scale(${0.9 + cardIn * 0.1})`,
        }}
      >
        <div
          style={{
            textAlign: "center",
            color: quest.goldBright,
            fontSize: 58,
            fontWeight: 700,
            letterSpacing: 6,
            marginBottom: 12,
          }}
        >
          ⚑ QUEST COMPLETE
        </div>
        <div style={{ textAlign: "center", color: quest.textDim, fontSize: 30, marginBottom: 44 }}>
          {scene.compressed.realDuration} of battle, retold in {scene.compressed.movieDuration}
        </div>

        {/* the loot */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26 }}>
          {loot.map((item, i) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                padding: "26px 30px",
                borderRadius: 10,
                border: `2px solid ${quest.panelBorder}`,
                opacity: pop(frame, countsStart + i * 8),
                transform: `scale(${0.85 + pop(frame, countsStart + i * 8) * 0.15})`,
              }}
            >
              <span style={{ fontSize: 46 }}>{item.icon}</span>
              <div>
                <div style={{ color: quest.parchment, fontSize: 46, fontWeight: 700 }}>{item.value}</div>
                <div style={{ color: quest.textDim, fontSize: 26 }}>{item.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* trophies */}
        {scene.achievements.length > 0 ? (
          <div style={{ marginTop: 40 }}>
            <div style={{ color: quest.textDim, fontSize: 28, marginBottom: 18 }}>trophies claimed</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
              {scene.achievements.map((a, i) => (
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "16px 28px",
                    borderRadius: 999,
                    border: `2px solid ${quest.gold}`,
                    color: quest.parchment,
                    fontSize: 30,
                    opacity: pop(frame, achievementsStart + i * 15),
                    transform: `scale(${0.8 + pop(frame, achievementsStart + i * 15) * 0.2})`,
                  }}
                >
                  🏆 {a.title}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* party rank */}
        {scene.grade ? (
          <div
            style={{
              marginTop: 44,
              textAlign: "center",
              opacity: pop(frame, gradeStart),
              transform: `scale(${0.7 + pop(frame, gradeStart) * 0.3})`,
            }}
          >
            <span style={{ color: quest.textDim, fontSize: 30, marginRight: 20 }}>party rank</span>
            <span
              style={{
                display: "inline-block",
                padding: "14px 40px",
                borderRadius: 12,
                border: `3px solid ${quest.goldBright}`,
                color: quest.goldBright,
                fontSize: 64,
                fontWeight: 700,
              }}
            >
              {scene.grade}
            </span>
          </div>
        ) : null}
      </div>
      <ClockChip color={quest.textDim} background={quest.panel} border={quest.panelBorder} />
      {caption ? <Caption text={caption} opacity={captionIn} /> : null}
    </AbsoluteFill>
  );
};
