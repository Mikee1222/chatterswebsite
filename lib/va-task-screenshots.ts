import type { PhaseItem } from "@/services/task-phases";

/** Soft target for engagement proof uploads (guideline only, not enforced). */
export const ENGAGEMENT_SCREENSHOT_TARGET = 5;

/** Engagement checklist items that benefit from multiple screenshot proof. */
export function isEngagementScreenshotItem(item: Pick<PhaseItem, "step_type" | "requires_screenshot">): boolean {
  return item.requires_screenshot && item.step_type === "Engagement";
}
