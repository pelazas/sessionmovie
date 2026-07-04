import { useMemo } from "react";
import { AbsoluteFill, Easing, Sequence, interpolate, useCurrentFrame } from "remotion";
import { EASE_BACK_OUT, EASE_OUT } from "../../../easing";
import { CornerMascot } from "../../../characters/CornerMascot";
import type { DiffArtifact, ShowcaseScene, TestRunArtifact } from "../../../screenplay";
import { theme } from "../../../theme";
import { Caption } from "../../Caption";

const LINE_HEIGHT = 84;

// One lookup for everything verdict-styled — color, background, label always agree.
const VERDICT: Record<ShowcaseScene["verdict"], { color: string; bg: string; label: string }> = {
  fail: { color: theme.red, bg: theme.redBg, label: "✗ tests fail" },
  pass: { color: theme.green, bg: theme.greenBg, label: "✓ tests pass" },
  reveal: { color: theme.purple, bg: "rgba(188, 140, 255, 0.15)", label: "→ the reveal" },
};

type DiffLine = { kind: "context" | "removed" | "added"; text: string };

/** Unified-diff snippet string → typed lines. Presentation parsing only. */
const parseSnippet = (snippet: string | undefined): DiffLine[] =>
  (snippet ?? "")
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => {
      if (l.startsWith("+")) return { kind: "added" as const, text: l.slice(1) };
      if (l.startsWith("-")) return { kind: "removed" as const, text: l.slice(1) };
      return { kind: "context" as const, text: l.startsWith(" ") ? l.slice(1) : l };
    });

interface LineSchedule {
  collapseStart?: number; // removed lines
  typeStart?: number; // added lines
  typeDur?: number;
  charsPerFrame?: number;
}

/**
 * Fit the whole arc (collapse → type → verdict) inside the scene's duration.
 * Pacing derives from durationInFrames, never from content size — a huge diff
 * types faster instead of overrunning the scene.
 */
const buildSchedule = (lines: DiffLine[], durationInFrames: number) => {
  const collapseStart = Math.round(durationInFrames * 0.12);
  const verdictStart = Math.round(durationInFrames * 0.78);

  const removed = lines.map((l, i) => (l.kind === "removed" ? i : -1)).filter((i) => i >= 0);
  const added = lines.map((l, i) => (l.kind === "added" ? i : -1)).filter((i) => i >= 0);

  const collapseWindow = durationInFrames * 0.18;
  const collapseStagger = Math.min(12, Math.max(3, collapseWindow / Math.max(1, removed.length)));
  const collapseDur = 14;
  const collapseEnd = collapseStart + removed.length * collapseStagger + collapseDur;

  const typingWindow = Math.max(20, verdictStart - 8 - collapseEnd);
  const totalChars = added.reduce((acc, i) => acc + Math.max(1, lines[i]?.text.length ?? 1), 0);

  const schedule = new Map<number, LineSchedule>();
  removed.forEach((lineIndex, order) => {
    schedule.set(lineIndex, { collapseStart: collapseStart + order * collapseStagger });
  });
  let cursor = collapseEnd + 6;
  for (const i of added) {
    const chars = Math.max(1, lines[i]?.text.length ?? 1);
    const typeDur = Math.max(6, Math.floor(typingWindow * (chars / totalChars)));
    schedule.set(i, { typeStart: cursor, typeDur, charsPerFrame: chars / (typeDur * 0.85) });
    cursor += typeDur;
  }
  return { schedule, collapseDur, verdictStart };
};

