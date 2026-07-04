/**
 * Heuristic screenwriter — deterministic, no LLM. A structural fallback
 * (and pipeline exerciser) that maps the timeline onto the screenplay IR:
 *
 *   first user message → title
 *   tool calls         → one action montage
 *   biggest diff       → showcase
 *   totals             → stats
 *
 * The LLM screenwriter (docs/architecture.md stage 2) replaces this for
 * real narrative work; this one guarantees a valid screenplay for any
 * session with enough footage, and declines when there isn't.
 */
import {
  ScreenplaySchema,
  type Achievement,
  type Screenplay,
  type Scene,
  type ScreenwriterOutput,
  type ToolEvent,
} from "../screenplay/schema.js";
import type { Timeline } from "../parser/types.js";

/** Keep action montages readable: cap the chip stream. */
const MAX_ACTION_EVENTS = 24;
const TARGET_DURATION_SEC = 50;

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

function toToolEvents(timeline: Timeline): ToolEvent[] {
  return timeline.toolCalls.slice(0, MAX_ACTION_EVENTS).map((call) => {
    const event: ToolEvent = { tool: call.tool, summary: clamp(call.summary, 120) };
    if (call.ok !== undefined) event.ok = call.ok;
    return event;
  });
}

function pickAchievements(timeline: Timeline): Achievement[] {
  const achievements: Achievement[] = [];
  if (timeline.totals.failedCommands === 0 && timeline.totals.commands > 0) {
    achievements.push({ id: "clean-run", title: "Clean Run" });
  }
  if (timeline.totals.failedCommands >= 3) {
    achievements.push({ id: "rage-quit-averted", title: "Rage Quit Averted" });
  }
  if (timeline.totals.turns === 1 && timeline.totals.filesTouched > 0) {
    achievements.push({ id: "one-shot-wonder", title: "One-Shot Wonder" });
  }
  const reads = timeline.toolCalls.filter((c) => c.tool === "Read").length;
  if (reads >= 20) {
    achievements.push({ id: "archaeologist", title: "Archaeologist" });
  }
  return achievements;
}

/**
 * Pre-LLM decline: the structural "not enough footage" checks, shared by the
 * heuristic screenwriter and `sessionmovie prompt` (the skill path declines
 * BEFORE the user's session spends effort writing a screenplay).
 */
export function structuralDecline(
  timeline: Timeline,
): { decline: true; reason: string } | null {
  if (timeline.turns.length === 0) {
    return { decline: true, reason: "no user prompt found — nothing to make a movie about" };
  }
  if (timeline.toolCalls.length === 0) {
    return { decline: true, reason: "not enough footage: the session used no tools" };
  }
  return null;
}

/**
 * Build a screenplay from a timeline, or decline when there is not enough
 * footage for a movie (the quality floor is a feature).
 */
export function writeScreenplay(timeline: Timeline): ScreenwriterOutput {
  const declined = structuralDecline(timeline);
  if (declined) return declined;

  const scenes: Array<Scene & { targetSec: number; caption?: string }> = [];
  const biggestDiff = [...timeline.diffs].sort(
    (a, b) => b.added + b.removed - (a.added + a.removed),
  )[0];

  scenes.push({
    type: "title",
    task: clamp(timeline.turns[0]?.userMessage ?? "", 120),
    targetSec: biggestDiff ? 6 : 8,
    caption: "the mission",
  });

  scenes.push({
    type: "action",
    events: toToolEvents(timeline),
    intensity: timeline.toolCalls.length > 8 ? "montage" : "steady",
    targetSec: biggestDiff ? 20 : 26,
    caption: `${timeline.totals.toolCalls} tool calls, ${timeline.totals.filesTouched} files touched`,
  });

  if (biggestDiff) {
    const artifact: Extract<Scene, { type: "showcase" }>["artifact"] = {
      kind: "diff",
      file: biggestDiff.file,
      added: biggestDiff.added,
      removed: biggestDiff.removed,
    };
    if (biggestDiff.snippet) artifact.snippet = biggestDiff.snippet;
    scenes.push({
      type: "showcase",
      artifact,
      verdict: "reveal",
      targetSec: 14,
      caption: `the big one: ${biggestDiff.file.split("/").pop()}`,
    });
  }

  scenes.push({
    type: "stats",
    compressed: {
      realDuration: humanDuration(timeline.totals.durationSec),
      movieDuration: `${TARGET_DURATION_SEC}s`,
    },
    counts: {
      files: timeline.totals.filesTouched,
      added: timeline.totals.added,
      removed: timeline.totals.removed,
      tools: timeline.totals.toolCalls,
    },
    achievements: pickAchievements(timeline),
    targetSec: biggestDiff ? 10 : 16,
  });

  const screenplay: Screenplay = {
    version: 1,
    sessionMeta: {
      ...(timeline.sessionMeta.repo !== undefined && { repo: timeline.sessionMeta.repo }),
      ...(timeline.sessionMeta.startedAt !== undefined && {
        startedAt: timeline.sessionMeta.startedAt,
      }),
    },
    targetDurationSec: TARGET_DURATION_SEC,
    scenes,
  };

  // Self-check at the boundary: never emit an invalid screenplay.
  return ScreenplaySchema.parse(screenplay);
}
