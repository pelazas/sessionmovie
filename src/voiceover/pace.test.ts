/**
 * Pure resize/precedence tests for src/voiceover/pace.ts, plus a MOCKED
 * synthesizeDialogue pass (network/ffprobe/disk all injected — no API key,
 * no real synthesis; the real-API path is manual/end-to-end acceptance
 * only, run separately when ELEVENLABS_API_KEY is available). Mirrors
 * src/quantize.test.ts: build a valid screenplay fixture, feed it through
 * the pure function, assert on the result.
 *
 * Run: node --import tsx --test src/voiceover/pace.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ScreenplaySchema, type Screenplay } from "../screenplay/schema.js";
import { DEFAULT_VOICE_ID } from "./tts.js";
import type { VoiceoverLineCue } from "./types.js";
import { resizeDialogueToVoiceover, synthesizeDialogue, voiceForSpeaker } from "./pace.js";

const FLOORS: Record<string, number> = { title: 3, action: 5, showcase: 4, stats: 4 };

/** A dialogue line cue with a synthetic measured duration — synth() itself
 * is network, exercised end-to-end/manually, never in this file. */
function lineCue(sceneIndex: number, lineIndex: number, durationSec: number): VoiceoverLineCue {
  return {
    sceneIndex, lineIndex, speaker: lineIndex % 2 === 0 ? "user" : "claude",
    text: `line ${lineIndex}`, file: `voiceover-cache/${sceneIndex}-${lineIndex}.mp3`,
    durationSec, timestampsFile: `voiceover-cache/${sceneIndex}-${lineIndex}.timestamps.json`,
    words: [],
  };
}

/** title(3) + dialogue(nLines lines, targetSec ignored by resize) + N action(5
 * each) + showcase(4) + stats(4) — a fixed non-dialogue floor of 21 for N=2,
 * one dialogue scene at index 1. Fixtures must be valid input. */
function screenplayWith(nLines: number, targetDurationSec: number, actionCount = 2): Screenplay {
  const lines = Array.from({ length: nLines }, (_, i) => ({
    speaker: (i % 2 === 0 ? "user" : "claude") as "user" | "claude",
    text: `line ${i}`,
    emotion: "neutral" as const,
  }));
  const actions = Array.from({ length: actionCount }, () => ({
    type: "action" as const,
    artifact: { kind: "command" as const, command: "npm test", exitCode: 0 },
    targetSec: 5,
  }));
  return ScreenplaySchema.parse({
    version: 2,
    sessionMeta: {},
    targetDurationSec,
    scenes: [
      { type: "title", headline: "h", task: "t", targetSec: 3 },
      { type: "dialogue", lines, targetSec: 3 },
      ...actions,
      { type: "showcase", artifact: { kind: "command", command: "npm test", exitCode: 0 }, targetSec: 4 },
      { type: "stats", targetSec: targetDurationSec - 3 - 3 - actionCount * 5 - 4 },
    ],
  });
}

describe("resizeDialogueToVoiceover", () => {
  it("fits case: dialogue locks to measured audio, the rest renormalizes to hold the total", () => {
    const screenplay = screenplayWith(2, 50);
    const cues = [lineCue(1, 0, 2), lineCue(1, 1, 1.5)];
    const result = resizeDialogueToVoiceover(screenplay, cues);
    assert.equal(result.ok, true);
    assert.equal(result.droppedLines, 0);
    assert.equal(result.lineCues.length, 2);

    const dialogueNeed = 2 + 1.5 + 0.35 * 1 + 0.75 + 0.75; // 5.35s
    const dialogueScene = result.screenplay.scenes[1];
    assert.equal(dialogueScene?.type, "dialogue");
    assert.equal(dialogueScene?.targetSec, Math.round(dialogueNeed * 100) / 100);
  });

  it("9s overflow: drops TRAILING lines until the scene fits D_MAX, bubbles still show for the rest", () => {
    const screenplay = screenplayWith(5, 50);
    // 5 lines × 2s: need 10 + 0.35×4 + 1.5 = 12.9s — over the 9s cap twice over.
    const cues = [0, 1, 2, 3, 4].map((i) => lineCue(1, i, 2));
    const result = resizeDialogueToVoiceover(screenplay, cues);
    assert.equal(result.ok, true);
    assert.equal(result.droppedLines, 2); // 5 lines -> 4 (12.9-2=10.55, still over) -> 3 (8.2, fits)
    assert.equal(result.lineCues.length, 3);
    assert.deepEqual(result.lineCues.map((c) => c.lineIndex), [0, 1, 2]);

    const dialogueScene = result.screenplay.scenes[1];
    assert.equal(dialogueScene?.type, "dialogue");
    assert.ok((dialogueScene?.targetSec ?? 0) <= 9);
  });

  it("budget-infeasible: floors alone exceed what's left after the dialogue lock — ok:false, screenplay unchanged", () => {
    // 6 action scenes @ floor 5 + title@3 + showcase@4 + stats@4 = 41 floor,
    // but only a 45s target minus ~7.85s of dialogue leaves 37.15s — infeasible.
    const screenplay = screenplayWith(2, 45, 6);
    const cues = [lineCue(1, 0, 3), lineCue(1, 1, 3)];
    const result = resizeDialogueToVoiceover(screenplay, cues);
    assert.equal(result.ok, false);
    assert.deepEqual(result.screenplay, screenplay); // untouched on infeasibility
  });

  it("invariant: a successful resize sums back to the target and never breaks a floor", () => {
    const screenplay = screenplayWith(2, 50);
    const cues = [lineCue(1, 0, 2), lineCue(1, 1, 1.5)];
    const result = resizeDialogueToVoiceover(screenplay, cues);
    assert.equal(result.ok, true);

    const sum = result.screenplay.scenes.reduce((acc, s) => acc + s.targetSec, 0);
    const tol = result.screenplay.targetDurationSec * 0.1;
    assert.ok(
      Math.abs(sum - result.screenplay.targetDurationSec) <= tol,
      `sum ${sum} not within ${tol}s of ${result.screenplay.targetDurationSec}`,
    );
    for (const scene of result.screenplay.scenes) {
      if (scene.type === "dialogue") continue;
      const floor = FLOORS[scene.type] ?? 3;
      assert.ok(scene.targetSec >= floor - 1e-6, `${scene.type} targetSec ${scene.targetSec} below its floor ${floor}`);
    }
    // Re-validating with the frozen schema is itself part of the contract —
    // resizeDialogueToVoiceover already does this internally (ok:false on
    // failure), but assert it holds for the returned screenplay too.
    assert.equal(ScreenplaySchema.safeParse(result.screenplay).success, true);
  });
});