export const Showcase: React.FC<{
  scene: ShowcaseScene;
  caption?: string;
  durationInFrames: number;
}> = ({ scene, caption, durationInFrames }) => {
  const frame = useCurrentFrame();
  const verdict = VERDICT[scene.verdict];

  const panelIn = interpolate(frame, [0, 15], [0, 1], {
    easing: EASE_OUT,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const verdictStart = Math.round(durationInFrames * 0.78);
  const verdictIn = interpolate(frame, [verdictStart, verdictStart + 14], [0, 1], {
    easing: EASE_BACK_OUT,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
          border: `2px solid ${verdictIn > 0 ? verdict.color : theme.panelBorder}`,
          borderRadius: 20,
          overflow: "hidden",
          opacity: panelIn,
          transform: `translateY(${(1 - panelIn) * 60}px)`,
        }}
      >
        {scene.artifact.kind === "diff" ? (
          <DiffPanel scene={scene} artifact={scene.artifact} durationInFrames={durationInFrames} />
        ) : scene.artifact.kind === "testRun" ? (
          <TestRunPanel artifact={scene.artifact} durationInFrames={durationInFrames} />
        ) : (
          <ScreenshotPanel path={scene.artifact.path} />
        )}
      </div>
      {/* Verdict banner — lands at 78% of the scene, whatever the content. */}
      <div
        style={{
          alignSelf: "center",
          marginTop: 60,
          padding: "24px 64px",
          borderRadius: 18,
          backgroundColor: verdict.bg,
          border: `3px solid ${verdict.color}`,
          color: verdict.color,
          fontSize: 54,
          fontWeight: 700,
          opacity: verdictIn,
          transform: `scale(${verdictIn === 0 ? 0.5 : 0.5 + verdictIn * 0.5})`,
        }}
      >
        {verdict.label}
      </div>
      {/* corner-reaction mascot (issue #8): reacts when the verdict lands —
          collapses on fail, cheers with confetti on pass, smugly points on
          reveal. Sequence restarts its clock so the pose spring fires then.
          Rendered BEFORE the caption so editorial text paints on top. */}
      <Sequence from={verdictStart} layout="none">
        {scene.verdict === "fail" ? (
          <CornerMascot pose="collapse" emotion="defeated" corner="bottom-left" seed="showcase-fail" />
        ) : scene.verdict === "pass" ? (
          <CornerMascot pose="cheer" emotion="celebrating" corner="bottom-left" confetti seed="showcase-pass" />
        ) : (
          <CornerMascot pose="point" emotion="smug" corner="bottom-left" seed="showcase-reveal" />
        )}
      </Sequence>
      {caption ? <Caption text={caption} opacity={captionIn} /> : null}
    </AbsoluteFill>
  );
};

/**
 * Snippetless diff visualization: red bars collapse out, green bars type in —
 * the diff's *shape* without its content. Bar counts are proportional to the
 * real added/removed totals (capped); widths follow a fixed pattern so the
 * render is deterministic with zero randomness.
 */
const BAR_WIDTHS = [0.86, 0.62, 0.94, 0.5, 0.74, 0.68, 0.9, 0.56];
const MAX_BARS = 8;

const AbstractDiff: React.FC<{
  added: number;
  removed: number;
  durationInFrames: number;
}> = ({ added, removed, durationInFrames }) => {
  const frame = useCurrentFrame();
  const redBars = removed === 0 ? 0 : Math.max(1, Math.min(MAX_BARS, Math.round(removed / 4)));
  const greenBars = added === 0 ? 0 : Math.max(1, Math.min(MAX_BARS, Math.round(added / 4)));
  const start = Math.round(durationInFrames * 0.12);
  const stagger = Math.max(
    4,
    Math.min(12, (durationInFrames * 0.5) / Math.max(1, redBars + greenBars)),
  );
  const bar = (i: number, kind: "removed" | "added") => {
    const order = kind === "removed" ? i : redBars + i;
    const p = interpolate(frame, [start + order * stagger, start + order * stagger + 10], [0, 1], {
      easing: EASE_OUT,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    // Removed bars shrink away once all green bars have landed.
    const gone =
      kind === "removed"
        ? interpolate(
            frame,
            [start + (redBars + greenBars) * stagger + 14, start + (redBars + greenBars) * stagger + 30],
            [1, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        : 1;
    if (p === 0 || gone === 0) return null;
    const width = (BAR_WIDTHS[order % BAR_WIDTHS.length] ?? 0.7) * 100;
    return (
      <div
        key={`${kind}-${i}`}
        style={{
          height: 34 * gone,
          overflow: "hidden",
          backgroundColor: kind === "removed" ? theme.redBg : theme.greenBg,
          borderLeft: `6px solid ${kind === "removed" ? theme.red : theme.green}`,
          width: `${width * p}%`,
          opacity: p * gone,
          borderRadius: 6,
        }}
      />
    );
  };
  return (
    <div style={{ padding: "44px 48px", display: "flex", flexDirection: "column", gap: 18 }}>
      {Array.from({ length: redBars }, (_, i) => bar(i, "removed"))}
      {Array.from({ length: greenBars }, (_, i) => bar(i, "added"))}
      <div style={{ display: "flex", gap: 40, marginTop: 26, fontSize: 72, fontWeight: 700 }}>
        <span style={{ color: theme.green }}>+{added}</span>
        {removed > 0 ? <span style={{ color: theme.red }}>−{removed}</span> : null}
      </div>
    </div>
  );
};

const DiffPanel: React.FC<{
  scene: ShowcaseScene;
  artifact: DiffArtifact;
  durationInFrames: number;
}> = ({ scene, artifact, durationInFrames }) => {
  const frame = useCurrentFrame();
  const lines = useMemo(() => parseSnippet(artifact.snippet), [artifact.snippet]);
  const { schedule, collapseDur } = useMemo(
    () => buildSchedule(lines, durationInFrames),
    [lines, durationInFrames],
  );
  const focused = (i: number) =>
    scene.focus !== undefined && i >= scene.focus.start && i <= scene.focus.end;

  return (
    <>
      {/* Filename tab with +/- counts */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
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
          {artifact.file}
        </div>
        <div style={{ marginLeft: "auto", padding: "0 36px", fontSize: 30 }}>
          <span style={{ color: theme.green }}>+{artifact.added}</span>{" "}
          <span style={{ color: theme.red }}>−{artifact.removed}</span>
        </div>
      </div>
      {/* Diff body. No snippet (the schema allows it — LLM screenwriters often
          omit one) → abstract diff bars instead of 12 seconds of empty panel. */}
      {lines.length === 0 ? (
        <AbstractDiff
          added={artifact.added}
          removed={artifact.removed}
          durationInFrames={durationInFrames}
        />
      ) : null}
      <div style={{ padding: "36px 0" }}>
        {lines.map((line, i) => {
          const slot = schedule.get(i);
          if (line.kind === "removed" && slot?.collapseStart !== undefined) {
            const collapse = interpolate(
              frame,
              [slot.collapseStart, slot.collapseStart + collapseDur],
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
          if (line.kind === "added" && slot?.typeStart !== undefined) {
            if (frame < slot.typeStart) return null;
            const grow = interpolate(frame, [slot.typeStart, slot.typeStart + 6], [0, 1], {
              easing: Easing.out(Easing.cubic),
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const chars = Math.floor((frame - slot.typeStart) * (slot.charsPerFrame ?? 1));
            const typed = line.text.slice(0, chars);
            const stillTyping = chars < line.text.length;
            return (
              <DiffRow
                key={i}
                sign="+"
                color={theme.green}
                bg={focused(i) ? "rgba(210, 153, 34, 0.12)" : theme.greenBg}
                text={typed}
                cursor={stillTyping}
                height={LINE_HEIGHT * grow}
                opacity={grow}
                shiftX={0}
                focus={focused(i)}
              />
            );
          }
          if (line.kind === "context") {
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
          }
          return null;
        })}
      </div>
    </>
  );
};

const TestRunPanel: React.FC<{
  artifact: TestRunArtifact;
  durationInFrames: number;
}> = ({ artifact, durationInFrames }) => {
  const frame = useCurrentFrame();
  const failed = artifact.exitCode !== 0;
  const color = failed ? theme.red : theme.green;

  // Command types in over the first quarter; the exit badge slams at 45%.
  const typeStart = 12;
  const typeEnd = Math.max(typeStart + 8, durationInFrames * 0.25);
  const chars = Math.floor(
    Math.max(0, frame - typeStart) * (artifact.command.length / (typeEnd - typeStart)),
  );
  const badgeStart = Math.round(durationInFrames * 0.45);
  const badgeIn = interpolate(frame, [badgeStart, badgeStart + 12], [0, 1], {
    easing: EASE_BACK_OUT,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ padding: 56 }}>
      <div style={{ color: theme.textDim, fontSize: 34, marginBottom: 28 }}>
        <span style={{ color: theme.blue }}>$ </span>
        {artifact.command.slice(0, chars)}
      </div>
      {artifact.summary ? (
        <div
          style={{
            color: theme.textDim,
            fontSize: 36,
            lineHeight: 1.5,
            marginBottom: 40,
            opacity: interpolate(frame, [typeEnd, typeEnd + 10], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          {artifact.summary}
        </div>
      ) : null}
      <div
        style={{
          display: "inline-block",
          padding: "18px 44px",
          borderRadius: 14,
          border: `3px solid ${color}`,
          backgroundColor: failed ? theme.redBg : theme.greenBg,
          color,
          fontSize: 56,
          fontWeight: 700,
          opacity: badgeIn,
          transform: `scale(${badgeIn === 0 ? 0.6 : 0.6 + badgeIn * 0.4})`,
        }}
      >
        exit {artifact.exitCode}
      </div>
    </div>
  );
};

const ScreenshotPanel: React.FC<{ path: string }> = ({ path }) => (
  <div style={{ padding: 72, textAlign: "center" }}>
    <div style={{ fontSize: 120, marginBottom: 24 }}>🖼️</div>
    <div style={{ color: theme.text, fontSize: 38 }}>{path.split("/").pop() ?? path}</div>
    <div style={{ color: theme.textDim, fontSize: 28, marginTop: 12 }}>screenshot</div>
  </div>
);

const DiffRow: React.FC<{
  sign: string;
  color: string;
  bg: string;
  text: string;
  height: number;
  opacity: number;
  shiftX: number;
  cursor?: boolean;
  focus?: boolean;
}> = ({ sign, color, bg, text, height, opacity, shiftX, cursor, focus }) => {
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
        borderLeft: focus ? `6px solid ${theme.yellow}` : "6px solid transparent",
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
