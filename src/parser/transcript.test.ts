/**
 * Focused unit tests for parseTranscript against synthetic transcript lines
 * (fixtures/golden covers real sessions end-to-end; these pin specific
 * parser behaviors precisely — assistant-turn dedup, createdFiles detection,
 * and the "unknown event types never crash" contract).
 *
 * Run: node --import tsx --test src/parser/transcript.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseTranscript } from "./transcript.js";

const jsonl = (lines: unknown[]): string => lines.map((l) => JSON.stringify(l)).join("\n");

describe("assistantTurns", () => {
  it("counts one turn per distinct assistant message id", () => {
    const timeline = parseTranscript(
      jsonl([
        { type: "user", message: { content: "fix it" } },
        // Same message id split across two lines (content-block repetition) — one turn.
        { type: "assistant", message: { id: "msg_1", role: "assistant", content: [] } },
        { type: "assistant", message: { id: "msg_1", role: "assistant", content: [] } },
        // A distinct id — a second turn.
        { type: "assistant", message: { id: "msg_2", role: "assistant", content: [] } },
      ]),
    );
    assert.equal(timeline.totals.assistantTurns, 2);
  });

  it("never dedupes a message with no id — always counts", () => {
    const timeline = parseTranscript(
      jsonl([
        { type: "user", message: { content: "fix it" } },
        { type: "assistant", message: { role: "assistant", content: [] } },
        { type: "assistant", message: { role: "assistant", content: [] } },
      ]),
    );
    assert.equal(timeline.totals.assistantTurns, 2);
  });

  it("is 0 for a transcript with no assistant lines", () => {
    const timeline = parseTranscript(jsonl([{ type: "user", message: { content: "fix it" } }]));
    assert.equal(timeline.totals.assistantTurns, 0);
  });
});

describe("createdFiles", () => {
  it("captures a Write tool call's file_path, redacted", () => {
    const timeline = parseTranscript(
      jsonl([
        { type: "user", message: { content: "add a file" } },
        {
          type: "assistant",
          message: {
            id: "msg_1",
            role: "assistant",
            content: [
              { type: "tool_use", id: "tu_1", name: "Write", input: { file_path: "src/new-file.ts", content: "a\nb" } },
            ],
          },
        },
        {
          type: "user",
          message: { content: [{ type: "tool_result", tool_use_id: "tu_1", content: "File created" }] },
          toolUseResult: { filePath: "src/new-file.ts", structuredPatch: [] },
        },
      ]),
    );
    assert.deepEqual(timeline.createdFiles, ["src/new-file.ts"]);
  });

  it("does not count an Edit tool call as a creation", () => {
    const timeline = parseTranscript(
      jsonl([
        { type: "user", message: { content: "fix a file" } },
        {
          type: "assistant",
          message: {
            id: "msg_1",
            role: "assistant",
            content: [
              { type: "tool_use", id: "tu_1", name: "Edit", input: { file_path: "src/existing.ts" } },
            ],
          },
        },
        {
          type: "user",
          message: { content: [{ type: "tool_result", tool_use_id: "tu_1", content: "ok" }] },
          toolUseResult: {
            filePath: "src/existing.ts",
            structuredPatch: [{ lines: ["+new line", "-old line"] }],
          },
        },
      ]),
    );
    assert.deepEqual(timeline.createdFiles, []);
  });

  it("dedupes repeated Write calls on the same path", () => {
    const write = (id: string) => [
      {
        type: "assistant",
        message: {
          id,
          role: "assistant",
          content: [{ type: "tool_use", id: `tu_${id}`, name: "Write", input: { file_path: "src/a.ts", content: "x" } }],
        },
      },
      {
        type: "user",
        message: { content: [{ type: "tool_result", tool_use_id: `tu_${id}`, content: "ok" }] },
        toolUseResult: { filePath: "src/a.ts", structuredPatch: [] },
      },
    ];
    const timeline = parseTranscript(
      jsonl([{ type: "user", message: { content: "go" } }, ...write("msg_1"), ...write("msg_2")]),
    );
    assert.deepEqual(timeline.createdFiles, ["src/a.ts"]);
  });

  it("is empty when the session created nothing", () => {
    const timeline = parseTranscript(jsonl([{ type: "user", message: { content: "just a question" } }]));
    assert.deepEqual(timeline.createdFiles, []);
  });
});

describe("unknown event types", () => {
  it("never crashes and never appears in the timeline", () => {
    const timeline = parseTranscript(
      jsonl([
        { type: "user", message: { content: "hi" } },
        { type: "some-future-event-type", weird: { nested: "payload" } },
        { type: "assistant", message: { id: "msg_1", role: "assistant", content: [] } },
      ]),
    );
    assert.equal(timeline.turns.length, 1);
    assert.equal(timeline.totals.assistantTurns, 1);
  });

  it("skips unparseable lines instead of crashing", () => {
    const timeline = parseTranscript(
      `${JSON.stringify({ type: "user", message: { content: "hi" } })}\nnot json at all\n`,
    );
    assert.equal(timeline.turns.length, 1);
  });
});
