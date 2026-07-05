import type { Emotion } from "../screenplay";
import { theme } from "../theme";

/**
 * Shared face-part kit (issue #13). Both characters' 7-emotion tables were
 * near-identical shapes with per-character geometry; a third character (a
 * second genre pack's reskin) would have copied them again. The kit owns the
 * shared structure (stroke widths, linecaps, colors); characters supply only
 * geometry.
 */

/** The yellow "?" that floats off a confused face. */
export const QuestionMark: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <text x={x} y={y} fontFamily={theme.mono} fontWeight={700} fontSize={30} fill={theme.yellow}>
    ?
  </text>
);

/** A blue sweat drop, off the temple of a panicking face. */
export const SweatDrop: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <path d={`M${x} ${y} q7 11 0 15 q-8 -4 0 -15`} fill={theme.blue} />
);

/** Defeated X-eyes: two crosses centered on the eye positions. */
export const CrossEyes: React.FC<{
  cxL: number;
  cxR: number;
  cy: number;
  halfX: number;
  halfY: number;
  strokeWidth: number;
}> = ({ cxL, cxR, cy, halfX, halfY, strokeWidth }) => (
  <g stroke={theme.textDim} strokeWidth={strokeWidth} strokeLinecap="round">
    {[cxL, cxR].map((cx) => (
      <g key={cx}>
        <line x1={cx - halfX} y1={cy - halfY} x2={cx + halfX} y2={cy + halfY} />
        <line x1={cx + halfX} y1={cy - halfY} x2={cx - halfX} y2={cy + halfY} />
      </g>
    ))}
  </g>
);

/** Celebrating ^^ eyes: two upward carets. */
export const CaretEyes: React.FC<{
  cxL: number;
  cxR: number;
  baseY: number;
  tipY: number;
  halfW: number;
  strokeWidth: number;
  stroke: string;
}> = ({ cxL, cxR, baseY, tipY, halfW, strokeWidth, stroke }) => (
  <g stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" fill="none">
    <path d={`M${cxL - halfW} ${baseY} L${cxL} ${tipY} L${cxL + halfW} ${baseY}`} />
    <path d={`M${cxR - halfW} ${baseY} L${cxR} ${tipY} L${cxR + halfW} ${baseY}`} />
  </g>
);

/**
 * Per-character mouth geometry; makeMouths() owns the shared structure
 * (stroke widths, colors, linecaps). `panicking` differs structurally
 * between characters (rect vs ellipse), so it stays a full node.
 */
export interface MouthGeometry {
  neutral: { x1: number; x2: number; y: number };
  /** Path `d` strings — geometry only. */
  confident: string;
  confused: string;
  smug: string;
  defeated: string;
  celebrating: string;
  panicking: React.ReactNode;
}

export const makeMouths = (g: MouthGeometry): Record<Emotion, React.ReactNode> => ({
  neutral: (
    <line
      x1={g.neutral.x1}
      y1={g.neutral.y}
      x2={g.neutral.x2}
      y2={g.neutral.y}
      stroke={theme.text}
      strokeWidth={5}
      strokeLinecap="round"
    />
  ),
  confident: (
    <path d={g.confident} stroke={theme.text} strokeWidth={5} fill="none" strokeLinecap="round" />
  ),
  confused: (
    <path d={g.confused} stroke={theme.text} strokeWidth={5} fill="none" strokeLinecap="round" />
  ),
  panicking: g.panicking,
  smug: <path d={g.smug} stroke={theme.text} strokeWidth={5} fill="none" strokeLinecap="round" />,
  defeated: (
    <path d={g.defeated} stroke={theme.textDim} strokeWidth={5} fill="none" strokeLinecap="round" />
  ),
  celebrating: (
    <path d={g.celebrating} stroke={theme.text} strokeWidth={6} fill="none" strokeLinecap="round" />
  ),
});
