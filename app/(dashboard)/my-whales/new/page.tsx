import { redirect } from "next/navigation";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { FormCard } from "@/components/ui/form";
import { NewWhaleForm } from "@/components/new-whale-form";
import { listActiveModelsForAssignment } from "@/services/modelss";

export default async function NewWhalePage() {
  const user = await getSessionFromCookies();
  if (!user || getEffectiveStaffRole(user) !== "chatter") redirect(ROUTES.dashboard);

  const chatterId = user.airtableUserId ?? user.id;
  const chatterName = user.fullName ?? user.email;
  const modelss = await listActiveModelsForAssignment().catch(() => []);

  return (
    <div className="max-w-lg">
      <FormCard title="New whale" subtitle="Add a whale to your list">
        <NewWhaleForm
          chatterId={chatterId}
          chatterName={chatterName}
          modelOptions={modelss.map((m) => ({ id: m.id, name: m.model_name }))}
        />
      </FormCard>
    </div>
  );
}
