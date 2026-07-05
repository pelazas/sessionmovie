/**
 * Golden snapshot shape shared by the generator (update-golden.ts) and the
 * test (golden.test.ts): for each fixture, what the parse+screenwrite
 * pipeline produced — scene structure and timeline totals, or the decline.
 */
import { readFileSync } from "node:fs";
import { parseTranscript } from "../src/parser/index.js";
import { writeScreenplay } from "../src/screenwriter/heuristic.js";

export interface GoldenSnapshot {
  fixture: string;
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
  // below are the stable, structural facts. assistantTurns is stable too, but
  // PR-G scoped its own coverage to src/parser/transcript.test.ts rather than
  // regenerating every golden fixture for a field the golden snapshot doesn't
  // otherwise need — pulled out here so the golden corpus stays untouched.
  const { durationSec: _ignored, assistantTurns: _ignoredAssistantTurns, ...stableTotals } = timeline.totals;
  return {
    fixture: fixtureName,
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
