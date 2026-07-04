/**
 * Claude Code session transcript (JSONL) → Timeline.
 *
 * The transcript format is undocumented and shifts between Claude Code
 * versions, so everything here is deliberately boring and defensive:
 * unknown event types are skipped with a debug log, never a crash, and
 * every displayable string is routed through the redaction layer.
 */
import { redactString } from "./redact.js";
import type { CommandRun, FileDiff, Timeline, ToolCall, Turn } from "./types.js";

const debugEnabled = !!process.env["DEBUG"];
function debug(message: string): void {
  if (debugEnabled) process.stderr.write(`[parser] ${message}\n`);
}

/** Line types we understand. Everything else is skipped with a debug log. */
const KNOWN_TYPES = new Set(["user", "assistant", "system"]);

interface RawLine {
  type?: string;
  timestamp?: string;
  sessionId?: string;
  cwd?: string;
  gitBranch?: string;
  isMeta?: boolean;
  isSidechain?: boolean;
  message?: {
    role?: string;
    content?: unknown;
  };
  toolUseResult?: Record<string, unknown>;
}

interface PendingToolUse {
  tool: string;
  input: Record<string, unknown>;
  turnIndex: number;
  call: ToolCall;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Collapse whitespace and clamp; the result is display-ready (redacted by callers). */
function condense(text: string, max: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length <= max ? collapsed : `${collapsed.slice(0, max - 1)}…`;
}

/** Real user prompts only — not tool results, not harness meta/command noise. */
function extractUserPrompt(line: RawLine): string | undefined {
  if (line.isMeta) return undefined;
  const content = line.message?.content;
  let text: string | undefined;
  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    const parts = content
      .map(asRecord)
      .filter((b): b is Record<string, unknown> => !!b && b["type"] === "text")
      .map((b) => str(b["text"]) ?? "");
    if (content.some((b) => asRecord(b)?.["type"] === "tool_result")) return undefined;
    text = parts.join("\n");
  }
  if (!text) return undefined;
  // Local-command noise (/clear etc.) is harness bookkeeping, not a prompt.
  if (text.includes("<command-name>") || text.includes("<local-command-")) return undefined;
  if (text.startsWith("<system-reminder>")) return undefined;
  const cleaned = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "").trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

/** One-line summary of a tool call from its input, before results are known. */
function summarizeToolUse(tool: string, input: Record<string, unknown>): string {
  const basename = (p: string) => p.split("/").filter(Boolean).pop() ?? p;
  switch (tool) {
    case "Bash": {
      const description = str(input["description"]);
      const command = str(input["command"]);
      return `Bash: ${condense(description ?? command ?? "(command)", 80)}`;
    }
    case "Read":
      return `Read ${basename(str(input["file_path"]) ?? "(file)")}`;
    case "Write":
      return `Write ${basename(str(input["file_path"]) ?? "(file)")}`;
    case "Edit":
      return `Edit ${basename(str(input["file_path"]) ?? "(file)")}`;
    case "Grep":
      return `Grep ${condense(str(input["pattern"]) ?? "", 50)}`;
    case "Glob":
      return `Glob ${condense(str(input["pattern"]) ?? "", 50)}`;
    default: {
      // First string field of the input is usually the most descriptive.
      const hint = Object.values(input).find((v): v is string => typeof v === "string");
      return hint ? `${tool}: ${condense(hint, 60)}` : tool;
    }
  }
}

interface ToolResultInfo {
  isError: boolean;
  exitCode?: number;
}

/** Pull error status / exit code from a tool_result content block. */
function readToolResult(block: Record<string, unknown>): ToolResultInfo {
  const isError = block["is_error"] === true;
  let contentText = "";
  const content = block["content"];
  if (typeof content === "string") {
    contentText = content;
  } else if (Array.isArray(content)) {
    contentText = content
      .map(asRecord)
      .map((b) => (b && b["type"] === "text" ? (str(b["text"]) ?? "") : ""))
      .join("\n");
  }
  const exitMatch = contentText.match(/Exit code:? (\d+)/i);
  const info: ToolResultInfo = { isError };
  if (exitMatch?.[1] !== undefined) info.exitCode = Number(exitMatch[1]);
  return info;
}

/** Count +/- lines in a structuredPatch (array of hunks with `lines`). */
function countPatch(patch: unknown): { added: number; removed: number; snippet?: string } {
  let added = 0;
  let removed = 0;
  let snippet: string | undefined;
  if (!Array.isArray(patch)) return { added, removed };
  for (const hunk of patch) {
    const lines = asRecord(hunk)?.["lines"];
    if (!Array.isArray(lines)) continue;
    for (const line of lines) {
      if (typeof line !== "string") continue;
      if (line.startsWith("+")) added += 1;
      else if (line.startsWith("-")) removed += 1;
    }
    if (!snippet && lines.length > 0) {
      snippet = lines
        .filter((l): l is string => typeof l === "string")
        .slice(0, 12)
        .join("\n")
        .slice(0, 600);
    }
  }
  const result: { added: number; removed: number; snippet?: string } = { added, removed };
  if (snippet) result.snippet = snippet;
  return result;
}

