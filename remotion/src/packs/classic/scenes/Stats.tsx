import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { EASE_POP } from "../../../motion";
import { statsSchedule } from "../../../timing";
import type { StatsScene } from "../../../screenplay";
import { theme } from "../../../theme";
import { Caption } from "../../Caption";
import { ClockChip } from "../../ClockChip";
import { Panel } from "../../Panel";
import { useCompression, useStatCards } from "../../sidecars";

const pop = (frame: number, start: number): number =>
  interpolate(frame, [start, start + 14], [0, 1], {
    easing: EASE_POP,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const SCRAMBLE_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOCK_STAGGER = 2; // frames between each character locking, left to right

/** Slot-machine settle: characters scramble through random glyphs then lock
 * left-to-right onto the EXACT preformatted string — never derives a number,
 * just reveals the string with a flourish. Seeded random() only (CLAUDE.md
 * determinism); space/punctuation never scrambles. */
const settle = (frame: number, start: number, text: string, seed: string): string =>
  text
    .split("")
    .map((ch, i) => {
      if (!/[A-Za-z0-9]/.test(ch)) return ch;
      const lockAt = start + i * LOCK_STAGGER;
      if (frame >= lockAt) return ch;
      if (frame < start) return ch; // card not on screen yet — irrelevant, invisible
      const idx = Math.floor(random(`${seed}-${i}-${frame}`) * SCRAMBLE_CHARS.length);
      return SCRAMBLE_CHARS[idx];
    })
    .join("");

/** The end card — engineered for screenshots (docs/visual-language.md "the
 * energy kit"): compression header, up to 6 fact cards from the CLI sidecar,
 * watermark. Drops the old achievements/grade/factTiles entirely — those
 * numbers now live in statCards, picked CLI-side by deterministic rules. */
export const Stats: React.FC<{
  scene: StatsScene;
  durationInFrames: number;
}> = ({ scene, durationInFrames }) => {
  const frame = useCurrentFrame();
  const compression = useCompression();
  const cards = useStatCards().slice(0, 6);
  const cols = cards.length <= 4 ? 2 : 3;

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
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 28,
          }}
        >
          {cards.map((card, i) => {
            const start = cardsStart + i * cardStagger;
            const p = pop(frame, start);
            const color = card.accent === "ok" ? theme.ok : card.accent === "fail" ? theme.fail : theme.accent;
            const displayValue = settle(frame, start, card.value, card.id);
            // Preformatted values vary a lot in length ("7 commits" vs.
            // "2 errors survived") — a fixed font size overflows the card's
            // own grid column for longer phrases, so it scales down with
            // length instead of bleeding past the card border.
            const valueFontSize = card.value.length > 14 ? 38 : card.value.length > 7 ? 46 : 56;
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
      {scene.caption ? <Caption text={scene.caption} opacity={captionIn} /> : null}
    </AbsoluteFill>
  );
};
