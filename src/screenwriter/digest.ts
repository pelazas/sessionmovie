/**
 * Timeline → compact text digest for the LLM screenwriter.
 *
 * The raw transcript can be hundreds of thousands of tokens; the screenwriter
 * reads this digest instead (docs/architecture.md, stage 1 "Digest generation").
 * Per turn: the user prompt, tools used, diffs with sizes, and command results
 * with exit codes — everything the model needs to find the struggle → insight
 * → resolution arc, and nothing else.
 *
 * Inputs are already redacted (redaction happens in the parser, at the door),
 * so the digest is safe to send to the model as-is.
 *
 * Size control is deterministic: render at decreasing detail levels until the
 * digest fits the character cap; as a last resort omit middle turns (the first
 * and final turns carry the setup and the resolution) and hard-truncate.
 */
import { buildSessionFacts, factsDigestLine } from "../facts/facts.js";
import { formatClock } from "../facts/time.js";
import type { CommandRun, FileDiff, Timeline, ToolCall, Turn } from "../parser/types.js";

export const MAX_DIGEST_CHARS = 30_000;

/** One rendering budget; levels are tried from most to least detailed. */
interface DetailLevel {
  promptChars: number;
  toolsPerTurn: number;
  snippetChars: number;
  commandsPerTurn: number;
}

const DETAIL_LEVELS: DetailLevel[] = [
  { promptChars: 700, toolsPerTurn: 40, snippetChars: 500, commandsPerTurn: 20 },
  { promptChars: 400, toolsPerTurn: 16, snippetChars: 160, commandsPerTurn: 10 },
  { promptChars: 250, toolsPerTurn: 8, snippetChars: 0, commandsPerTurn: 6 },
];

function clamp(text: string, max: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length <= max ? collapsed : `${collapsed.slice(0, max - 1)}…`;
}

function humanDuration(totalSec: number): string {
  if (totalSec < 60) return `${totalSec}s`;
  const h = Math.floor(totalSec / 3600);
  const m = Math.round((totalSec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function timeOfDay(timestamp: string | undefined): string {
  // LOCAL clock (src/facts/time.ts) — captions must agree with the clock
  // chips; the raw ISO timestamps are UTC, which nobody lived their day in.
  const clock = formatClock(timestamp);
  return clock ? ` — ${clock}` : "";
}

function header(timeline: Timeline): string {
  const { sessionMeta: meta, totals } = timeline;
  const lines = ["# SESSION"];
  if (meta.repo) lines.push(`repo: ${meta.repo}`);
  if (meta.gitBranch) lines.push(`branch: ${meta.gitBranch}`);
  lines.push(
    `real duration: ${humanDuration(totals.durationSec)} | turns: ${totals.turns} | ` +
      `tool calls: ${totals.toolCalls} | files touched: ${totals.filesTouched} ` +
      `(+${totals.added}/−${totals.removed}) | commands: ${totals.commands} ` +
      `(${totals.failedCommands} failed)`,
  );
  // Session facts (docs/v1-storychange.md): real numbers are anchors — the
  // screenwriter can put them in captions and achievements. One line, only
  // when the transcript carried facts.
  const facts = factsDigestLine(buildSessionFacts(timeline));
  if (facts) lines.push(facts);
  return lines.join("\n");
}

function renderTurn(
  index: number,
  turn: Turn,
  tools: ToolCall[],
  diffs: FileDiff[],
  commands: CommandRun[],
  level: DetailLevel,
): string {
  const lines: string[] = [`## TURN ${index + 1}${timeOfDay(turn.timestamp)}`];
  lines.push(`USER: ${clamp(turn.userMessage, level.promptChars) || "(empty prompt)"}`);

  if (tools.length > 0) {
    const shown = tools.slice(0, level.toolsPerTurn);
    const items = shown.map((t) => `${clamp(t.summary, 120)}${t.ok === false ? " ✗" : ""}`);
    if (tools.length > shown.length) items.push(`…and ${tools.length - shown.length} more`);
    lines.push(`TOOLS (${tools.length}): ${items.join("; ")}`);
  }

  for (const diff of diffs) {
    lines.push(`DIFF: ${diff.file} +${diff.added}/−${diff.removed}`);
    if (diff.snippet && level.snippetChars > 0) {
      const snippet = diff.snippet.trim().slice(0, level.snippetChars);
      lines.push(...snippet.split("\n").map((l) => `  ${l}`));
    }
  }

  if (commands.length > 0) {
    const shown = commands.slice(0, level.commandsPerTurn);
    lines.push("COMMANDS:");
    for (const cmd of shown) {
      const mark = cmd.exitCode === 0 ? "✓" : "✗";
      lines.push(`  ${mark} ${clamp(cmd.command, 160)} → exit ${cmd.exitCode}`);
    }
    if (commands.length > shown.length) {
      lines.push(`  …and ${commands.length - shown.length} more`);
    }
  }

  return lines.join("\n");
}

function renderTurnBlocks(timeline: Timeline, level: DetailLevel): string[] {
  return timeline.turns.map((turn, i) =>
    renderTurn(
      i,
      turn,
      timeline.toolCalls.filter((t) => t.turnIndex === i),
      timeline.diffs.filter((d) => d.turnIndex === i),
      timeline.commands.filter((c) => c.turnIndex === i),
      level,
    ),
  );
}

/** Drop turns from the middle until the digest fits; setup and resolution survive. */
function omitMiddleTurns(head: string, blocks: string[], maxChars: number): string {
  for (let keep = blocks.length - 1; keep >= 2; keep--) {
    const half = Math.ceil(keep / 2);
    const kept = [
      ...blocks.slice(0, half),
      `[… ${blocks.length - keep} turn(s) omitted for length …]`,
      ...blocks.slice(blocks.length - (keep - half)),
    ];
    const text = [head, ...kept].join("\n\n");
    if (text.length <= maxChars) return text;
  }
  const minimal = [head, blocks[0] ?? "", "[… remaining turns omitted for length …]"].join("\n\n");
  return minimal.slice(0, maxChars);
}

/**
 * Render the timeline as a compact, model-readable text digest,
 * capped at `maxChars` (deterministically — same timeline, same digest).
 */
export function digestTimeline(timeline: Timeline, maxChars: number = MAX_DIGEST_CHARS): string {
  const head = header(timeline);
  let blocks: string[] = [];
  for (const level of DETAIL_LEVELS) {
    blocks = renderTurnBlocks(timeline, level);
    const text = [head, ...blocks].join("\n\n");
    if (text.length <= maxChars) return text;
  }
  return omitMiddleTurns(head, blocks, maxChars);
}
