import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import type { ShowcaseScene } from "../screenplay/types";
import { theme } from "../theme";
import { Caption } from "./Caption";

const LINE_HEIGHT = 84;
const TYPE_CHARS_PER_FRAME = 1.0;

export const Showcase: React.FC<{
  scene: ShowcaseScene;
  caption?: string;
  durationInFrames: number;
}> = ({ scene, caption, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { lines } = scene.artifact;

  const panelIn = interpolate(frame, [0, 15], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 1: red lines collapse out, staggered.
  const collapseStart = Math.round(durationInFrames * 0.12);
  const collapseStagger = 12;
  const collapseDur = 18;
  const removedIndexes = lines
    .map((l, i) => (l.kind === "removed" ? i : -1))
    .filter((i) => i >= 0);

  // Phase 2: green lines type in, one after another.
  const typingStart =
    collapseStart + removedIndexes.length * collapseStagger + collapseDur + 10;
  const addedIndexes = lines
    .map((l, i) => (l.kind === "added" ? i : -1))
    .filter((i) => i >= 0);
  const typeStarts = new Map<number, { start: number; dur: number }>();
  let cursor = typingStart;
  for (const i of addedIndexes) {
    const dur = Math.max(18, Math.ceil(lines[i].text.length / TYPE_CHARS_PER_FRAME));
    typeStarts.set(i, { start: cursor, dur });
    cursor += dur + 6;
  }
  const typingDone = cursor;

  // Phase 3: the verdict lands.
  const verdictIn = interpolate(frame, [typingDone + 12, typingDone + 26], [0, 1], {
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const verdictColor =
    scene.verdict === "fail" ? theme.red : scene.verdict === "pass" ? theme.green : theme.purple;
  const verdictLabel =
    scene.verdict === "fail" ? "✗ tests fail" : scene.verdict === "pass" ? "✓ tests pass" : "→ the reveal";

  const captionIn = interpolate(frame, [10, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        fontFamily: theme.mono,
        justifyContent: "center",
        padding: 50,
      }}
    >
      <div
        style={{
          backgroundColor: theme.panel,
          border: `2px solid ${verdictIn > 0 ? verdictColor : theme.panelBorder}`,
          borderRadius: 20,
          overflow: "hidden",
          opacity: panelIn,
          transform: `translateY(${(1 - panelIn) * 60}px)`,
        }}
      >
        {/* Filename tab */}
        <div
          style={{
            display: "flex",
            borderBottom: `2px solid ${theme.panelBorder}`,
            backgroundColor: theme.bg,
          }}
        >
          <div
            style={{
              padding: "22px 36px",
              backgroundColor: theme.panel,
              borderRight: `2px solid ${theme.panelBorder}`,
              borderTop: `4px solid ${theme.blue}`,
              color: theme.text,
              fontSize: 32,
            }}
          >
            {scene.artifact.file}
          </div>
        </div>
        {/* Diff body */}
        <div style={{ padding: "36px 0" }}>
          {lines.map((line, i) => {
            if (line.kind === "removed") {
              const order = removedIndexes.indexOf(i);
              const collapse = interpolate(
                frame,
                [collapseStart + order * collapseStagger, collapseStart + order * collapseStagger + collapseDur],
                [1, 0],
                { easing: Easing.in(Easing.cubic), extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              );
              if (collapse === 0) return null;
              return (
                <DiffRow
                  key={i}
                  sign="-"
                  color={theme.red}
                  bg={theme.redBg}
                  text={line.text}
                  height={LINE_HEIGHT * collapse}
                  opacity={collapse}
                  shiftX={(1 - collapse) * -140}
                />
              );
            }
            if (line.kind === "added") {
              const t = typeStarts.get(i);
              if (!t || frame < t.start) return null;
              const grow = interpolate(frame, [t.start, t.start + 8], [0, 1], {
                easing: Easing.out(Easing.cubic),
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const chars = Math.floor((frame - t.start) * TYPE_CHARS_PER_FRAME);
              const typed = line.text.slice(0, chars);
              const stillTyping = chars < line.text.length;
              return (
                <DiffRow
                  key={i}
                  sign="+"
                  color={theme.green}
                  bg={theme.greenBg}
                  text={typed}
                  cursor={stillTyping}
                  height={LINE_HEIGHT * grow}
                  opacity={grow}
                  shiftX={0}
                />
              );
            }
            return (
              <DiffRow
                key={i}
                sign=" "
                color={theme.textDim}
                bg="transparent"
                text={line.text}
                height={LINE_HEIGHT}
                opacity={1}
                shiftX={0}
              />
            );
          })}
        </div>
      </div>
      {/* Verdict banner */}
      <div
        style={{
          alignSelf: "center",
          marginTop: 60,
          padding: "24px 64px",
          borderRadius: 18,
          backgroundColor: scene.verdict === "fail" ? theme.redBg : theme.greenBg,
          border: `3px solid ${verdictColor}`,
          color: verdictColor,
          fontSize: 54,
          fontWeight: 700,
          opacity: verdictIn,
          transform: `scale(${verdictIn === 0 ? 0.5 : 0.5 + verdictIn * 0.5})`,
        }}
      >
        {verdictLabel}
      </div>
      {caption ? <Caption text={caption} opacity={captionIn} /> : null}
    </AbsoluteFill>
  );
};

const DiffRow: React.FC<{
  sign: string;
  color: string;
  bg: string;
  text: string;
  height: number;
  opacity: number;
  shiftX: number;
  cursor?: boolean;
}> = ({ sign, color, bg, text, height, opacity, shiftX, cursor }) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
        height,
        overflow: "hidden",
        backgroundColor: bg,
        opacity,
        transform: `translateX(${shiftX}px)`,
        padding: "0 32px",
        fontSize: 30,
        whiteSpace: "pre",
      }}
    >
      <span style={{ color, width: 28, flexShrink: 0, fontWeight: 700 }}>{sign}</span>
      <span style={{ color: sign === " " ? theme.textDim : theme.text, overflow: "hidden" }}>
        {text}
        {cursor ? (
          <span
            style={{
              display: "inline-block",
              width: 16,
              height: 36,
              marginLeft: 4,
              verticalAlign: "text-bottom",
              backgroundColor: color,
            }}
          />
        ) : null}
      </span>
    </div>
  );
};
