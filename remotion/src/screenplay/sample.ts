import type { Screenplay } from "./types";

// NOTE: the task spec names fixtures/screenplays/sample.json as the frozen
// input, but that file does not exist in the repo yet (main is docs-only).
// This is a stand-in that conforms to docs/screenplay-format.md; swap it for
// an import of the real fixture when it lands.
export const sampleScreenplay: Screenplay = {
  version: 1,
  sessionMeta: { repo: "acme/checkout", startedAt: "2026-06-30T14:02:00Z" },
  targetDurationSec: 45,
  scenes: [
    {
      type: "title",
      task: "fix the flaky session-token test before the demo",
      targetSec: 6,
      caption: "one test. two hours. no pressure.",
    },
    {
      type: "action",
      intensity: "montage",
      targetSec: 12,
      caption: "turn 3 — reading everything that has ever mentioned a token",
      events: [
        { tool: "Read", detail: "auth.ts" },
        { tool: "Grep", detail: '"session token"' },
        { tool: "Read", detail: "session.ts" },
        { tool: "Bash", detail: "npm test → exit 1", status: "fail" },
        { tool: "Read", detail: "token-cache.ts" },
        { tool: "Grep", detail: '"expiresAt"' },
        { tool: "Read", detail: "clock.ts" },
        { tool: "Edit", detail: "session.ts" },
        { tool: "Bash", detail: "npm test → exit 1", status: "fail" },
        { tool: "Read", detail: "test/session.test.ts" },
        { tool: "Grep", detail: '"Date.now"' },
        { tool: "Read", detail: "fake-timers.ts" },
        { tool: "Edit", detail: "token-cache.ts" },
        { tool: "Bash", detail: "npm test → ok", status: "ok" },
      ],
    },
    {
      type: "showcase",
      verdict: "pass",
      targetSec: 15,
      caption: "turn 23 — the cache trusted the wall clock",
      artifact: {
        file: "src/token-cache.ts",
        lines: [
          { kind: "context", text: "export function isFresh(token: CachedToken): boolean {" },
          { kind: "removed", text: "  // expiry checked against real time — flaky under fake timers" },
          { kind: "removed", text: "  return token.expiresAt > Date.now();" },
          { kind: "added", text: "  // expiry checked against the injected clock, testable" },
          { kind: "added", text: "  return token.expiresAt > clock.now();" },
          { kind: "added", text: "  // clock defaults to system time in production" },
          { kind: "context", text: "}" },
        ],
      },
    },
    {
      type: "stats",
      targetSec: 12,
      caption: "made with sessionmovie",
      compressed: { realDuration: "2h 14m", movieDuration: "45s" },
      counts: { files: 7, added: 412, removed: 118, tools: 63 },
      achievements: [
        { title: "Archaeologist" },
        { title: "Rage Quit Averted" },
      ],
      grade: "B+",
    },
  ],
};
