import { redirect } from "next/navigation";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { listActiveModelsForAssignment } from "@/services/modelss";
import { listCustomRequestsByChatter } from "@/services/custom-requests";
import { RequestCustomForm } from "@/components/request-custom-form";
import { CustomRequestHistory } from "@/components/custom-request-history";
import { ContentPipelineHero } from "@/components/content-pipeline-ui";
import { CountUp, LuxuryStatCard } from "@/components/infloww-performance-ui";
import {
  countCustomRequestsByDisplayStatus,
  countCustomRequestsThisWeek,
} from "@/lib/custom-request-status";
import { devLog } from "@/lib/dev-log";

export default async function RequestCustomPage() {
  const user = await getSessionFromCookies();
  if (!user || getEffectiveStaffRole(user) !== "chatter") redirect(ROUTES.dashboard);

  const chatterRecordId = user.airtableUserId ?? user.id;
  const chatterName = (user.fullName ?? user.email ?? "") as string;
  const [modelss, requests] = await Promise.all([
    listActiveModelsForAssignment().catch(() => []),
    listCustomRequestsByChatter(chatterRecordId).catch(() => []),
  ]);
  if (process.env.NODE_ENV !== "production") {
    devLog("[request-custom page] history debug", {
      currentUserEmail: user.email,
      currentUserId: user.id,
      currentAirtableUserRecordId: user.airtableUserId ?? "(null)",
      chatterRecordIdUsedForFilter: chatterRecordId,
      previousCustomRequestsCount: requests.length,
    });
  }

  const counts = countCustomRequestsByDisplayStatus(requests);
  const weekVolume = countCustomRequestsThisWeek(requests);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6">
      <ContentPipelineHero
        eyebrow="Requests"
        title="Custom requests"
        description="Submit a fan custom. Status stays the same from here to admin to the model: Pending → Accepted → Scheduled → In progress → Delivered."
        orb="both"
        stats={
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <LuxuryStatCard label="Pending" value={<CountUp value={counts.pending} />} accent="amber" glow tooltip="Awaiting agency accept or reject" />
            <LuxuryStatCard label="This week" value={<CountUp value={weekVolume} />} accent="champagne" tooltip="Requests you submitted this Athens week" />
            <LuxuryStatCard label="In progress" value={<CountUp value={counts.scheduled + counts.in_progress} />} accent="pink" tooltip="Accepted and being scheduled or filmed" />
            <LuxuryStatCard label="Delivered" value={<CountUp value={counts.delivered + counts.completed} />} accent="emerald" tooltip="Uploaded or completed" />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr]">
        <div className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.02] p-4 md:p-6">
          <h2 className="text-lg font-semibold text-white">New request</h2>
          <p className="mt-1 mb-5 text-sm text-white/45">Required fields are marked with *</p>
          <RequestCustomForm
            chatterRecordId={chatterRecordId}
            chatterName={chatterName}
            modelOptions={modelss.map((m) => ({ id: m.id, name: m.model_name }))}
          />
        </div>
        <div className="min-w-0">
          <CustomRequestHistory requests={requests} />
        </div>
      </div>
    </div>
  );
}