export function parseTranscript(jsonl: string): Timeline {
  const turns: Turn[] = [];
  const toolCalls: ToolCall[] = [];
  const diffs: FileDiff[] = [];
  const commands: CommandRun[] = [];
  const meta: Timeline["sessionMeta"] = {};
  const pendingByToolUseId = new Map<string, PendingToolUse>();
  let firstTimestamp: string | undefined;
  let lastTimestamp: string | undefined;

  for (const rawLine of jsonl.split("\n")) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    let line: RawLine;
    try {
      line = JSON.parse(trimmed) as RawLine;
    } catch {
      debug(`skipping unparseable line: ${trimmed.slice(0, 80)}`);
      continue;
    }

    const type = line.type ?? "(untyped)";
    if (!KNOWN_TYPES.has(type)) {
      debug(`skipping unknown event type: ${type}`);
      continue;
    }
    if (line.isSidechain) {
      debug("skipping sidechain line");
      continue;
    }

    if (line.timestamp) {
      firstTimestamp ??= line.timestamp;
      lastTimestamp = line.timestamp;
    }
    meta.sessionId ??= line.sessionId;
    meta.gitBranch ??= line.gitBranch;
    if (!meta.repo && line.cwd) meta.repo = redactString(line.cwd);

    const currentTurn = () => Math.max(0, turns.length - 1);

    if (type === "user") {
      const prompt = extractUserPrompt(line);
      if (prompt !== undefined) {
        const turn: Turn = { userMessage: redactString(condense(prompt, 300)) };
        if (line.timestamp) turn.timestamp = line.timestamp;
        turns.push(turn);
      }

      // Tool results ride on user lines; match them back to pending tool_use ids.
      const content = line.message?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          const rec = asRecord(block);
          if (!rec || rec["type"] !== "tool_result") continue;
          const id = str(rec["tool_use_id"]);
          const pending = id ? pendingByToolUseId.get(id) : undefined;
          if (!pending) continue;
          if (id) pendingByToolUseId.delete(id);
          recordToolOutcome(pending, rec, line.toolUseResult);
        }
      }
      continue;
    }

    if (type === "assistant") {
      const content = line.message?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        const rec = asRecord(block);
        if (!rec || rec["type"] !== "tool_use") continue;
        const id = str(rec["id"]);
        const tool = str(rec["name"]) ?? "(unknown tool)";
        const input = asRecord(rec["input"]) ?? {};
        const call: ToolCall = {
          tool,
          summary: redactString(summarizeToolUse(tool, input)),
          turnIndex: currentTurn(),
        };
        toolCalls.push(call);
        if (id) pendingByToolUseId.set(id, { tool, input, turnIndex: call.turnIndex, call });
      }
      continue;
    }

    // type === "system": nothing displayable we need for v1.
  }

  // Tool uses that never got a result (interrupted session) stay ok:undefined.
  if (pendingByToolUseId.size > 0) {
    debug(`${pendingByToolUseId.size} tool call(s) without results`);
  }

  function recordToolOutcome(
    pending: PendingToolUse,
    resultBlock: Record<string, unknown>,
    toolUseResult: Record<string, unknown> | undefined,
  ): void {
    const info = readToolResult(resultBlock);
    const call = pending.call;
    call.ok = !info.isError;

    if (pending.tool === "Bash") {
      const command = str(pending.input["command"]) ?? "(command)";
      const exitCode = info.exitCode ?? (info.isError ? 1 : 0);
      commands.push({
        command: redactString(condense(command, 200)),
        exitCode,
        turnIndex: pending.turnIndex,
      });
      if (call && exitCode !== 0) call.summary = redactString(`${call.summary} → exit ${exitCode}`);
      return;
    }

    if ((pending.tool === "Edit" || pending.tool === "Write") && toolUseResult) {
      const filePath = str(toolUseResult["filePath"]) ?? str(pending.input["file_path"]);
      if (!filePath) return;
      const { added, removed, snippet } = countPatch(toolUseResult["structuredPatch"]);
      let effectiveAdded = added;
      // A brand-new file can come back with an empty patch; fall back to content lines.
      if (added === 0 && removed === 0 && pending.tool === "Write") {
        const newContent = str(toolUseResult["content"]) ?? str(pending.input["content"]);
        if (newContent) effectiveAdded = newContent.split("\n").length;
      }
      const diff: FileDiff = {
        file: redactString(filePath),
        added: effectiveAdded,
        removed,
        turnIndex: pending.turnIndex,
      };
      if (snippet) diff.snippet = redactString(snippet);
      diffs.push(diff);
    }
  }

  const durationSec =
    firstTimestamp && lastTimestamp
      ? Math.max(0, Math.round((Date.parse(lastTimestamp) - Date.parse(firstTimestamp)) / 1000))
      : 0;
  if (firstTimestamp) meta.startedAt = firstTimestamp;
  if (lastTimestamp) meta.endedAt = lastTimestamp;

  return {
    sessionMeta: meta,
    turns,
    toolCalls,
    diffs,
    commands,
    totals: {
      turns: turns.length,
      toolCalls: toolCalls.length,
      filesTouched: new Set(diffs.map((d) => d.file)).size,
      added: diffs.reduce((acc, d) => acc + d.added, 0),
      removed: diffs.reduce((acc, d) => acc + d.removed, 0),
      commands: commands.length,
      failedCommands: commands.filter((c) => c.exitCode !== 0).length,
      durationSec,
    },
  };
}
