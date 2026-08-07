import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute, hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { listActiveGunzoTeamModelss } from "@/services/modelss";
import { listUsersWithPermission } from "@/services/users";
import { listVideoBunches } from "@/services/winner-sourcing";
import { getFilmingProgressForBunches } from "@/services/filming";
import { getEditingProgressForBunches } from "@/services/editing";
import { getPipelineOverviewContext } from "@/services/icloud";
import {
  AdminBunchesClient,
  type BunchModelOption,
  type BunchStaffOption,
} from "@/components/admin-bunches-client";
import type { IcloudFolderEntry } from "@/services/icloud";

export default async function AdminBunchesPage({
  searchParams,
}: {
  searchParams?: Promise<{ id?: string }>;
}) {
  const user = await getSessionFromCookies();
  await requireAdminRoute(user, PERMISSIONS.WINNER_SOURCING_MANAGE);

  const params = (await searchParams) ?? {};
  const initialSelectedId = typeof params.id === "string" && params.id.trim() ? params.id.trim() : null;

  const canManageFilming = user
    ? await hasPermission(user, PERMISSIONS.FILMING_MANAGE)
    : false;
  const canManageEditing = user
    ? await hasPermission(user, PERMISSIONS.EDITING_MANAGE)
    : false;

  const [bunches, gunzoModels, creativeUsers, filmerUsers, editorUsers, pipeline] =
    await Promise.all([
      listVideoBunches().catch(() => []),
      listActiveGunzoTeamModelss().catch(() => []),
      listUsersWithPermission(PERMISSIONS.CREATIVE_SCRIPTS_SUBMIT).catch(() => []),
      canManageFilming
        ? listUsersWithPermission(PERMISSIONS.FILMING_VIEW_ASSIGNMENTS).catch(() => [])
        : Promise.resolve([]),
      canManageEditing
        ? listUsersWithPermission(PERMISSIONS.EDITING_VIEW_ASSIGNMENTS).catch(() => [])
        : Promise.resolve([]),
      getPipelineOverviewContext().catch(() => ({
        bunches: [] as Awaited<ReturnType<typeof listVideoBunches>>,
        foldersByBunch: {},
        modelRunways: [],
      })),
    ]);

  const filmingProgress = canManageFilming
    ? await getFilmingProgressForBunches(bunches.map((b) => b.id)).catch(() => ({}))
    : {};
  const editingProgress = canManageEditing
    ? await getEditingProgressForBunches(bunches.map((b) => b.id)).catch(() => ({}))
    : {};

  const models: BunchModelOption[] = gunzoModels.map((m) => ({
    model_id: m.id || m.model_id,
    model_name: m.model_name || m.model_id || "Creator",
  }));

  const creatives: BunchStaffOption[] = creativeUsers
    .map((u) => ({
      id: u.id,
      name: (u.full_name || u.email || "").trim(),
      email: u.email || "",
      role: u.role || "other",
    }))
    .filter((c) => c.id && c.name)
    .sort((a, b) => a.name.localeCompare(b.name));

  const filmers: BunchStaffOption[] = filmerUsers
    .map((u) => ({
      id: u.id,
      name: (u.full_name || u.email || "").trim(),
      email: u.email || "",
      role: u.role || "other",
    }))
    .filter((c) => c.id && c.name)
    .sort((a, b) => a.name.localeCompare(b.name));

  const editors: BunchStaffOption[] = editorUsers
    .map((u) => ({
      id: u.id,
      name: (u.full_name || u.email || "").trim(),
      email: u.email || "",
      role: u.role || "other",
    }))
    .filter((c) => c.id && c.name)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <AdminBunchesClient
        initialBunches={bunches}
        models={models}
        creatives={creatives}
        filmers={filmers}
        editors={editors}
        canManageFilming={canManageFilming}
        canManageEditing={canManageEditing}
        initialFilmingProgress={filmingProgress}
        initialEditingProgress={editingProgress}
        initialModelRunways={pipeline.modelRunways}
        initialFoldersByBunch={pipeline.foldersByBunch}
        initialSelectedId={initialSelectedId}
      />
    </div>
  );
}
