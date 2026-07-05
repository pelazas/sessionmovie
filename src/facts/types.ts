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

/**
 * One pre-formatted stats-card entry for the no-genre stats scene (PR-G,
 * docs/screenplay-format.md "stats numbers live outside the IR"). `value` is
 * the whole displayed phrase, e.g. "6 test runs · 4 green" — the renderer
 * never assembles it from parts.
 */
export interface StatCard {
  /** Stable id for the card, e.g. "tests", "commits" — not displayed. */
  id: string;
  /** Short caption, e.g. "test runs". */
  label: string;
  /** Pre-formatted value, e.g. "6 test runs · 4 green". */
  value: string;
  /** ok = green flag on the card; fail = red flag. Omitted = neutral. */
  accent?: "ok" | "fail";
}

/** Pre-formatted title-scene metadata; the renderer never touches Date. */
export interface TitleMeta {
  repo?: string;
  /** e.g. "Jul 5, 2026". */
  dateLabel?: string;
  /** Real session duration, e.g. "2h 14m". */
  durationLabel?: string;
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
