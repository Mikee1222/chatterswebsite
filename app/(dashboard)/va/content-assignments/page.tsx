import { redirect } from "next/navigation";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { listAllModelss } from "@/services/modelss";
import { listVAContentAssignmentsForVaUser } from "@/services/va-content-assignments";
import { VaContentAssignmentsClient } from "@/components/va-content-assignments-client";

export default async function VaContentAssignmentsPage() {
  const session = await getSessionFromCookies();
  if (!session || getEffectiveStaffRole(session) !== "virtual_assistant") {
    redirect(ROUTES.dashboard);
  }

  const vaId = (session.airtableUserId ?? session.id)?.trim();
  if (!vaId) redirect(ROUTES.dashboard);

  const [models, assignments] = await Promise.all([
    listAllModelss(),
    listVAContentAssignmentsForVaUser(vaId),
  ]);

  const nameById = new Map(models.map((m) => [m.id, (m.model_name ?? "").trim() || "Model"]));
  const rows = assignments.map((a) => ({
    ...a,
    model_name: nameById.get(a.model_id) ?? "Model",
  }));

  const modelOptions = models.map((m) => ({
    id: m.id,
    model_name: m.model_name ?? "",
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <VaContentAssignmentsClient models={modelOptions} rows={rows} />
    </div>
  );
}
