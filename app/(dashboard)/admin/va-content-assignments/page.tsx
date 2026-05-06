import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { listAllModelss } from "@/services/modelss";
import { listAllUsers } from "@/services/users";
import { listAllVAContentAssignments } from "@/services/va-content-assignments";
import { AdminVaContentClient, type AdminVaContentAssignmentDTO } from "@/components/admin-va-content-client";

export const dynamic = "force-dynamic";

export default async function AdminVaContentAssignmentsPage() {
  const session = await getSessionFromCookies();
  if (!session || (session.role !== "admin" && session.role !== "manager")) {
    redirect(ROUTES.dashboard);
  }

  const [assignments, users, models] = await Promise.all([
    listAllVAContentAssignments(),
    listAllUsers(),
    listAllModelss(),
  ]);

  const vaUsers = users
    .filter((u) => u.role === "virtual_assistant")
    .map((u) => ({
      id: u.id,
      full_name: (u.full_name || "").trim() || u.email || "VA",
      status: u.status || "",
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const modelOptions = models
    .map((m) => ({
      id: m.id,
      model_name: (m.model_name || "").trim() || "Model",
    }))
    .sort((a, b) => a.model_name.localeCompare(b.model_name));

  const vaNameById = new Map(vaUsers.map((v) => [v.id, v.full_name]));
  const modelNameById = new Map(modelOptions.map((m) => [m.id, m.model_name]));

  const rows: AdminVaContentAssignmentDTO[] = assignments.map((a) => ({
    ...a,
    va_name: a.va_id ? (vaNameById.get(a.va_id) ?? "Unassigned") : "Unassigned",
    model_name: modelNameById.get(a.model_id) ?? "Model",
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
      <AdminVaContentClient rows={rows} vaOptions={vaUsers} modelOptions={modelOptions} />
    </div>
  );
}
