/**
 * Renderer-side view of the screenplay IR.
 *
 * Types are derived from the single frozen contract in /src/screenplay/schema.ts
 * via type-only imports (erased at compile time — zod never enters the bundle).
 * If a shape you need is missing there, the schema changes first (with
 * docs/screenplay-format.md, same PR) — never re-mirror types here.
 */
import type {
  ActionArtifact,
  Emotion,
  Scene,
  SceneType,
  Screenplay,
} from "../../../src/screenplay/schema";

export type { ActionArtifact, Emotion, Scene, SceneType, Screenplay };

export type TitleScene = Extract<Scene, { type: "title" }>;
export type DialogueScene = Extract<Scene, { type: "dialogue" }>;
export type ActionScene = Extract<Scene, { type: "action" }>;
export type ShowcaseScene = Extract<Scene, { type: "showcase" }>;
export type StatsScene = Extract<Scene, { type: "stats" }>;

export type EditArtifact = Extract<ActionArtifact, { kind: "edit" }>;
export type CommandArtifact = Extract<ActionArtifact, { kind: "command" }>;
export type CreateArtifact = Extract<ActionArtifact, { kind: "create" }>;
export type SubagentsArtifact = Extract<ActionArtifact, { kind: "subagents" }>;
