import type { PhaseItem } from "@/services/task-phases";
import {
  CHATTER_ATTACHMENT_MAX_BYTES,
  CHATTER_ATTACHMENT_MAX_MB,
} from "@/lib/chatter-attachment-constants";

/** Soft target for engagement proof uploads (guideline only, not enforced). */
export const ENGAGEMENT_SCREENSHOT_TARGET = 5;

/** Per-file cap for VA checklist screenshot proof (same as Rebills/Tips). */
export const VA_TASK_SCREENSHOT_MAX_BYTES = CHATTER_ATTACHMENT_MAX_BYTES;
export const VA_TASK_SCREENSHOT_MAX_MB = CHATTER_ATTACHMENT_MAX_MB;

/** Engagement checklist items that benefit from multiple screenshot proof. */
export function isEngagementScreenshotItem(item: Pick<PhaseItem, "step_type" | "requires_screenshot">): boolean {
  return item.requires_screenshot && item.step_type === "Engagement";
}

/** Returns a clear per-file error, or null if the file is acceptable. */
export function vaTaskScreenshotFileError(file: File): string | null {
  if (file.size <= 0) return "Screenshot file is empty.";
  if (file.size > VA_TASK_SCREENSHOT_MAX_BYTES) {
    const label = file.name?.trim() || "Screenshot";
    return `"${label}" must be under ${VA_TASK_SCREENSHOT_MAX_MB}MB.`;
  }
  const mime = file.type || "";
  if (mime && !mime.startsWith("image/")) {
    return "Screenshot must be an image file.";
  }
  return null;
}
