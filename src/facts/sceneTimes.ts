/**
 * Screenplay + Timeline → the `sceneTimes` sidecar: one pre-formatted
 * "HH:MM" (or null) per scene, index-aligned (remotion/src/packs/ClockChip).
 *
 * Times are ANCHORS (docs/v1-storychange.md): a chip must show when that
 * scene's real moment happened, or nothing. So each scene is matched to a
 * turn conservatively — title = session start, stats = session end,
 * showcases match their artifact (file basename / command prefix), action
 * scenes match an exact tool summary. No match → null → no chip. Never
 * interpolate a plausible-looking time.
 *
 * Formatting is LOCAL time on the machine running the CLI — the session
 * owner's clock, the one they lived the day in. (Compositions can't do
 * this: TZ math in a component would break render determinism.)
 */
import type { Timeline } from "../parser/types.js";
import type { Screenplay } from "../screenplay/schema.js";
import { formatClock } from "./time.js";

export { formatClock } from "./time.js";

const basename = (p: string): string => p.split("/").filter(Boolean).pop() ?? p;

export function sceneTimesFor(screenplay: Screenplay, timeline: Timeline): (string | null)[] {
  const turnTime = (turnIndex: number): string | null =>
    formatClock(timeline.turns[turnIndex]?.timestamp);

  return screenplay.scenes.map((scene): string | null => {
    switch (scene.type) {
      case "title":
        return formatClock(timeline.sessionMeta.startedAt);
      case "stats":
        return formatClock(timeline.sessionMeta.endedAt);
      case "showcase": {
        const artifact = scene.artifact;
        if (artifact.kind === "diff") {
          const hit = timeline.diffs.find((d) => basename(d.file) === basename(artifact.file));
          return hit ? turnTime(hit.turnIndex) : null;
        }
        if (artifact.kind === "testRun") {
          const needle = artifact.command.slice(0, 30);
          const hit = timeline.commands.find((c) => c.command.startsWith(needle));
          return hit ? turnTime(hit.turnIndex) : null;
        }
        return null;
      }
      case "action": {
        for (const event of scene.events) {
          const hit = timeline.toolCalls.find((t) => t.summary === event.summary);
          if (hit) return turnTime(hit.turnIndex);
        }
        return null;
      }
      case "dialogue":
        // Bubbles are condensed, not traceable to one turn — no chip beats
        // a wrong chip.
        return null;
    }
  });
}
