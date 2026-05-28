import { describe, expect, it } from "vitest";
import type { TaskMessagePayload } from "@multica/core/types/events";
import {
  appendTimelineItem,
  buildTimeline,
  coalesceTimelineItems,
  isEditTool,
  looksLikeUnifiedDiff,
  type TimelineItem,
} from "./build-timeline";

function message(seq: number, type: TaskMessagePayload["type"], content?: string): TaskMessagePayload {
  return {
    task_id: "task-1",
    issue_id: "issue-1",
    seq,
    type,
    content,
  };
}

describe("isEditTool", () => {
  it("recognizes common edit tool names across backends", () => {
    expect(isEditTool("patch_apply")).toBe(true);
    expect(isEditTool("edit_file")).toBe(true);
    expect(isEditTool("file_edit")).toBe(true);
    expect(isEditTool("MultiEdit")).toBe(true);
    expect(isEditTool("Write File")).toBe(true);
  });

  it("does not classify non-edit tools as edit tools", () => {
    expect(isEditTool("exec_command")).toBe(false);
    expect(isEditTool("terminal")).toBe(false);
    expect(isEditTool("search_files")).toBe(false);
    expect(isEditTool(undefined)).toBe(false);
  });
});

describe("looksLikeUnifiedDiff", () => {
  it("returns true for valid unified diff text", () => {
    const diff = [
      "--- a/file.txt",
      "+++ b/file.txt",
      "@@ -1 +1 @@",
      "-old line",
      "+new line",
    ].join("\n");
    expect(looksLikeUnifiedDiff(diff)).toBe(true);
  });

  it("returns true for new-file style diff headers without hunks", () => {
    const headerOnly = [
      "--- src/new-file.ts",
      "+++ src/new-file.ts",
      "(new file, 42 bytes)",
    ].join("\n");
    expect(looksLikeUnifiedDiff(headerOnly)).toBe(true);
  });

  it("returns false for non-diff text", () => {
    expect(looksLikeUnifiedDiff("plain output")).toBe(false);
    expect(looksLikeUnifiedDiff("")).toBe(false);
    expect(looksLikeUnifiedDiff(undefined)).toBe(false);
  });
});

describe("task transcript timeline", () => {
  it("merges adjacent text and thinking fragments split by streaming flushes", () => {
    const items = buildTimeline([
      message(2, "text", "world"),
      message(1, "text", "hello "),
      message(3, "thinking", "step "),
      message(4, "thinking", "one"),
    ]);

    expect(items).toEqual([
      expect.objectContaining({ seq: 1, type: "text", content: "hello world" }),
      expect.objectContaining({ seq: 3, type: "thinking", content: "step one" }),
    ]);
  });

  it("does not merge across tool or error boundaries", () => {
    const items = coalesceTimelineItems([
      { seq: 1, type: "text", content: "before" },
      { seq: 2, type: "tool_use", tool: "bash" },
      { seq: 3, type: "text", content: "after" },
      { seq: 4, type: "error", content: "failed" },
      { seq: 5, type: "text", content: "done" },
    ]);

    expect(items.map((item) => item.content ?? item.tool)).toEqual([
      "before",
      "bash",
      "after",
      "failed",
      "done",
    ]);
  });

  it("coalesces newly appended live text with the previous text item", () => {
    const existing: TimelineItem[] = [{ seq: 1, type: "text", content: "hello" }];
    const items = appendTimelineItem(existing, { seq: 2, type: "text", content: " world" });

    expect(items).toEqual([
      expect.objectContaining({ seq: 1, type: "text", content: "hello world" }),
    ]);
  });

  it("coalesces out-of-order raw text by sequence", () => {
    const existing: TimelineItem[] = [
      { seq: 1, type: "text", content: "A" },
      { seq: 3, type: "text", content: "C" },
    ];
    const items = appendTimelineItem(existing, { seq: 2, type: "text", content: "B" });

    expect(items).toEqual([
      expect.objectContaining({ seq: 1, type: "text", content: "ABC" }),
    ]);
  });

  it("redacts secrets after adjacent chunks are coalesced", () => {
    const items = buildTimeline([
      message(1, "text", "Authorization: Bearer abc123xyz."),
      message(2, "text", "def456"),
    ]);

    expect(items[0]?.content).toBe("Authorization: Bearer [REDACTED]");
    expect(items[0]?.content).not.toContain("abc123xyz");
    expect(items[0]?.content).not.toContain("def456");
  });
});
