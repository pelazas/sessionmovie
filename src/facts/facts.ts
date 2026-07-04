/**
 * Timeline → SessionFacts → fact tiles + digest line.
 *
 * Everything here is deterministic and CLI-side: the renderer receives
 * pre-formatted tiles and displays them verbatim (docs/v1-storychange.md
 * "Session facts" — numbers are anchors, and the renderer never invents
 * one). Costs come from the pricing DATA table; unknown models mean no
 * estimate, and every estimate is labeled estimated.
 */
import type { CommandRun, Timeline } from "../parser/types.js";
import { pricingFor } from "./pricing.js";
import type { FactTile, SessionFacts } from "./types.js";

/** Tool names that spawn subagents in Claude Code transcripts. */
const SUBAGENT_TOOLS = new Set(["Task", "Agent"]);

/** exit-0 command counters; commands are already redacted strings. */
const GIT_PATTERNS: Array<{ key: keyof NonNullable<SessionFacts["git"]>; pattern: RegExp }> = [
  { key: "commits", pattern: /\bgit commit\b/ },
  { key: "pushes", pattern: /\bgit push\b/ },
  { key: "prsOpened", pattern: /\bgh pr create\b/ },
  { key: "prsMerged", pattern: /\bgh pr merge\b/ },
];

const TEST_PATTERN = /\b(npm (run )?test|node --(import tsx --)?test|pytest|vitest|jest|go test|cargo test)\b/;

