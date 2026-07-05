/**
 * Screenplay + Timeline → the `sceneTimes` sidecar: one pre-formatted
 * "HH:MM" (or null) per scene, index-aligned (remotion/src/packs/ClockChip).
 *
 * Times are ANCHORS (docs/v1-storychange.md): a chip must show when that
 * scene's real moment happened, or nothing. So each scene is matched to a
 * turn conservatively — title = session start, stats = session end, action
 * and showcase scenes match their artifact (file basename / command prefix).
 * No match → null → no chip. Never interpolate a plausible-looking time.
 *
 * Formatting is LOCAL time on the machine running the CLI — the session
 * owner's clock, the one they lived the day in. (Compositions can't do
 * this: TZ math in a component would break render determinism.)
 */
import type { Timeline } from "../parser/types.js";
import type { ActionArtifact, Screenplay } from "../screenplay/schema.js";
import { formatClock } from "./time.js";

export { formatClock } from "./time.js";

const basename = (p: string): string => p.split("/").filter(Boolean).pop() ?? p;

export function sceneTimesFor(screenplay: Screenplay, timeline: Timeline): (string | null)[] {
  const turnTime = (turnIndex: number): string | null =>
    formatClock(timeline.turns[turnIndex]?.timestamp);

  const artifactTime = (artifact: ActionArtifact): string | null => {
    if (artifact.kind === "edit") {
      const hit = timeline.diffs.find((d) => basename(d.file) === basename(artifact.file));
      return hit ? turnTime(hit.turnIndex) : null;
    }
    if (artifact.kind === "command") {
      const needle = artifact.command.slice(0, 30);
      const hit = timeline.commands.find((c) => c.command.startsWith(needle));
      return hit ? turnTime(hit.turnIndex) : null;
    }
    if (artifact.kind === "create") {
      // Anchor to the first created file, same basename match as edit.
      const first = artifact.files[0];
      if (!first) return null;
      const hit = timeline.diffs.find((d) => basename(d.file) === basename(first));
      return hit ? turnTime(hit.turnIndex) : null;
    }
    // subagents: no single timeline entry to anchor to.
    return null;
  };

  return screenplay.scenes.map((scene): string | null => {
    switch (scene.type) {
      case "title":
        return formatClock(timeline.sessionMeta.startedAt);
      case "stats":
        return formatClock(timeline.sessionMeta.endedAt);
      case "showcase":
      case "action":
        return artifactTime(scene.artifact);
      case "dialogue":
        // Bubbles are condensed, not traceable to one turn — no chip beats
        // a wrong chip.
        return null;
    }
  });
}
