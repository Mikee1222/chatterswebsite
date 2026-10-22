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
