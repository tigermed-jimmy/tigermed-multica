import type { TaskMessagePayload } from "@multica/core/types/events";
import { redactSecrets } from "./redact";

/** A unified timeline entry: tool calls, thinking, text, and errors in chronological order. */
export interface TimelineItem {
  seq: number;
  type: "tool_use" | "tool_result" | "thinking" | "text" | "error";
  tool?: string;
  content?: string;
  input?: Record<string, unknown>;
  output?: string;
}

const EDIT_TOOL_NAMES = new Set([
  "patch_apply",
  "patch",
  "apply_patch",
  "edit",
  "edit_file",
  "write",
  "write_file",
  "multiedit",
  "multi_edit",
  "file_edit",
  "str_replace_editor",
  "insert",
  "replace",
  "file_change",
  "filechange",
]);

function normalizeToolName(tool: string): string {
  return tool
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function isEditTool(tool?: string): boolean {
  if (!tool) return false;
  const normalized = normalizeToolName(tool);
  if (EDIT_TOOL_NAMES.has(normalized)) return true;
  return (
    normalized.includes("edit") ||
    normalized.includes("patch") ||
    normalized.includes("write_file")
  );
}

export function looksLikeUnifiedDiff(output?: string): boolean {
  if (!output) return false;
  let hasOldFileHeader = false;
  let hasNewFileHeader = false;
  let hasHunk = false;
  let hasChangeLine = false;

  for (const line of output.split("\n")) {
    if (line.startsWith("--- ")) hasOldFileHeader = true;
    if (line.startsWith("+++ ")) hasNewFileHeader = true;
    if (line.startsWith("@@ ")) hasHunk = true;
    if ((line.startsWith("+") && !line.startsWith("+++ ")) || (line.startsWith("-") && !line.startsWith("--- "))) {
      hasChangeLine = true;
    }
  }

  if (hasOldFileHeader && hasNewFileHeader) return true;
  return hasChangeLine && hasHunk;
}

/** Build a chronologically ordered timeline from raw task messages. */
export function buildTimeline(msgs: TaskMessagePayload[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const msg of msgs) {
    items.push({
      seq: msg.seq,
      type: msg.type,
      tool: msg.tool,
      content: msg.content ? redactSecrets(msg.content) : msg.content,
      input: msg.input,
      output: msg.output ? redactSecrets(msg.output) : msg.output,
    });
  }
  return items.sort((a, b) => a.seq - b.seq);
}
