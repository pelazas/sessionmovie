/**
 * Timeline → compact text digest for the LLM screenwriter.
 *
 * The raw transcript can be hundreds of thousands of tokens; the screenwriter
 * reads this digest instead (docs/architecture.md, stage 1 "Digest generation").
 * Per turn: the user prompt (the user's side of the exchange), then what the
 * agent did that turn (its side) — tools used, diffs with sizes and new-file
 * markers, subagent dispatches, and command results with exit codes. That is
 * everything the model needs to write the dialogue → action pairs
 * (docs/screenplay-format.md) and pick one truthful artifact per action, and
 * nothing else.
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

/** Tool names that spawn subagents in Claude Code transcripts (mirrors heuristic.ts / facts.ts). */
const SUBAGENT_TOOLS = new Set(["Task", "Agent"]);

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
  // Files written from scratch feed the `create` action artifact
  // (docs/screenplay-format.md): the per-turn DIFF lines below mark each one
  // "(new file)", so this is just the count the model needs to know a create
  // beat is available. Matches the annotation exactly — Write-touched AND
  // removed nothing (an overwrite is an edit, not a create).
  const createdSet = new Set(timeline.createdFiles);
  const newFiles = new Set(
    timeline.diffs.filter((d) => createdSet.has(d.file) && d.removed === 0).map((d) => d.file),
  );
  if (newFiles.size > 0) {
    lines.push(`created from scratch: ${newFiles.size} file(s)`);
  }
  // Session facts (docs/v1-storychange.md): real numbers are context for the
  // screenwriter's captions — the rendered stats numbers themselves ride the
  // CLI facts sidecar, not the screenplay. One line, only when facts exist.
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
  createdSet: Set<string>,
  level: DetailLevel,
): string {
  const lines: string[] = [`## TURN ${index + 1}${timeOfDay(turn.timestamp)}`];
  // USER is the user's side of the exchange (dialogue source for `speaker:user`);
  // the TOOLS / DIFF / COMMAND / SUBAGENTS below are the agent's side — what it
  // actually did that turn (dialogue source for `speaker:claude`).
  lines.push(`USER: ${clamp(turn.userMessage, level.promptChars) || "(empty prompt)"}`);

  if (tools.length > 0) {
    const shown = tools.slice(0, level.toolsPerTurn);
    const items = shown.map((t) => `${clamp(t.summary, 120)}${t.ok === false ? " ✗" : ""}`);
    if (tools.length > shown.length) items.push(`…and ${tools.length - shown.length} more`);
    lines.push(`TOOLS (${tools.length}): ${items.join("; ")}`);
  }

  // Subagent dispatches, pulled out of the flat TOOLS list so the model can
  // build a truthful `subagents` artifact (tasks <= 60 chars, mirrors the schema).
  const subagents = tools.filter((t) => SUBAGENT_TOOLS.has(t.tool));
  if (subagents.length > 0) {
    const tasks = subagents.map((t) => clamp(t.summary, 60));
    lines.push(`SUBAGENTS (${subagents.length}): ${tasks.join("; ")}`);
  }

  for (const diff of diffs) {
    // "(new file)" only when Write touched it AND it removed nothing — a Write
    // that removes lines overwrote an existing file, not a from-scratch create
    // (createdFiles is "Write-touched", not proven-new; see parser/types.ts).
    const isNew = createdSet.has(diff.file) && diff.removed === 0 ? " (new file)" : "";
    lines.push(`DIFF: ${diff.file} +${diff.added}/−${diff.removed}${isNew}`);
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
  const createdSet = new Set(timeline.createdFiles);
  return timeline.turns.map((turn, i) =>
    renderTurn(
      i,
      turn,
      timeline.toolCalls.filter((t) => t.turnIndex === i),
      timeline.diffs.filter((d) => d.turnIndex === i),
      timeline.commands.filter((c) => c.turnIndex === i),
      createdSet,
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
