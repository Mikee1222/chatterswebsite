import { redirect } from "next/navigation";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { assertVaTypeCanAccessNavHref } from "@/lib/va-type-access";
import { listActiveModelsForAssignment } from "@/services/modelss";
import { filterActiveUsersForAssignment } from "@/lib/assignment-filters";
import { listAllUsers } from "@/services/users";
import {
  getMistakeReasons,
  getMistakesByVA,
  type MistakeReasonRecord,
  type MistakeRecord,
} from "@/services/chatter-mistakes";
import { VaMistakesClient } from "@/components/va-mistakes-client";

export default async function VaMistakesPage() {
  const session = await getSessionFromCookies();
  if (!session || getEffectiveStaffRole(session) !== "virtual_assistant") {
    redirect(ROUTES.dashboard);
  }
  if (!(await hasPermission(session, PERMISSIONS.MISTAKES_VIEW))) {
    redirect(ROUTES.dashboard);
  }
  await assertVaTypeCanAccessNavHref(session, ROUTES.va.mistakes);

  const vaId = (session.airtableUserId ?? session.id)?.trim();
  if (!vaId) redirect(ROUTES.dashboard);

  const [users, models, reasons, mistakes] = await Promise.all([
    listAllUsers().catch(() => []),
    listActiveModelsForAssignment().catch(() => []),
    getMistakeReasons().catch(() => [] as MistakeReasonRecord[]),
    getMistakesByVA(vaId).catch(() => [] as MistakeRecord[]),
  ]);

  const chatters = filterActiveUsersForAssignment(users)
    .filter((u) => u.role === "chatter")
    .map((u) => ({
      id: u.id,
      name: (u.full_name ?? "").trim() || u.email || "Chatter",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const modelOptions = models
    .map((m) => ({
      id: m.id,
      model_name: (m.model_name ?? "").trim() || "Model",
    }))
    .sort((a, b) => a.model_name.localeCompare(b.model_name));

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <VaMistakesClient
        initialMistakes={mistakes}
        chatters={chatters}
        models={modelOptions}
        reasons={reasons}
      />
    </div>
  );
}
