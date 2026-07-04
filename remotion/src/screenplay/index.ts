/**
 * Renderer-side view of the screenplay IR.
 *
 * Types are derived from the single frozen contract in /src/screenplay/schema.ts
 * via type-only imports (erased at compile time — zod never enters the bundle).
 * If a shape you need is missing there, the schema changes first (with
 * docs/screenplay-format.md, same PR) — never re-mirror types here.
 */
import type {
  Achievement,
  Artifact,
  Emotion,
  Scene,
  SceneType,
  Screenplay,
  ToolEvent,
} from "../../../src/screenplay/schema";

export type { Achievement, Artifact, Emotion, Scene, SceneType, Screenplay, ToolEvent };

export type TitleScene = Extract<Scene, { type: "title" }>;
export type DialogueScene = Extract<Scene, { type: "dialogue" }>;
export type ActionScene = Extract<Scene, { type: "action" }>;
export type ShowcaseScene = Extract<Scene, { type: "showcase" }>;
export type StatsScene = Extract<Scene, { type: "stats" }>;

export type DiffArtifact = Extract<Artifact, { kind: "diff" }>;
export type TestRunArtifact = Extract<Artifact, { kind: "testRun" }>;
export type ScreenshotArtifact = Extract<Artifact, { kind: "screenshot" }>;
