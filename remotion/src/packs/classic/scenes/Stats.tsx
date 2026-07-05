import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { EASE_POP } from "../../../motion";
import { statsSchedule } from "../../../timing";
import type { StatsScene } from "../../../screenplay";
import { theme } from "../../../theme";
import { Caption } from "../../Caption";
import { ClockChip } from "../../ClockChip";
import { Panel } from "../../Panel";
import { useCompression, useStatCards } from "../../sidecars";

/** A value the CLI formatted as a bare (optionally-signed) integer — the only
 * shape a number-roll is allowed to animate; every other preformatted phrase
 * ("6 files touched", "+9 / −4") is displayed verbatim, never re-derived. */
const NUMBER_ROLL = /^\+?\d+$/;

const pop = (frame: number, start: number): number =>
  interpolate(frame, [start, start + 14], [0, 1], {
    easing: EASE_POP,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/** The end card — engineered for screenshots (docs/visual-language.md "the
 * energy kit"): compression header, up to 6 fact cards from the CLI sidecar,
 * watermark. Drops the old achievements/grade/factTiles entirely — those
 * numbers now live in statCards, picked CLI-side by deterministic rules. */
export const Stats: React.FC<{
  scene: StatsScene;
  caption?: string;
  durationInFrames: number;
}> = ({ scene, caption, durationInFrames }) => {
  const frame = useCurrentFrame();
  const compression = useCompression();
  const cards = useStatCards().slice(0, 6);

  const { compressionIn, cardsStart, cardStagger, watermarkIn, captionIn: captionInAt } = statsSchedule(
    durationInFrames,
  );

  const panelIn = pop(frame, 0);
  const compressionOpacity = interpolate(frame, [compressionIn, compressionIn + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const watermarkOpacity = interpolate(frame, [watermarkIn, watermarkIn + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const captionIn = interpolate(frame, [captionInAt, captionInAt + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{ backgroundColor: theme.bg, fontFamily: theme.mono, justifyContent: "center", alignItems: "center", padding: 60 }}
    >
      <Panel
        variant="stat"
        style={{ width: "92%", maxWidth: 1500, opacity: panelIn, transform: `scale(${0.9 + panelIn * 0.1})` }}
      >
        {compression ? (
          <div style={{ textAlign: "center", marginBottom: 48, opacity: compressionOpacity }}>
            <div style={{ color: theme.textDim, fontSize: 30, marginBottom: 12 }}>session → movie</div>
            <div style={{ color: theme.textPrimary, fontSize: 68, fontWeight: 700 }}>{compression}</div>
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.min(3, Math.max(1, cards.length))}, 1fr)`,
            gap: 28,
          }}
        >
          {cards.map((card, i) => {
            const p = pop(frame, cardsStart + i * cardStagger);
            const color = card.accent === "ok" ? theme.ok : card.accent === "fail" ? theme.fail : theme.accent;
            const rolling = NUMBER_ROLL.test(card.value);
            const displayValue = rolling
              ? `${card.value.startsWith("+") ? "+" : ""}${Math.round(
                  interpolate(
                    frame,
                    [cardsStart + i * cardStagger, cardsStart + i * cardStagger + 30],
                    [0, Number(card.value.replace("+", ""))],
                    { easing: Easing.out(Easing.cubic), extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                  ),
                )}`
              : card.value;
            // Preformatted values vary a lot in length ("7 commits" vs.
            // "2 errors survived") — a fixed font size overflows the card's
            // own 1fr grid column for longer phrases, so it scales down with
            // length instead of bleeding past the card border.
            const valueFontSize = displayValue.length > 14 ? 38 : displayValue.length > 7 ? 46 : 56;
            return (
              <div
                key={card.id}
                style={{
                  minWidth: 0,
                  overflow: "hidden",
                  backgroundColor: theme.bg,
                  border: `2px solid ${theme.panelBorder}`,
                  borderRadius: 18,
                  padding: "28px 20px",
                  textAlign: "center",
                  opacity: p,
                  transform: `scale(${0.85 + p * 0.15})`,
                }}
              >
                <div style={{ color, fontSize: valueFontSize, fontWeight: 700, overflowWrap: "break-word" }}>
                  {displayValue}
                </div>
                <div style={{ color: theme.textDim, fontSize: 24, marginTop: 10 }}>{card.label}</div>
              </div>
            );
          })}
        </div>
      </Panel>

      <div style={{ position: "absolute", bottom: 50, color: theme.textDim, fontSize: 26, opacity: watermarkOpacity }}>
        made with sessionmovie
      </div>

      <ClockChip />
      {caption ? <Caption text={caption} opacity={captionIn} /> : null}
    </AbsoluteFill>
  );
};
