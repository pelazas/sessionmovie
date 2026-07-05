/**
 * Heuristic screenwriter — deterministic, no LLM. A structural fallback
 * (and pipeline exerciser) that maps the timeline onto the screenplay IR:
 *
 *   first user message          → title + one dialogue line
 *   diffs / commands / subagents → one real artifact per action scene
 *   biggest edit (≥2 edits)      → showcase
 *
 * Stats numbers ride the CLI facts sidecar — this screenwriter never
 * invents them, so the stats scene here is bare.
 *
 * The LLM screenwriter (docs/architecture.md stage 2) replaces this for
 * real narrative work; this one guarantees a valid screenplay for any
 * session with enough footage, and declines when there isn't.
 */
import {
  ScreenplaySchema,
  type ActionArtifact,
  type Screenplay,
  type Scene,
  type ScreenwriterOutput,
} from "../screenplay/schema.js";
import type { Timeline } from "../parser/types.js";

/** Tool names that spawn subagents in Claude Code transcripts (mirrors facts.ts). */
const SUBAGENT_TOOLS = new Set(["Task", "Agent"]);

const TARGET_DURATION_SEC = 50;

function clamp(text: string, max: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length <= max ? collapsed : `${collapsed.slice(0, max - 1)}…`;
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

/** Real, truthfully-sourced action artifacts: edits (biggest first), then one command, then one subagents summary. */
function buildArtifactPool(timeline: Timeline): ActionArtifact[] {
  const edits: ActionArtifact[] = [...timeline.diffs]
    .sort((a, b) => b.added + b.removed - (a.added + a.removed))
    .map((diff) => ({
      kind: "edit" as const,
      file: diff.file,
      added: diff.added,
      removed: diff.removed,
      ...(diff.snippet !== undefined && { snippet: diff.snippet }),
    }));

  const failedCommand = timeline.commands.find((c) => c.exitCode !== 0);
  const command = failedCommand ?? timeline.commands[timeline.commands.length - 1];
  const commands: ActionArtifact[] = command
    ? [{ kind: "command", command: command.command, exitCode: command.exitCode }]
    : [];

  const subagentSummaries = timeline.toolCalls
    .filter((c) => SUBAGENT_TOOLS.has(c.tool))
    .map((c) => clamp(c.summary, 60));
  const subagents: ActionArtifact[] =
    subagentSummaries.length > 0 ? [{ kind: "subagents", tasks: subagentSummaries.slice(0, 8) }] : [];

  return [...edits, ...commands, ...subagents];
}

interface DurationPlan {
  title: number;
  dialogue: number;
  /** One entry per action scene, always exactly actionCount long. */
  action: number[];
  showcase?: number;
  stats: number;
}

/** Fixed per-branch tables; each sums to exactly TARGET_DURATION_SEC. */
function pickDurations(hasShowcase: boolean, actionCount: number): DurationPlan {
  if (hasShowcase) {
    switch (actionCount) {
      case 1:
        return { title: 5, dialogue: 6, action: [20], showcase: 10, stats: 9 };
      case 2:
        return { title: 5, dialogue: 6, action: [12, 12], showcase: 9, stats: 6 };
      default:
        return { title: 5, dialogue: 5, action: [9, 9, 9], showcase: 8, stats: 5 };
    }
  }
  switch (actionCount) {
    case 1:
      return { title: 6, dialogue: 7, action: [26], stats: 11 };
    case 2:
      return { title: 6, dialogue: 6, action: [14, 14], stats: 10 };
    default:
      return { title: 6, dialogue: 5, action: [10, 10, 10], stats: 9 };
  }
}

/**
 * Build a screenplay from a timeline, or decline when there is not enough
 * footage for a movie (the quality floor is a feature).
 */
export function writeScreenplay(timeline: Timeline): ScreenwriterOutput {
  const declined = structuralDecline(timeline);
  if (declined) return declined;

  const firstUserMessage = timeline.turns[0]?.userMessage ?? "";
  const editCount = timeline.diffs.length;
  const pool = buildArtifactPool(timeline);

  // Showcase takes the biggest edit (pool[0], edits sort biggest-first and
  // lead the pool); action scenes take the rest.
  const showcaseArtifact = editCount >= 2 ? pool[0] : undefined;
  const remainingPool = showcaseArtifact ? pool.slice(1) : pool;

  if (remainingPool.length === 0) {
    return { decline: true, reason: "not enough footage: no edits, commands, or subagents to show" };
  }

  const actionCount = Math.min(3, remainingPool.length);
  const actionArtifacts = remainingPool.slice(0, actionCount);
  const durations = pickDurations(showcaseArtifact !== undefined, actionCount);

  const scenes: Scene[] = [];

  scenes.push({
    type: "title",
    headline: clamp(firstUserMessage, 80),
    task: clamp(firstUserMessage, 120),
    targetSec: durations.title,
    caption: "the mission",
  });

  scenes.push({
    type: "dialogue",
    lines: [{ speaker: "user", text: clamp(firstUserMessage, 90), emotion: "neutral" }],
    targetSec: durations.dialogue,
  });

  // durations.action always has exactly actionCount entries (pickDurations' invariant).
  actionArtifacts.forEach((artifact, i) => {
    scenes.push({ type: "action", artifact, targetSec: durations.action[i] as number });
  });

  if (showcaseArtifact) {
    scenes.push({ type: "showcase", artifact: showcaseArtifact, targetSec: durations.showcase as number });
  }

  scenes.push({ type: "stats", targetSec: durations.stats });

  const screenplay: Screenplay = {
    version: 2,
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
