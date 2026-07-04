/**
 * Golden snapshot shape shared by the generator (update-golden.ts) and the
 * test (golden.test.ts): for each fixture, what the parse+screenwrite
 * pipeline produced — scene structure and timeline totals, or the decline.
 */
import { readFileSync } from "node:fs";
import { pickGenre, signalsFrom, type Genre } from "../src/genre/rules.js";
import { parseTranscript } from "../src/parser/index.js";
import { writeScreenplay } from "../src/screenwriter/heuristic.js";

export interface GoldenSnapshot {
  fixture: string;
  /** Layer-1 auto-pick (src/genre/rules.ts) — pins the rules table per fixture,
   * so a rules change shows up as a reviewed golden diff. */
  autoGenre: Genre;
  totals: {
    turns: number;
    toolCalls: number;
    filesTouched: number;
    added: number;
    removed: number;
    commands: number;
    failedCommands: number;
  };
  result:
    | { kind: "screenplay"; sceneCount: number; sceneTypes: string[]; targetDurationSec: number }
    | { kind: "decline"; reason: string };
}

export function snapshotFixture(fixturePath: string, fixtureName: string): GoldenSnapshot {
  const timeline = parseTranscript(readFileSync(fixturePath, "utf8"));
  const output = writeScreenplay(timeline);
  // durationSec depends on wall-clock timestamps — meaningful but noisy; totals
  // below are the stable, structural facts.
  const { durationSec: _ignored, ...stableTotals } = timeline.totals;
  return {
    fixture: fixtureName,
    autoGenre: pickGenre(signalsFrom(timeline)).genre,
    totals: stableTotals,
    result:
      "decline" in output
        ? { kind: "decline", reason: output.reason }
        : {
            kind: "screenplay",
            sceneCount: output.scenes.length,
            sceneTypes: output.scenes.map((s) => s.type),
            targetDurationSec: output.targetDurationSec,
          },
  };
}
