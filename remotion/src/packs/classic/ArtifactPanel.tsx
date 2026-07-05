import type { CSSProperties } from "react";
import { useMemo } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { CommandArtifact, CreateArtifact, EditArtifact } from "../../screenplay";
import { theme } from "../../theme";
import { EASE, EASE_POP, shake } from "../../motion";
import { artifactSchedule } from "../../timing";
import { Panel } from "../Panel";

/**
 * The one artifact panel, reusable across action/showcase for edit|command|
 * create (docs/visual-language.md "the artifact panel"). `subagents` is a
 * choreography of Characters, not a panel — handled by the scenes directly.
 */
export const ArtifactPanel: React.FC<{
  artifact: EditArtifact | CommandArtifact | CreateArtifact;
  durationInFrames: number;
  style?: CSSProperties;
}> = ({ artifact, durationInFrames, style }) => {
  switch (artifact.kind) {
    case "edit":
      return <EditPanel artifact={artifact} durationInFrames={durationInFrames} style={style} />;
    case "command":
      return <CommandPanel artifact={artifact} durationInFrames={durationInFrames} style={style} />;
    case "create":
      return <CreatePanel artifact={artifact} durationInFrames={durationInFrames} style={style} />;
  }
};

// ── edit: diff panel ─────────────────────────────────────────────────────────

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
  collapseStart?: number;
  typeStart?: number;
  typeDur?: number;
  charsPerFrame?: number;
}

/**
 * Fit the whole arc (collapse → type) inside the artifact's typing window.
 * Pacing derives from durationInFrames, never from content size — a huge
 * diff types faster instead of overrunning the scene.
 */
const buildDiffSchedule = (lines: DiffLine[], durationInFrames: number) => {
  const { panelInDur, typeStart, typeEnd } = artifactSchedule(durationInFrames);
  const removed = lines.map((l, i) => (l.kind === "removed" ? i : -1)).filter((i) => i >= 0);
  const added = lines.map((l, i) => (l.kind === "added" ? i : -1)).filter((i) => i >= 0);

  const collapseStart = panelInDur;
  const collapseStagger = Math.min(10, Math.max(3, (typeEnd - collapseStart) / Math.max(1, removed.length * 2)));
  const collapseDur = 14;

  const typingWindow = Math.max(20, typeEnd - typeStart);
  const totalChars = added.reduce((acc, i) => acc + Math.max(1, lines[i]?.text.length ?? 1), 0);

  const schedule = new Map<number, LineSchedule>();
  removed.forEach((lineIndex, order) => {
    schedule.set(lineIndex, { collapseStart: collapseStart + order * collapseStagger });
  });
  let cursor = typeStart;
  for (const i of added) {
    const chars = Math.max(1, lines[i]?.text.length ?? 1);
    const typeDur = Math.max(6, Math.floor(typingWindow * (chars / Math.max(1, totalChars))));
    schedule.set(i, { typeStart: cursor, typeDur, charsPerFrame: chars / (typeDur * 0.85) });
    cursor += typeDur;
  }
  return { schedule, collapseDur };
};

const LINE_HEIGHT = 64;

const DiffRow: React.FC<{
  sign: string;
  color: string;
  bg: string;
  text: string;
  height: number;
  opacity: number;
  cursor?: boolean;
  focus?: boolean;
}> = ({ sign, color, bg, text, height, opacity, cursor, focus }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 16,
      height,
      overflow: "hidden",
      backgroundColor: bg,
      opacity,
      padding: "0 24px",
      transform: focus ? "scale(1.25)" : undefined,
      transformOrigin: "left center",
      fontSize: 26,
      whiteSpace: "pre",
    }}
  >
    <span style={{ color, width: 24, flexShrink: 0, fontWeight: 700 }}>{sign}</span>
    <span style={{ color: sign === " " ? theme.textDim : theme.textPrimary, overflow: "hidden" }}>
      {text}
      {cursor ? (
        <span
          style={{
            display: "inline-block",
            width: 14,
            height: 30,
            marginLeft: 4,
            verticalAlign: "text-bottom",
            backgroundColor: color,
          }}
        />
      ) : null}
    </span>
  </div>
);

/** N red bars collapse, M green bars grow — the diff's shape without its
 * content, for a snippetless artifact (schema allows it). Deterministic: bar
 * counts/widths are fixed patterns, zero randomness. */
const BAR_WIDTHS = [0.86, 0.62, 0.94, 0.5, 0.74, 0.68, 0.9, 0.56];
const MAX_BARS = 8;

