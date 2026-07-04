import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { EASE_BACK_OUT } from "../easing";
import type { StatsScene } from "../screenplay";
import { theme } from "../theme";
import { Caption } from "./Caption";

const countUp = (frame: number, start: number, value: number): number =>
  Math.round(
    interpolate(frame, [start, start + 45], [0, value], {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

const pop = (frame: number, start: number): number =>
  interpolate(frame, [start, start + 14], [0, 1], {
    easing: EASE_BACK_OUT,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

export const Stats: React.FC<{
  scene: StatsScene;
  caption?: string;
  durationInFrames: number;
}> = ({ scene, caption, durationInFrames }) => {
  const frame = useCurrentFrame();

  const cardIn = pop(frame, 0);
  const countsStart = 20;
  const { counts } = scene;
  const tiles = [
    { label: "files touched", value: `${countUp(frame, countsStart, counts.files)}`, color: theme.blue },
    { label: "tool calls", value: `${countUp(frame, countsStart + 8, counts.tools)}`, color: theme.purple },
    { label: "lines added", value: `+${countUp(frame, countsStart + 16, counts.added)}`, color: theme.green },
    { label: "lines removed", value: `−${countUp(frame, countsStart + 24, counts.removed)}`, color: theme.red },
  ];

  const achievementsStart = 90;
  const gradeStart = Math.min(durationInFrames - 60, achievementsStart + scene.achievements.length * 15 + 25);
  const gradeIn = pop(frame, gradeStart);

  const captionIn = interpolate(frame, [gradeStart + 20, gradeStart + 40], [0, 1], {
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
        padding: 60,
      }}
    >
      <div
        style={{
          width: "100%",
          backgroundColor: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          borderRadius: 28,
          padding: 56,
          opacity: cardIn,
          transform: `scale(${0.85 + cardIn * 0.15})`,
          position: "relative",
        }}
      >
        {/* Compression header — always show real vs movie time. */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ color: theme.textDim, fontSize: 32, marginBottom: 16 }}>
            session → movie
          </div>
          <div style={{ color: theme.text, fontSize: 76, fontWeight: 700 }}>
            {scene.compressed.realDuration}
            <span style={{ color: theme.yellow }}> → </span>
            {scene.compressed.movieDuration}
          </div>
        </div>
        {/* Counts grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 28,
            marginBottom: 56,
          }}
        >
          {tiles.map((tile) => (
            <div
              key={tile.label}
              style={{
                backgroundColor: theme.bg,
                border: `2px solid ${theme.panelBorder}`,
                borderRadius: 18,
                padding: "32px 24px",
                textAlign: "center",
              }}
            >
              <div style={{ color: tile.color, fontSize: 66, fontWeight: 700 }}>
                {tile.value}
              </div>
              <div style={{ color: theme.textDim, fontSize: 28, marginTop: 10 }}>
                {tile.label}
              </div>
            </div>
          ))}
        </div>
        {/* Achievements */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "center" }}>
          {scene.achievements.map((a, i) => {
            const p = pop(frame, achievementsStart + i * 15);
            return (
              <div
                key={a.id}
                style={{
                  padding: "18px 34px",
                  borderRadius: 999,
                  border: `2px solid ${theme.yellow}`,
                  color: theme.yellow,
                  fontSize: 34,
                  opacity: p,
                  transform: `scale(${p})`,
                }}
              >
                🏆 {a.title}
              </div>
            );
          })}
        </div>
        {/* The slightly judgmental grade, stamped on. */}
        {scene.grade ? (
          <div
            style={{
              position: "absolute",
              top: -30,
              right: -20,
              padding: "20px 36px",
              borderRadius: 20,
              border: `6px solid ${theme.green}`,
              color: theme.green,
              backgroundColor: theme.bg,
              fontSize: 96,
              fontWeight: 700,
              opacity: gradeIn,
              transform: `rotate(12deg) scale(${gradeIn === 0 ? 0 : 2.2 - gradeIn * 1.2})`,
            }}
          >
            {scene.grade}
          </div>
        ) : null}
      </div>
      {caption ? <Caption text={caption} opacity={captionIn} /> : null}
    </AbsoluteFill>
  );
};
