/**
 * The screenplay IR — the genre-neutral contract between the Screenwriter
 * and genre packs. See docs/screenplay-format.md (the doc and this file
 * change together, in the same PR, or not at all).
 *
 * FROZEN: scene vocabulary and emotion enum are closed. Adding a scene type
 * multiplies work for every genre pack; adding an emotion grows the sprite
 * art budget. Don't.
 */
import { z } from "zod";

export const SCREENPLAY_VERSION = 1 as const;

/** Duration budget tolerance: scene targets must sum to within ±10% of targetDurationSec. */
export const DURATION_TOLERANCE = 0.1;

/** Dialogue lines are condensed, never verbatim. */
export const MAX_DIALOGUE_CHARS = 90;

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

export const ToolEventSchema = z.object({
  tool: z.string().min(1),
  /** One-line human summary, e.g. `Read auth.ts`, `npm test → exit 1`. */
  summary: z.string().min(1).max(120),
  /** false for failed commands / errored tool calls; omitted when unknown. */
  ok: z.boolean().optional(),
});
export type ToolEvent = z.infer<typeof ToolEventSchema>;

export const LineRangeSchema = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
});
export type LineRange = z.infer<typeof LineRangeSchema>;

export const DiffArtifactSchema = z.object({
  kind: z.literal("diff"),
  file: z.string().min(1),
  added: z.number().int().nonnegative(),
  removed: z.number().int().nonnegative(),
  /** Redacted excerpt of the diff, unified-format lines. */
  snippet: z.string().optional(),
});

export const TestRunArtifactSchema = z.object({
  kind: z.literal("testRun"),
  command: z.string().min(1),
  exitCode: z.number().int(),
  summary: z.string().max(200).optional(),
});

export const ScreenshotArtifactSchema = z.object({
  kind: z.literal("screenshot"),
  path: z.string().min(1),
});

export const ArtifactSchema = z.discriminatedUnion("kind", [
  DiffArtifactSchema,
  TestRunArtifactSchema,
  ScreenshotArtifactSchema,
]);
export type Artifact = z.infer<typeof ArtifactSchema>;

/** Reference to the most dramatic moment, shown before the title card. */
export const ShowcaseRefSchema = z.object({
  description: z.string().min(1).max(120),
});
export type ShowcaseRef = z.infer<typeof ShowcaseRefSchema>;

export const AchievementSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(60),
});
export type Achievement = z.infer<typeof AchievementSchema>;

/** Fields shared by every scene: per-scene duration target and optional editorial caption. */
const sceneBase = {
  targetSec: z.number().positive(),
  /** Editorial caption; the punch-up pass may rewrite it (text only, never structure). */
  caption: z.string().max(120).optional(),
};

export const TitleSceneSchema = z.object({
  type: z.literal("title"),
  /** The user's mission, condensed. */
  task: z.string().min(1).max(120),
  coldOpen: ShowcaseRefSchema.optional(),
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
  events: z.array(ToolEventSchema).min(1),
  /** montage = hyper-speed, beat-synced. */
  intensity: z.enum(["montage", "steady"]),
  ...sceneBase,
});

export const ShowcaseSceneSchema = z.object({
  type: z.literal("showcase"),
  artifact: ArtifactSchema,
  verdict: z.enum(["fail", "pass", "reveal"]),
  /** The lines to enlarge in slow-mo. */
  focus: LineRangeSchema.optional(),
  ...sceneBase,
});

export const StatsSceneSchema = z.object({
  type: z.literal("stats"),
  compressed: z.object({
    realDuration: z.string().min(1),
    movieDuration: z.string().min(1),
  }),
  counts: z.object({
    files: z.number().int().nonnegative(),
    added: z.number().int().nonnegative(),
    removed: z.number().int().nonnegative(),
    tools: z.number().int().nonnegative(),
  }),
  achievements: z.array(AchievementSchema),
  /** Slightly judgmental, deliberately. */
  grade: z.string().max(3).optional(),
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
