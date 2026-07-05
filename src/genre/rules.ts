/**
 * Genre auto-pick — Layer 1 of genre selection (docs/genre-packs.md):
 * a deterministic rules table over the session's shape, evaluated top-down,
 * first match wins. `--genre` always overrides (Layer 2); the screenwriter
 * suggestion sidecar is a later Layer 2 addition.
 *
 * The table is forward-looking: it names genres that have not shipped yet
 * (horror, heist, nature-doc). compositions.ts maps every pick onto a
 * shipped composition, falling through to classic explicitly. Dormant seam:
 * nothing in the live CLI pipeline calls pickGenre anymore (docs/genre-packs.md).
 */
import type { Timeline } from "../parser/types.js";

export const GENRES = ["classic", "horror", "heist", "nature-doc"] as const;
export type Genre = (typeof GENRES)[number];

export function isGenre(value: string): value is Genre {
  return (GENRES as readonly string[]).includes(value);
}

/**
 * The session fingerprint the rules read. Mostly Timeline.totals, plus the
 * signals the docs table needs that totals alone cannot answer: how the last
 * command ended, and the read/edit tool balance. Build via signalsFrom().
 */
export interface GenreSignals {
  commands: number;
  failedCommands: number;
  filesTouched: number;
  durationSec: number;
  /** Exit state of the session's last command; null when no commands ran. */
  finalCommandGreen: boolean | null;
  readCalls: number;
  editCalls: number;
}

export interface GenrePick {
  genre: Genre;
  /** Human-sized justification, printed by the CLI so the pick is explainable. */
  reason: string;
}

const READ_TOOLS = new Set(["Read", "Grep", "Glob"]);
const EDIT_TOOLS = new Set(["Edit", "Write", "NotebookEdit"]);

/** Rule thresholds — tuned against fixtures/golden (goldens pin every pick). */
const MANY_FAILURES_THRESHOLD = 3;
const NATURE_DOC_MIN_READS = 10;
const NATURE_DOC_READ_EDIT_RATIO = 4;
const NATURE_DOC_MIN_DURATION_SEC = 600;

export function signalsFrom(timeline: Timeline): GenreSignals {
  const lastCommand = timeline.commands[timeline.commands.length - 1];
  return {
    commands: timeline.totals.commands,
    failedCommands: timeline.totals.failedCommands,
    filesTouched: timeline.totals.filesTouched,
    durationSec: timeline.totals.durationSec,
    finalCommandGreen: lastCommand ? lastCommand.exitCode === 0 : null,
    readCalls: timeline.toolCalls.filter((c) => READ_TOOLS.has(c.tool)).length,
    editCalls: timeline.toolCalls.filter((c) => EDIT_TOOLS.has(c.tool)).length,
  };
}

/** The docs table, top-down, first match wins. */
export function pickGenre(signals: GenreSignals): GenrePick {
  const { failedCommands, finalCommandGreen, filesTouched, commands } = signals;

  // finalCommandGreen !== true (not just === false) also catches null — no
  // commands ran at all — under the same "didn't demonstrably go green" umbrella.
  if (failedCommands >= MANY_FAILURES_THRESHOLD && finalCommandGreen !== true) {
    return {
      genre: "horror",
      reason: `${failedCommands} failed commands, never went green`,
    };
  }
  if (failedCommands === 0 && commands > 0 && filesTouched > 0) {
    return {
      genre: "heist",
      reason: `0 failed commands, ${filesTouched} files touched`,
    };
  }
  const readHeavy =
    signals.readCalls >= NATURE_DOC_MIN_READS &&
    (signals.editCalls === 0 ||
      signals.readCalls / signals.editCalls >= NATURE_DOC_READ_EDIT_RATIO);
  if (readHeavy && signals.durationSec >= NATURE_DOC_MIN_DURATION_SEC) {
    return {
      genre: "nature-doc",
      reason: `${signals.readCalls} reads vs ${signals.editCalls} edits over ${Math.round(signals.durationSec / 60)}m`,
    };
  }
  return { genre: "classic", reason: "no strong signal — the reference look" };
}