const AbstractDiff: React.FC<{ added: number; removed: number; durationInFrames: number }> = ({
  added,
  removed,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { typeStart, typeEnd } = artifactSchedule(durationInFrames);
  const redBars = removed === 0 ? 0 : Math.max(1, Math.min(MAX_BARS, Math.round(removed / 4)));
  const greenBars = added === 0 ? 0 : Math.max(1, Math.min(MAX_BARS, Math.round(added / 4)));
  const stagger = Math.max(4, Math.min(12, (typeEnd - typeStart) / Math.max(1, redBars + greenBars)));
  const bar = (i: number, kind: "removed" | "added") => {
    const order = kind === "removed" ? i : redBars + i;
    const p = interpolate(frame, [typeStart + order * stagger, typeStart + order * stagger + 10], [0, 1], {
      easing: EASE,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    if (p === 0) return null;
    const width = (BAR_WIDTHS[order % BAR_WIDTHS.length] ?? 0.7) * 100;
    return (
      <div
        key={`${kind}-${i}`}
        style={{
          height: 30,
          overflow: "hidden",
          backgroundColor: kind === "removed" ? theme.failSoft : theme.okSoft,
          borderLeft: `5px solid ${kind === "removed" ? theme.fail : theme.ok}`,
          width: `${width * p}%`,
          opacity: p,
          borderRadius: 6,
        }}
      />
    );
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {Array.from({ length: redBars }, (_, i) => bar(i, "removed"))}
      {Array.from({ length: greenBars }, (_, i) => bar(i, "added"))}
      <div style={{ display: "flex", gap: 32, marginTop: 20, fontSize: 60, fontWeight: 700 }}>
        <span style={{ color: theme.ok }}>+{added}</span>
        {removed > 0 ? <span style={{ color: theme.fail }}>−{removed}</span> : null}
      </div>
    </div>
  );
};

const EditPanel: React.FC<{ artifact: EditArtifact; durationInFrames: number; style?: CSSProperties }> = ({
  artifact,
  durationInFrames,
  style,
}) => {
  const frame = useCurrentFrame();
  const lines = useMemo(() => parseSnippet(artifact.snippet), [artifact.snippet]);
  const { schedule, collapseDur } = useMemo(
    () => buildDiffSchedule(lines, durationInFrames),
    [lines, durationInFrames],
  );
  const focused = (i: number) =>
    artifact.focus !== undefined && i >= artifact.focus.start && i <= artifact.focus.end;

  return (
    <Panel variant="code" title={artifact.file} style={style}>
      <div style={{ display: "flex", gap: 24, fontSize: 26, marginBottom: 20 }}>
        <span style={{ color: theme.ok }}>+{artifact.added}</span>
        <span style={{ color: theme.fail }}>−{artifact.removed}</span>
      </div>
      {lines.length === 0 ? (
        <AbstractDiff added={artifact.added} removed={artifact.removed} durationInFrames={durationInFrames} />
      ) : (
        lines.map((line, i) => {
          const slot = schedule.get(i);
          if (line.kind === "removed" && slot?.collapseStart !== undefined) {
            const collapse = interpolate(frame, [slot.collapseStart, slot.collapseStart + collapseDur], [1, 0], {
              easing: EASE,
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            if (collapse === 0) return null;
            return (
              <DiffRow
                key={i}
                sign="-"
                color={theme.fail}
                bg={theme.failSoft}
                text={line.text}
                height={LINE_HEIGHT * collapse}
                opacity={collapse}
              />
            );
          }
          if (line.kind === "added" && slot?.typeStart !== undefined) {
            if (frame < slot.typeStart) return null;
            const grow = interpolate(frame, [slot.typeStart, slot.typeStart + 6], [0, 1], {
              easing: EASE,
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const chars = Math.floor((frame - slot.typeStart) * (slot.charsPerFrame ?? 1));
            const typed = line.text.slice(0, chars);
            return (
              <DiffRow
                key={i}
                sign="+"
                color={theme.ok}
                bg={focused(i) ? theme.accentSoft : theme.okSoft}
                text={typed}
                cursor={chars < line.text.length}
                height={LINE_HEIGHT * grow}
                opacity={grow}
                focus={focused(i)}
              />
            );
          }
          if (line.kind === "context") {
            return (
              <DiffRow key={i} sign=" " color={theme.textDim} bg="transparent" text={line.text} height={LINE_HEIGHT} opacity={1} />
            );
          }
          return null;
        })
      )}
    </Panel>
  );
};

// ── command: terminal panel ──────────────────────────────────────────────────

const CommandPanel: React.FC<{ artifact: CommandArtifact; durationInFrames: number; style?: CSSProperties }> = ({
  artifact,
  durationInFrames,
  style,
}) => {
  const frame = useCurrentFrame();
  const { typeStart, typeEnd, revealStart } = artifactSchedule(durationInFrames);
  const chars = Math.floor(Math.max(0, frame - typeStart) * (artifact.command.length / Math.max(1, typeEnd - typeStart)));
  const failed = artifact.exitCode !== 0;
  const color = failed ? theme.fail : theme.ok;
  const summaryIn = interpolate(frame, [typeEnd, typeEnd + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const badgeIn = interpolate(frame, [revealStart, revealStart + 12], [0, 1], {
    easing: EASE_POP,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sh = failed ? shake(frame, revealStart, 10) : { x: 0, y: 0 };

  return (
    <Panel
      variant="terminal"
      style={{ ...style, transform: `${style?.transform ?? ""} translate(${sh.x.toFixed(2)}px, ${sh.y.toFixed(2)}px)` }}
    >
      <div style={{ color: theme.textDim, fontSize: 28, marginBottom: 24 }}>
        <span style={{ color: theme.accent }}>$ </span>
        {artifact.command.slice(0, chars)}
      </div>
      {artifact.summary ? (
        <div style={{ color: theme.textDim, fontSize: 28, lineHeight: 1.5, marginBottom: 32, opacity: summaryIn }}>
          {artifact.summary}
        </div>
      ) : null}
      <div
        style={{
          display: "inline-block",
          padding: "14px 36px",
          borderRadius: 14,
          border: `3px solid ${color}`,
          backgroundColor: failed ? theme.failSoft : theme.okSoft,
          color,
          fontSize: 44,
          fontWeight: 700,
          opacity: badgeIn,
          transform: `scale(${badgeIn === 0 ? 0.6 : 0.6 + badgeIn * 0.4})`,
        }}
      >
        {failed ? "✗" : "✓"} exit {artifact.exitCode}
      </div>
    </Panel>
  );
};

// ── create: file-tree panel ──────────────────────────────────────────────────

const CreatePanel: React.FC<{ artifact: CreateArtifact; durationInFrames: number; style?: CSSProperties }> = ({
  artifact,
  durationInFrames,
  style,
}) => {
  const frame = useCurrentFrame();
  const { typeStart } = artifactSchedule(durationInFrames);
  return (
    <Panel variant="tree" title="new files" style={style}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {artifact.files.map((file, i) => {
          const parts = file.split("/").filter(Boolean);
          const depth = Math.max(0, parts.length - 1);
          const start = typeStart + i * 8;
          const p = interpolate(frame, [start, start + 10], [0, 1], {
            easing: EASE_POP,
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          if (p === 0) return null;
          return (
            <div
              key={file}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginLeft: depth * 40,
                opacity: p,
                transform: `scale(${0.85 + p * 0.15})`,
                transformOrigin: "left center",
                fontSize: 30,
              }}
            >
              <span style={{ color: theme.accent, fontWeight: 700 }}>+</span>
              <span style={{ color: theme.textPrimary }}>{parts[parts.length - 1] ?? file}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
};

// ── subagents: labeled task chips ────────────────────────────────────────────
// Shared by Action and Showcase (both need the subagents choreography — the
// artifact kind ArtifactPanel above deliberately doesn't render): a row of
// popped-in chips above the spawning Character. Sizing differs by context
// (Showcase is the larger finale remix), so callers pass fontSize/gap.

export const SubagentTasks: React.FC<{
  tasks: readonly string[];
  fontSize?: number;
  gap?: number;
  stagger?: number;
}> = ({ tasks, fontSize = 28, gap = 24, stagger = 6 }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", gap, flexWrap: "wrap", justifyContent: "center" }}>
      {tasks.map((task, i) => {
        const start = 10 + i * stagger;
        const p = interpolate(frame, [start, start + 10], [0, 1], {
          easing: EASE_POP,
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        if (p === 0) return null;
        return (
          <div
            key={task}
            style={{
              padding: "16px 28px",
              borderRadius: 999,
              border: `2px solid ${theme.accent}`,
              color: theme.textPrimary,
              fontSize,
              opacity: p,
              transform: `scale(${0.8 + p * 0.2})`,
            }}
          >
            {task}
          </div>
        );
      })}
    </div>
  );
};