describe("voiceForSpeaker", () => {
  it("falls back to the default narrator with no env", () => {
    assert.equal(voiceForSpeaker("user", {}), DEFAULT_VOICE_ID);
    assert.equal(voiceForSpeaker("claude", {}), DEFAULT_VOICE_ID);
  });

  it("ELEVENLABS_VOICE_ID overrides the default for both speakers", () => {
    const env = { ELEVENLABS_VOICE_ID: "v-all" };
    assert.equal(voiceForSpeaker("user", env), "v-all");
    assert.equal(voiceForSpeaker("claude", env), "v-all");
  });

  it("ELEVENLABS_VOICE_USER/_CLAUDE win over ELEVENLABS_VOICE_ID for their own speaker only", () => {
    const env = { ELEVENLABS_VOICE_ID: "v-all", ELEVENLABS_VOICE_USER: "v-user" };
    assert.equal(voiceForSpeaker("user", env), "v-user");
    assert.equal(voiceForSpeaker("claude", env), "v-all"); // no override — falls back to VOICE_ID
  });
});

const CONFIG = {
  apiKey: "test-key-never-real", voiceId: "unused-base",
  model: "model-a", settings: { stability: 0.5, similarity_boost: 0.75 },
};

describe("synthesizeDialogue (MOCKED — no network, no API key; the real path is manual end-to-end)", () => {
  it("synthesizes every dialogue line, per speaker voice, skipping every other scene type", async () => {
    const screenplay = screenplayWith(2, 50); // title, dialogue(2 lines), 2×action, showcase, stats
    const voicesUsed: string[] = [];
    const result = await synthesizeDialogue(screenplay, CONFIG, {
      env: { ELEVENLABS_VOICE_USER: "v-user", ELEVENLABS_VOICE_CLAUDE: "v-claude" },
      synthesizeCue: async (text, cfg) => {
        voicesUsed.push(cfg.voiceId);
        return {
          absolutePath: `/tmp/${text.length}.mp3`,
          publicPath: `voiceover-cache/${text.length}.mp3`,
          timestampsPath: `/tmp/${text.length}.timestamps.json`,
          timestampsPublicPath: `voiceover-cache/${text.length}.timestamps.json`,
          apiCalled: true,
        };
      },
      probe: () => 1.5,
      readAlignment: () => null,
    });
    assert.equal(result.lineCues.length, 2); // only the dialogue scene's 2 lines — no other scene type
    assert.equal(result.apiCalls, 2);
    assert.equal(result.cacheHits, 0);
    assert.deepEqual(voicesUsed, ["v-user", "v-claude"]); // line 0 = user, line 1 = claude
    assert.equal(result.lineCues[0]?.sceneIndex, 1); // the dialogue scene's index in screenplayWith
    assert.deepEqual(result.lineCues.map((c) => c.durationSec), [1.5, 1.5]);
  });

  it("full mocked pipeline (synth -> resize) end to end: a resizable screenplay comes out ok:true", async () => {
    const screenplay = screenplayWith(2, 50);
    const synth = await synthesizeDialogue(screenplay, CONFIG, {
      synthesizeCue: async (text) => ({
        absolutePath: `/tmp/${text.length}.mp3`,
        publicPath: `voiceover-cache/${text.length}.mp3`,
        timestampsPath: `/tmp/${text.length}.timestamps.json`,
        timestampsPublicPath: `voiceover-cache/${text.length}.timestamps.json`,
        apiCalled: false,
      }),
      probe: () => 2,
      readAlignment: () => null,
    });
    const resized = resizeDialogueToVoiceover(screenplay, synth.lineCues);
    assert.equal(resized.ok, true);
    assert.equal(resized.droppedLines, 0);
    const dialogueScene = resized.screenplay.scenes[1];
    assert.equal(dialogueScene?.type, "dialogue");
    // 2 lines × 2s + 1 gap(0.35) + lead(0.75) + tail(0.75) = 5.85s
    assert.equal(dialogueScene?.targetSec, 5.85);
  });
});
