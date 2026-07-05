import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { EASE, popIn, shake } from "../../motion";
import { artifactSchedule } from "../../timing";
import type { CommandArtifact, CreateArtifact, EditArtifact } from "../../screenplay";
import { theme } from "../../theme";
import { Panel } from "../Panel";

type DiffLine = { kind: "context" | "removed" | "added"; text: string };
const parseSnippet = (s: string | undefined): DiffLine[] =>
  (s ?? "").split("\n").filter((l) => l.length > 0).map((l) =>
    l.startsWith("+") ? { kind: "added" as const, text: l.slice(1) }
    : l.startsWith("-") ? { kind: "removed" as const, text: l.slice(1) }
    : { kind: "context" as const, text: l.startsWith(" ") ? l.slice(1) : l });

const EditPanel: React.FC<{ a: EditArtifact; dur: number }> = ({ a, dur }) => {
  const frame = useCurrentFrame();
  const { typeStart, typeEnd } = artifactSchedule(dur);
  const lines = parseSnippet(a.snippet);
  const focused = (i: number) => a.focus !== undefined && i >= a.focus.start && i <= a.focus.end;
  const totalChars = Math.max(1, lines.filter((l) => l.kind === "added").reduce((n, l) => n + l.text.length, 0));
  const cpf = totalChars / Math.max(1, typeEnd - typeStart);
  let typedBudget = Math.max(0, (frame - typeStart) * cpf);
  return (
    <Panel variant="code" title={a.file}
      bodyStyle={{ padding: 0, fontSize: 30, minHeight: 360 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 20, padding: "12px 32px", color: theme.textDim }}>
        <span style={{ color: theme.ok }}>+{a.added}</span><span style={{ color: theme.fail }}>−{a.removed}</span>
      </div>
      {lines.length === 0 ? (
        <AbstractBars added={a.added} removed={a.removed} dur={dur} />
      ) : (
        <div style={{ padding: "12px 0 32px" }}>
          {lines.map((line, i) => {
            if (line.kind === "removed") {
              const collapse = interpolate(frame, [typeStart, typeStart + 12], [1, 0], { easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              if (collapse === 0) return null;
              return <Row key={i} sign="−" color={theme.fail} bg={theme.failSoft} text={line.text} opacity={collapse} scale={collapse} />;
            }
            if (line.kind === "added") {
              const take = Math.min(line.text.length, Math.floor(typedBudget));
              typedBudget -= line.text.length;
              if (take <= 0 && frame < typeEnd) return null;
              return <Row key={i} sign="+" color={theme.ok} bg={theme.okSoft} text={line.text.slice(0, Math.max(0, take))} big={focused(i)} />;
            }
            return <Row key={i} sign=" " color={theme.textDim} bg="transparent" text={line.text} />;
          })}
        </div>
      )}
    </Panel>
  );
};

const Row: React.FC<{ sign: string; color: string; bg: string; text: string; opacity?: number; scale?: number; big?: boolean }> =
  ({ sign, color, bg, text, opacity = 1, scale = 1, big }) => (
  <div style={{ display: "flex", gap: 18, alignItems: "center", padding: "0 32px", backgroundColor: bg, opacity,
    height: 56 * scale, overflow: "hidden", whiteSpace: "pre",
    transform: big ? "scale(1.22)" : undefined, transformOrigin: "left center",
    borderLeft: big ? `6px solid ${theme.accent}` : "6px solid transparent" }}>
    <span style={{ color, width: 22, flexShrink: 0, fontWeight: 700 }}>{sign}</span>
    <span style={{ color: sign === " " ? theme.textDim : theme.textPrimary }}>{text}</span>
  </div>
);

const BAR_W = [0.86, 0.62, 0.94, 0.5, 0.74, 0.68, 0.9, 0.56];
const AbstractBars: React.FC<{ added: number; removed: number; dur: number }> = ({ added, removed, dur }) => {
  const frame = useCurrentFrame();
  const red = removed === 0 ? 0 : Math.max(1, Math.min(8, Math.round(removed / 4)));
  const green = added === 0 ? 0 : Math.max(1, Math.min(8, Math.round(added / 4)));
  const start = Math.round(dur * 0.12); const stagger = 8;
  const bar = (i: number, kind: "removed" | "added") => {
    const order = kind === "removed" ? i : red + i;
    const p = interpolate(frame, [start + order * stagger, start + order * stagger + 10], [0, 1], { easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    if (p === 0) return null;
    return <div key={`${kind}${i}`} style={{ height: 30, width: `${(BAR_W[order % BAR_W.length] ?? 0.7) * 100 * p}%`,
      backgroundColor: kind === "removed" ? theme.failSoft : theme.okSoft, borderLeft: `6px solid ${kind === "removed" ? theme.fail : theme.ok}`, borderRadius: 6 }} />;
  };
  return <div style={{ padding: "28px 40px", display: "flex", flexDirection: "column", gap: 16 }}>
    {Array.from({ length: red }, (_, i) => bar(i, "removed"))}
    {Array.from({ length: green }, (_, i) => bar(i, "added"))}
    <div style={{ display: "flex", gap: 32, marginTop: 20, fontSize: 60, fontWeight: 700 }}>
      <span style={{ color: theme.ok }}>+{added}</span>{removed > 0 && <span style={{ color: theme.fail }}>−{removed}</span>}
    </div>
  </div>;
};

const CommandPanel: React.FC<{ a: CommandArtifact; dur: number }> = ({ a, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { typeStart, typeEnd, revealStart } = artifactSchedule(dur);
  const chars = Math.floor(Math.max(0, frame - typeStart) * (a.command.length / Math.max(1, typeEnd - typeStart)));
  const failed = a.exitCode !== 0;
  const color = failed ? theme.fail : theme.ok;
  const badge = popIn(frame - revealStart, fps);
  const sh = failed ? shake(frame, revealStart, 10) : { x: 0, y: 0 };
  return (
    <div style={{ transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Panel variant="terminal" title="bash" bodyStyle={{ minHeight: 320 }}>
        <div style={{ color: theme.textDim, fontSize: 34, marginBottom: 24 }}><span style={{ color: theme.accent }}>$ </span>{a.command.slice(0, chars)}</div>
        {a.summary && frame > typeEnd && <div style={{ color: theme.textDim, fontSize: 30, lineHeight: 1.5, marginBottom: 32 }}>{a.summary}</div>}
        {frame >= revealStart && (
          <div style={{ display: "inline-block", padding: "16px 40px", borderRadius: 14, border: `3px solid ${color}`,
            backgroundColor: failed ? theme.failSoft : theme.okSoft, color, fontSize: 48, fontWeight: 700,
            opacity: badge.opacity, transform: `scale(${badge.scale})` }}>
            {failed ? "✗" : "✓"} exit {a.exitCode}
          </div>
        )}
      </Panel>
    </div>
  );
};

const CreatePanel: React.FC<{ a: CreateArtifact; dur: number }> = ({ a }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = 14; const stagger = 8;
  return (
    <Panel variant="tree" title="new files" trafficDots={false} bodyStyle={{ minHeight: 320 }}>
      {a.files.map((f, i) => {
        const p = popIn(frame - (start + i * stagger), fps);
        if (p.opacity <= 0) return null;
        const depth = Math.max(0, f.split("/").filter(Boolean).length - 1);
        return <div key={i} style={{ display: "flex", gap: 14, alignItems: "center", padding: "10px 0",
          paddingLeft: 24 + depth * 32, opacity: p.opacity, transform: `translateX(${(1 - p.opacity) * -20}px)`, fontSize: 32 }}>
          <span style={{ color: theme.accent, fontWeight: 700 }}>+</span>
          <span style={{ color: theme.textPrimary }}>{f.split("/").filter(Boolean).pop()}</span>
        </div>;
      })}
    </Panel>
  );
};

export const ArtifactPanel: React.FC<{ artifact: EditArtifact | CommandArtifact | CreateArtifact; durationInFrames: number }> =
  ({ artifact, durationInFrames }) =>
    artifact.kind === "edit" ? <EditPanel a={artifact} dur={durationInFrames} />
    : artifact.kind === "command" ? <CommandPanel a={artifact} dur={durationInFrames} />
    : <CreatePanel a={artifact} dur={durationInFrames} />;

// ── subagents: labeled task chips ────────────────────────────────────────────
// Shared by Action and Showcase (both need the subagents choreography — the
// artifact kinds above deliberately don't cover it): a row of popped-in chips
// above the spawning Character. Sizing differs by context (Showcase is the
// larger finale remix), so callers pass fontSize/gap.

export const SubagentTasks: React.FC<{
  tasks: readonly string[];
  fontSize?: number;
  gap?: number;
  stagger?: number;
}> = ({ tasks, fontSize = 28, gap = 24, stagger = 6 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", gap, flexWrap: "wrap", justifyContent: "center" }}>
      {tasks.map((task, i) => {
        const p = popIn(frame - (10 + i * stagger), fps);
        if (p.opacity <= 0) return null;
        return (
          <div
            key={task}
            style={{
              padding: "16px 28px",
              borderRadius: 999,
              border: `2px solid ${theme.accent}`,
              color: theme.textPrimary,
              fontSize,
              opacity: p.opacity,
              transform: `scale(${p.scale})`,
            }}
          >
            {task}
          </div>
        );
      })}
    </div>
  );
};
