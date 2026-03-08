import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { listAllModelss } from "@/services/modelss";
import { listCustomRequestsByChatter } from "@/services/custom-requests";
import { FormCard } from "@/components/ui/form";
import { RequestCustomForm } from "@/components/request-custom-form";
import { CustomRequestHistory } from "@/components/custom-request-history";

export default async function RequestCustomPage() {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "chatter") redirect(ROUTES.dashboard);

  const chatterRecordId = user.airtableUserId ?? user.id;
  const chatterName = (user.fullName ?? user.email ?? "") as string;
  const [modelss, requests] = await Promise.all([
    listAllModelss().catch(() => []),
    listCustomRequestsByChatter(chatterRecordId).catch(() => []),
  ]);
  if (process.env.NODE_ENV !== "production") {
    console.log("[request-custom page] history debug", {
      currentUserEmail: user.email,
      currentUserId: user.id,
      currentAirtableUserRecordId: user.airtableUserId ?? "(null)",
      chatterRecordIdUsedForFilter: chatterRecordId,
      previousCustomRequestsCount: requests.length,
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
      <div className="min-w-0">
        <FormCard title="Request a custom" subtitle="Submit a custom request for a fan">
          <RequestCustomForm
            chatterRecordId={chatterRecordId}
            chatterName={chatterName}
            modelOptions={modelss.map((m) => ({ id: m.id, name: m.model_name }))}
          />
        </FormCard>
      </div>
      <div className="min-w-0">
        <CustomRequestHistory requests={requests} />
      </div>
    </div>
  );
}
