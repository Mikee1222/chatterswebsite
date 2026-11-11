import type { AuthUser } from "@/lib/auth-config";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getAssignedModelIdsForUser } from "@/services/posting-briefs";

/**
 * Who sees the Reuploads page. Managers (posting briefs / winner sourcing) see every
 * model; a VA with posting_briefs:view sees only the models whose accounts they run.
 * Returns null when the user has no access; `modelIds` undefined = all models.
 */
export async function resolveReuploadAccess(
  user: AuthUser,
): Promise<{ canManage: boolean; modelIds?: string[] } | null> {
  const [canPostingManage, canWinner, canView] = await Promise.all([
    hasPermission(user, PERMISSIONS.POSTING_BRIEFS_MANAGE),
    hasPermission(user, PERMISSIONS.WINNER_SOURCING_MANAGE),
    hasPermission(user, PERMISSIONS.POSTING_BRIEFS_VIEW),
  ]);
  if (canPostingManage || canWinner) return { canManage: true };
  if (!canView) return null;
  const a = await getAssignedModelIdsForUser(user.airtableUserId ?? user.id);
  const b =
    user.airtableUserId && user.airtableUserId !== user.id
      ? await getAssignedModelIdsForUser(user.id)
      : [];
  return { canManage: false, modelIds: [...new Set([...a, ...b])] };
}
