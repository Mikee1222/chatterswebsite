import "server-only";

import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { listLinkedModelIdsForUser } from "@/services/model-user-profiles";
import type { AuthUser } from "@/lib/auth-config";

type Session = AuthUser;

export type WardrobeAccess = { canView: boolean; canEdit: boolean };

/** Same gating as the persona editor: manage/view, or edit_own on a linked model. */
export async function resolveWardrobeAccess(session: Session, modelId: string): Promise<WardrobeAccess> {
  const canManage = await hasPermission(session, PERMISSIONS.PERSONAS_MANAGE);
  if (canManage) return { canView: true, canEdit: true };
  const canView = await hasPermission(session, PERMISSIONS.PERSONAS_VIEW);
  const canEditOwn = await hasPermission(session, PERMISSIONS.PERSONAS_EDIT_OWN);
  let ownsModel = false;
  if (canEditOwn) {
    const linked = await listLinkedModelIdsForUser(session.airtableUserId ?? session.id).catch(() => ({
      modelIds: [] as string[],
    }));
    ownsModel = linked.modelIds.includes(modelId);
  }
  return { canView: canView || ownsModel, canEdit: ownsModel };
}
