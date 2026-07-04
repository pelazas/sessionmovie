/**
 * Session-facts types — a LEAF module (no imports) so the renderer can
 * type-only import it without dragging CLI/node code into remotion's
 * typecheck, exactly like src/voiceover/types.ts.
 *
 * Facts ride the composition input props as a renderer-side sidecar; the
 * frozen screenplay IR is untouched (docs/v1-storychange.md "Session facts").
 * All numbers are computed CLI-side — the renderer never derives a number.
 */

/** One pre-formatted stat tile: the renderer displays it verbatim. */
export interface FactTile {
  /** Short lowercase label, e.g. "API-equivalent spend (est.)". */
  label: string;
  /** Pre-formatted value, e.g. "≈$9.40", "72% cached", "14". */
  value: string;
}

export interface SessionFacts {
  /** Token totals deduped by API message id (transcripts repeat usage per content block). */
  tokens?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheCreation: number;
  };
  /** cacheRead / all input-side tokens, 0..1. */
  cacheRatio?: number;
  /** Distinct model ids in first-use order. */
  models?: string[];
  /** USD at API list prices — "API-equivalent value" for subscription users. */
  estimatedCostUSD?: number;
  /** USD the prompt cache saved vs. re-reading everything fresh. */
  cacheSavedUSD?: number;
  costPerCommitUSD?: number;
  costPerLineShippedUSD?: number;
  /** Subagents spawned (Agent/Task tool calls). */
  subagents?: number;
  git?: {
    commits: number;
    pushes: number;
    prsOpened: number;
    prsMerged: number;
  };
  tests?: { runs: number; failed: number };
  rhythm?: {
    activeSec: number;
    idleSec: number;
    longestPauseSec: number;
    peakToolCallsPerMinute: number;
  };
}
