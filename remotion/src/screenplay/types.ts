// Mirrors the frozen screenplay IR contract in docs/screenplay-format.md.
// The renderer consumes an already-validated screenplay; zod validation of
// LLM output happens upstream at the screenwriter boundary, not here.

export type Emotion =
  | "neutral"
  | "confident"
  | "confused"
  | "panicking"
  | "smug"
  | "defeated"
  | "celebrating";

// ToolEvent is sketched but not pinned down in the contract doc; this is the
// minimal shape the classic pack needs. Extend the doc before extending this.
export type ToolEvent = {
  tool: string; // "Read", "Grep", "Bash", "Edit", ...
  detail: string; // "auth.ts", `"session token"`, "npm test → exit 1"
  status?: "ok" | "fail";
};

export type DiffLine = {
  kind: "context" | "removed" | "added";
  text: string;
};

// TODO: the contract allows Diff | TestRun | Screenshot artifacts; only Diff
// is implemented in this bare v0 renderer.
export type Diff = {
  file: string;
  lines: DiffLine[];
};

export type TitleScene = {
  type: "title";
  task: string;
};

export type DialogueScene = {
  type: "dialogue";
  lines: Array<{
    speaker: "user" | "claude";
    text: string; // condensed, <= 90 chars
    emotion: Emotion;
  }>;
};

export type ActionScene = {
  type: "action";
  events: ToolEvent[];
  intensity: "montage" | "steady";
};

export type ShowcaseScene = {
  type: "showcase";
  artifact: Diff;
  verdict: "fail" | "pass" | "reveal";
};

export type StatsScene = {
  type: "stats";
  compressed: { realDuration: string; movieDuration: string };
  counts: { files: number; added: number; removed: number; tools: number };
  achievements: Array<{ title: string }>;
  grade?: string;
};

export type Scene = (
  | TitleScene
  | DialogueScene
  | ActionScene
  | ShowcaseScene
  | StatsScene
) & {
  targetSec: number;
  caption?: string;
};

export type Screenplay = {
  version: 1;
  sessionMeta: { repo?: string; startedAt?: string };
  targetDurationSec: number; // 45–60
  scenes: Scene[];
};
