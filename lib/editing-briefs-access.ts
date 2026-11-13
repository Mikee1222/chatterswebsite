import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import type { BriefActorCapability } from "@/lib/brief-status-transitions";
import type { AuthUser } from "@/lib/auth-config";

export async function getEditingBriefCapabilities(
  session: AuthUser,
): Promise<BriefActorCapability[]> {
  const caps: BriefActorCapability[] = [];
  if (await hasPermission(session, PERMISSIONS.EDITING_BRIEFS_MANAGE)) caps.push("manage");
  if (await hasPermission(session, PERMISSIONS.EDITING_BRIEFS_VIEW_ASSIGNED))
    caps.push("view_assigned");
  if (await hasPermission(session, PERMISSIONS.EDITING_BRIEFS_REVIEW)) caps.push("review");
  if (await hasPermission(session, PERMISSIONS.EDITING_BRIEFS_VIEW_ALL)) caps.push("view_all");
  return caps;
}

export function canAccessEditingBrief(
  caps: BriefActorCapability[],
  assignedEditorId: string,
  sessionUserId: string,
): boolean {
  if (caps.includes("manage") || caps.includes("view_all") || caps.includes("review")) {
    return true;
  }
  if (caps.includes("view_assigned")) {
    return assignedEditorId.trim() === sessionUserId.trim();
  }
  return false;
}

export function sessionUserIds(session: AuthUser): string[] {
  const ids = [session.id, session.airtableUserId].filter(Boolean) as string[];
  return [...new Set(ids.map((x) => x.trim()).filter(Boolean))];
}

/**
 * The editor assigned to the bunch a brief belongs to may VIEW the full brief, even when the
 * brief's own assigned_editor_id is someone else (they work the bunch from the Editor tab).
 * Read-only: this never grants a status transition — those stay with the brief's own assigned
 * editor / manage / review. `bunchEditorId` is resolved by the caller (page or GET route) via
 * getBunchEditorIdForWinnerVideo, and is compared against every session identity id (Supabase
 * uuid and Airtable id), exactly like canAccessEditingBrief, so it matches whichever form the
 * bunch stores. Both the page and the read API call this, so their authorization cannot drift.
 */
export function canViewEditingBriefAsBunchEditor(
  caps: BriefActorCapability[],
  userIds: string[],
  bunchEditorId: string | null,
): boolean {
  if (!caps.includes("view_assigned") || !bunchEditorId) return false;
  const target = bunchEditorId.trim();
  if (!target) return false;
  return userIds.some((uid) => uid.trim() === target);
}
