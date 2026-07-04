/**
 * Parser output: a structured timeline of session events.
 * Everything displayable in these types has already been redacted —
 * redaction happens in the parser, at the door (docs/security-and-privacy.md).
 */

export interface ToolCall {
  tool: string;
  /** One-line, redacted human summary, e.g. `Bash: npm test → exit 1`. */
  summary: string;
  /** false when the tool call errored; omitted when unknown. */
  ok?: boolean;
  /** Index into Timeline.turns of the turn this call happened in. */
  turnIndex: number;
}

export interface FileDiff {
  /** Redacted file path (home dirs scrubbed). */
  file: string;
  added: number;
  removed: number;
  /** Redacted unified-diff excerpt. */
  snippet?: string;
  turnIndex: number;
}

export interface CommandRun {
  /** Redacted command line. */
  command: string;
  exitCode: number;
  turnIndex: number;
}

export interface Turn {
  /** Redacted, condensed user prompt that started the turn. */
  userMessage: string;
  timestamp?: string;
}

export interface Timeline {
  sessionMeta: {
    sessionId?: string;
    repo?: string;
    gitBranch?: string;
    startedAt?: string;
    endedAt?: string;
  };
  turns: Turn[];
  toolCalls: ToolCall[];
  diffs: FileDiff[];
  commands: CommandRun[];
  /**
   * Token totals from per-message `usage`, deduped by API message id — the
   * transcript repeats the same usage on every content-block line of one
   * message. Absent when the transcript carries no usage (older versions).
   */
  usage?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheCreation: number;
  };
  /** Distinct model ids in first-use order; absent when none seen. */
  models?: string[];
  /** Session rhythm from event timestamps; absent without timestamps. */
  rhythm?: {
    /** Sum of gaps ≤ the idle threshold (120s). */
    activeSec: number;
    /** Sum of gaps above the idle threshold. */
    idleSec: number;
    longestPauseSec: number;
    /** Busiest minute, counted in tool_use blocks. */
    peakToolCallsPerMinute: number;
  };
  totals: {
    turns: number;
    toolCalls: number;
    filesTouched: number;
    added: number;
    removed: number;
    commands: number;
    failedCommands: number;
    durationSec: number;
  };
}
