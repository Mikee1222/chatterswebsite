import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import type { BriefActorCapability } from "@/lib/brief-status-transitions";
import type { AuthUser } from "@/lib/auth-config";

export async function getRecordingBriefCapabilities(
  session: AuthUser,
): Promise<BriefActorCapability[]> {
  const caps: BriefActorCapability[] = [];
  if (await hasPermission(session, PERMISSIONS.RECORDING_BRIEFS_MANAGE)) caps.push("manage");
  if (await hasPermission(session, PERMISSIONS.RECORDING_BRIEFS_VIEW_OWN)) caps.push("view_own");
  if (await hasPermission(session, PERMISSIONS.RECORDING_BRIEFS_VIEW_ALL)) caps.push("view_all");
  return caps;
}

export function canAccessRecordingBrief(
  caps: BriefActorCapability[],
  briefModelId: string,
  linkedModelIds: string[],
): boolean {
  if (caps.includes("manage") || caps.includes("view_all")) return true;
  if (caps.includes("view_own")) {
    return linkedModelIds.includes(briefModelId.trim());
  }
  return false;
}