function countGit(commands: CommandRun[]): SessionFacts["git"] {
  const git = { commits: 0, pushes: 0, prsOpened: 0, prsMerged: 0 };
  for (const cmd of commands) {
    if (cmd.exitCode !== 0) continue; // only counted when it worked
    for (const { key, pattern } of GIT_PATTERNS) {
      if (pattern.test(cmd.command)) git[key] += 1;
    }
  }
  return git;
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

export function buildSessionFacts(timeline: Timeline): SessionFacts {
  const facts: SessionFacts = {};

  if (timeline.usage) {
    const u = timeline.usage;
    facts.tokens = { ...u };
    const inputSide = u.input + u.cacheRead + u.cacheCreation;
    if (inputSide > 0) facts.cacheRatio = round2(u.cacheRead / inputSide);
  }
  if (timeline.models && timeline.models.length > 0) facts.models = [...timeline.models];

  // Cost estimates: single-model sessions only — with several models the
  // transcript doesn't say which tokens were whose, so no estimate (honest
  // beats clever). u/pricing both known or nothing.
  if (timeline.usage && timeline.models?.length === 1 && timeline.models[0]) {
    const pricing = pricingFor(timeline.models[0]);
    if (pricing) {
      const u = timeline.usage;
      const perTok = (perMillion: number) => perMillion / 1_000_000;
      facts.estimatedCostUSD = round2(
        u.input * perTok(pricing.input) +
          u.output * perTok(pricing.output) +
          u.cacheRead * perTok(pricing.cacheRead) +
          u.cacheCreation * perTok(pricing.cacheWrite),
      );
      // What the cached reads would have cost at the fresh-input rate.
      facts.cacheSavedUSD = round2(u.cacheRead * perTok(pricing.input - pricing.cacheRead));
    }
  }

  const subagents = timeline.toolCalls.filter((t) => SUBAGENT_TOOLS.has(t.tool)).length;
  if (subagents > 0) facts.subagents = subagents;

  const git = countGit(timeline.commands);
  if (git && Object.values(git).some((v) => v > 0)) facts.git = git;

  const testRuns = timeline.commands.filter((c) => TEST_PATTERN.test(c.command));
  if (testRuns.length > 0) {
    facts.tests = {
      runs: testRuns.length,
      failed: testRuns.filter((c) => c.exitCode !== 0).length,
    };
  }

  if (facts.estimatedCostUSD !== undefined && facts.git && facts.git.commits > 0) {
    facts.costPerCommitUSD = round2(facts.estimatedCostUSD / facts.git.commits);
  }
  if (facts.estimatedCostUSD !== undefined && timeline.totals.added > 0) {
    facts.costPerLineShippedUSD = round2(facts.estimatedCostUSD / timeline.totals.added);
  }

  if (timeline.rhythm) facts.rhythm = { ...timeline.rhythm };

  return facts;
}

// ── formatting ───────────────────────────────────────────────────────────────

export function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${Math.round(count / 1_000)}k`;
  return `${count}`;
}

export function formatUSD(usd: number): string {
  return usd >= 100 ? `$${Math.round(usd)}` : `$${usd.toFixed(2)}`;
}

function formatPause(sec: number): string {
  if (sec >= 3600) return `${Math.floor(sec / 3600)}h ${Math.round((sec % 3600) / 60)}m`;
  return `${Math.round(sec / 60)}m`;
}

/**
 * Pick at most `max` fact tiles by deterministic interestingness — rules
 * evaluated top-down, a fact must clear its threshold to earn a tile:
 *
 *   1. estimated spend (always interesting when known — the shareable number)
 *   2. cache savings when ≥ $0.50 (the "you'd have paid double" reveal)
 *   3. subagents when ≥ 3 (an army is a story; one helper isn't)
 *   4. cost per commit when ≥ 2 commits (needs a denominator that means something)
 *   5. longest pause when ≥ 30 min (the lunch break the viewer remembers)
 *   6. peak tool velocity when ≥ 10/min (the montage, quantified)
 *   7. total tokens (fallback anchor when nothing above fired)
 */
export function pickFactTiles(facts: SessionFacts, max = 3): FactTile[] {
  const tiles: FactTile[] = [];
  const push = (label: string, value: string) => {
    if (tiles.length < max) tiles.push({ label, value });
  };

  if (facts.estimatedCostUSD !== undefined) {
    push("API-equivalent spend (est.)", `≈${formatUSD(facts.estimatedCostUSD)}`);
  }
  if (facts.cacheSavedUSD !== undefined && facts.cacheSavedUSD >= 0.5) {
    push("saved by prompt cache (est.)", formatUSD(facts.cacheSavedUSD));
  }
  if (facts.subagents !== undefined && facts.subagents >= 3) {
    push("subagents summoned", `${facts.subagents}`);
  }
  if (facts.costPerCommitUSD !== undefined && (facts.git?.commits ?? 0) >= 2) {
    push("per commit (est.)", `≈${formatUSD(facts.costPerCommitUSD)}`);
  }
  if (facts.rhythm && facts.rhythm.longestPauseSec >= 1800) {
    push("longest pause", formatPause(facts.rhythm.longestPauseSec));
  }
  if (facts.rhythm && facts.rhythm.peakToolCallsPerMinute >= 10) {
    push("peak tool calls / min", `${facts.rhythm.peakToolCallsPerMinute}`);
  }
  if (tiles.length === 0 && facts.tokens) {
    const total = facts.tokens.input + facts.tokens.output + facts.tokens.cacheRead + facts.tokens.cacheCreation;
    push("tokens", formatTokens(total));
  }
  return tiles;
}

/**
 * One compact FACTS line for the digest header — real numbers the
 * screenwriter can anchor captions and achievements on. Empty string when
 * the transcript carried no facts (older versions parse fine).
 */
export function factsDigestLine(facts: SessionFacts): string {
  const parts: string[] = [];
  if (facts.models?.length) parts.push(`model: ${facts.models.join(", ")}`);
  if (facts.tokens) {
    const total = facts.tokens.input + facts.tokens.output + facts.tokens.cacheRead + facts.tokens.cacheCreation;
    const cache = facts.cacheRatio !== undefined ? ` (${Math.round(facts.cacheRatio * 100)}% cache reads)` : "";
    parts.push(`tokens: ${formatTokens(total)}${cache}`);
  }
  if (facts.estimatedCostUSD !== undefined) {
    parts.push(`est. API-equivalent spend: ≈${formatUSD(facts.estimatedCostUSD)}`);
  }
  if (facts.git) {
    const g = facts.git;
    const bits = [
      g.commits > 0 ? `${g.commits} commit(s)` : "",
      g.pushes > 0 ? `${g.pushes} push(es)` : "",
      g.prsMerged > 0 ? `${g.prsMerged} PR(s) merged` : g.prsOpened > 0 ? `${g.prsOpened} PR(s) opened` : "",
    ].filter(Boolean);
    if (bits.length > 0) parts.push(`git: ${bits.join(", ")}`);
  }
  if (facts.subagents !== undefined) parts.push(`subagents: ${facts.subagents}`);
  if (facts.tests) parts.push(`test runs: ${facts.tests.runs} (${facts.tests.failed} failed)`);
  if (facts.rhythm && facts.rhythm.longestPauseSec >= 600) {
    parts.push(`longest pause: ${formatPause(facts.rhythm.longestPauseSec)}`);
  }
  return parts.length > 0 ? `facts: ${parts.join(" | ")}` : "";
}
