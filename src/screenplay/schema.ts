/**
 * The screenplay IR — the genre-neutral contract between the Screenwriter
 * and genre packs. See docs/screenplay-format.md (the doc and this file
 * change together, in the same PR, or not at all).
 *
 * v2: artifacts are a single discriminated union (edit | command | create |
 * subagents) shared by action and showcase scenes. Stats carries no numbers —
 * they ride the CLI's facts sidecar instead, so the renderer never derives a
 * number and the LLM never invents one.
 *
 * FROZEN: scene vocabulary and emotion enum are closed. Adding a scene type
 * multiplies work for every genre pack; adding an emotion grows the sprite
 * art budget. Don't.
 */
import { z } from "zod";

export const SCREENPLAY_VERSION = 2 as const;

/** Duration budget tolerance: scene targets must sum to within ±10% of targetDurationSec. */
export const DURATION_TOLERANCE = 0.1;

/** Dialogue lines are condensed, never verbatim. */
export const MAX_DIALOGUE_CHARS = 90;

/** Dialogue line budget across the whole screenplay. */
export const MAX_DIALOGUE_LINES = 6;

export const EmotionSchema = z.enum([
  "neutral",
  "confident",
  "confused",
  "panicking",
  "smug",
  "defeated",
  "celebrating",
]);
export type Emotion = z.infer<typeof EmotionSchema>;

export const LineRangeSchema = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
});
export type LineRange = z.infer<typeof LineRangeSchema>;

export const EditArtifactSchema = z.object({
  kind: z.literal("edit"),
  file: z.string().min(1),
  added: z.number().int().nonnegative(),
  removed: z.number().int().nonnegative(),
  /** Redacted unified-diff excerpt — redacted BEFORE it enters the IR. */
  snippet: z.string().optional(),
  focus: LineRangeSchema.optional(),
});

export const CommandArtifactSchema = z.object({
  kind: z.literal("command"),
  command: z.string().min(1),
  exitCode: z.number().int(),
  summary: z.string().max(200).optional(),
});

export const CreateArtifactSchema = z.object({
  kind: z.literal("create"),
  files: z.array(z.string().min(1)).min(1).max(12),
});

export const SubagentsArtifactSchema = z.object({
  kind: z.literal("subagents"),
  tasks: z.array(z.string().min(1).max(60)).min(1).max(8),
});

export const ActionArtifactSchema = z.discriminatedUnion("kind", [
  EditArtifactSchema,
  CommandArtifactSchema,
  CreateArtifactSchema,
  SubagentsArtifactSchema,
]);
export type ActionArtifact = z.infer<typeof ActionArtifactSchema>;

/** Fields shared by every scene: per-scene duration target and optional editorial caption. */
const sceneBase = {
  targetSec: z.number().positive(),
  /** Editorial caption (text only, never structure). */
  caption: z.string().max(120).optional(),
};

export const TitleSceneSchema = z.object({
  type: z.literal("title"),
  /** The session's mission, one line. */
  headline: z.string().min(1).max(80),
  /** The user's mission, condensed. */
  task: z.string().min(1).max(120),
  ...sceneBase,
});

export const DialogueSceneSchema = z.object({
  type: z.literal("dialogue"),
  lines: z
    .array(
      z.object({
        speaker: z.enum(["user", "claude"]),
        text: z.string().min(1).max(MAX_DIALOGUE_CHARS),
        emotion: EmotionSchema,
      }),
    )
    .min(1),
  ...sceneBase,
});

export const ActionSceneSchema = z.object({
  type: z.literal("action"),
  artifact: ActionArtifactSchema,
  ...sceneBase,
});

export const ShowcaseSceneSchema = z.object({
  type: z.literal("showcase"),
  artifact: ActionArtifactSchema,
  ...sceneBase,
});

export const StatsSceneSchema = z.object({
  type: z.literal("stats"),
  ...sceneBase,
});

export const SceneSchema = z.discriminatedUnion("type", [
  TitleSceneSchema,
  DialogueSceneSchema,
  ActionSceneSchema,
  ShowcaseSceneSchema,
  StatsSceneSchema,
]);
export type Scene = z.infer<typeof SceneSchema>;
export type SceneType = Scene["type"];

export const ScreenplaySchema = z
  .object({
    version: z.literal(SCREENPLAY_VERSION),
    sessionMeta: z.object({
      repo: z.string().optional(),
      startedAt: z.string().optional(),
    }),
    targetDurationSec: z.number().min(45).max(60),
    scenes: z.array(SceneSchema).min(1),
  })
  .superRefine((screenplay, ctx) => {
    const sum = screenplay.scenes.reduce((acc, s) => acc + s.targetSec, 0);
    const tolerance = screenplay.targetDurationSec * DURATION_TOLERANCE;
    if (Math.abs(sum - screenplay.targetDurationSec) > tolerance) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scenes"],
        message: `scene targetSec values sum to ${sum}s, outside ±${tolerance}s of targetDurationSec (${screenplay.targetDurationSec}s)`,
      });
    }

    const dialogueLines = screenplay.scenes.reduce(
      (n, s) => n + (s.type === "dialogue" ? s.lines.length : 0),
      0,
    );
    if (dialogueLines > MAX_DIALOGUE_LINES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scenes"],
        message: `dialogue lines sum to ${dialogueLines}, over the budget of ${MAX_DIALOGUE_LINES}`,
      });
    }
  });
export type Screenplay = z.infer<typeof ScreenplaySchema>;

/**
 * "Not enough footage": the screenwriter returns this instead of a screenplay
 * for sessions without a story (no edits, Q&A-only). Never render a bad movie.
 */
export const DeclineSchema = z.object({
  decline: z.literal(true),
  reason: z.string().min(1),
});
export type Decline = z.infer<typeof DeclineSchema>;

export const ScreenwriterOutputSchema = z.union([ScreenplaySchema, DeclineSchema]);
export type ScreenwriterOutput = z.infer<typeof ScreenwriterOutputSchema>;
