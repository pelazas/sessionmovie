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
    id?: string;
    role?: string;
    model?: string;
    content?: unknown;
    usage?: Record<string, unknown>;
  };
  toolUseResult?: Record<string, unknown>;
}

/** Gaps longer than this read as "walked away", not "thinking" (session facts). */
const IDLE_GAP_SEC = 120;

/** Per-turn cap on captured assistant utterances — bounds memory on long turns. */
const MAX_ASSISTANT_UTTERANCES_PER_TURN = 8;

/** Each captured utterance is condensed to this many chars, like userMessage. */
const ASSISTANT_UTTERANCE_CHARS = 200;

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
  const createdFiles: string[] = [];
  const meta: Timeline["sessionMeta"] = {};
  const pendingByToolUseId = new Map<string, PendingToolUse>();
  let firstTimestamp: string | undefined;
  let lastTimestamp: string | undefined;

  // Assistant turns: distinct messages, deduped by id like usage below (one
  // logical message can repeat itself across several content-block lines).
  // A line without an id can't be deduped against anything, so it always counts.
  let assistantTurns = 0;
  const assistantIdsSeen = new Set<string>();
  // Message ids whose prose we've already captured — a message split across
  // several content-block lines must contribute its text only once.
  const assistantTextIdsSeen = new Set<string>();

  // Session facts (docs/v1-storychange.md): usage totals deduped by API
  // message id (one message spans several content-block lines, each
  // repeating the same usage), models in first-use order, and rhythm.
  const usageTotals = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
  let usageSeen = false;
  const usageCountedIds = new Set<string>();
  const models: string[] = [];
  let prevTsMs: number | undefined;
  let activeSec = 0;
  let idleSec = 0;
  let longestPauseSec = 0;
  let gapsSeen = false;
  const toolUseByMinute = new Map<number, number>();

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
      const tsMs = Date.parse(line.timestamp);
      if (Number.isFinite(tsMs)) {
        if (prevTsMs !== undefined && tsMs > prevTsMs) {
          const gapSec = (tsMs - prevTsMs) / 1000;
          if (gapSec > IDLE_GAP_SEC) idleSec += gapSec;
          else activeSec += gapSec;
          if (gapSec > longestPauseSec) longestPauseSec = gapSec;
          gapsSeen = true;
        }
        prevTsMs = tsMs;
      }
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
      const assistantMessageId = str(line.message?.id);
      if (!assistantMessageId || !assistantIdsSeen.has(assistantMessageId)) {
        if (assistantMessageId) assistantIdsSeen.add(assistantMessageId);
        assistantTurns++;
      }
      const model = str(line.message?.model);
      if (model && !models.includes(model)) models.push(model);
      const usage = asRecord(line.message?.usage);
      if (usage) {
        const messageId = str(line.message?.id);
        if (!messageId || !usageCountedIds.has(messageId)) {
          if (messageId) usageCountedIds.add(messageId);
          const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
          usageTotals.input += num(usage["input_tokens"]);
          usageTotals.output += num(usage["output_tokens"]);
          usageTotals.cacheRead += num(usage["cache_read_input_tokens"]);
          usageTotals.cacheCreation += num(usage["cache_creation_input_tokens"]);
          usageSeen = true;
        }
      }

      const content = line.message?.content;
      if (!Array.isArray(content)) continue;

      // Capture the agent's spoken prose — the first text block of this message
      // — so the screenwriter condenses Claude's real words into `claude`
      // dialogue lines. Redacted at the door like userMessage; deduped by
      // message id (a message split across lines contributes once); attached to
      // the turn the message falls under; capped to bound memory on long turns.
      const currentTurnObj = turns[currentTurn()];
      const alreadyCaptured = assistantMessageId
        ? assistantTextIdsSeen.has(assistantMessageId)
        : false;
      if (currentTurnObj && !alreadyCaptured) {
        const textBlock = content
          .map(asRecord)
          .find((b) => !!b && b["type"] === "text" && !!str(b["text"])?.trim());
        const prose = textBlock ? str(textBlock["text"]) : undefined;
        if (prose) {
          const utterances = (currentTurnObj.assistantText ??= []);
          if (utterances.length < MAX_ASSISTANT_UTTERANCES_PER_TURN) {
            utterances.push(redactString(condense(prose, ASSISTANT_UTTERANCE_CHARS)));
            if (assistantMessageId) assistantTextIdsSeen.add(assistantMessageId);
          }
        }
      }

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
        if (line.timestamp) {
          const minute = Math.floor(Date.parse(line.timestamp) / 60_000);
          if (Number.isFinite(minute)) {
            toolUseByMinute.set(minute, (toolUseByMinute.get(minute) ?? 0) + 1);
          }
        }
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
      const redactedPath = redactString(filePath);
      if (pending.tool === "Write" && !createdFiles.includes(redactedPath)) {
        createdFiles.push(redactedPath);
      }
      const { added, removed, snippet } = countPatch(toolUseResult["structuredPatch"]);
      let effectiveAdded = added;
      // A brand-new file can come back with an empty patch; fall back to content lines.
      if (added === 0 && removed === 0 && pending.tool === "Write") {
        const newContent = str(toolUseResult["content"]) ?? str(pending.input["content"]);
        if (newContent) effectiveAdded = newContent.split("\n").length;
      }
      const diff: FileDiff = {
        file: redactedPath,
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

  const peakToolCallsPerMinute = Math.max(0, ...toolUseByMinute.values());

  return {
    sessionMeta: meta,
    turns,
    toolCalls,
    diffs,
    commands,
    createdFiles,
    ...(usageSeen && { usage: usageTotals }),
    ...(models.length > 0 && { models }),
    ...(gapsSeen && {
      rhythm: {
        activeSec: Math.round(activeSec),
        idleSec: Math.round(idleSec),
        longestPauseSec: Math.round(longestPauseSec),
        peakToolCallsPerMinute,
      },
    }),
    totals: {
      turns: turns.length,
      assistantTurns,
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
