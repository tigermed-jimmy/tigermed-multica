import { describe, expect, it } from "vitest";
import { isEditTool, looksLikeUnifiedDiff } from "./build-timeline";

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
