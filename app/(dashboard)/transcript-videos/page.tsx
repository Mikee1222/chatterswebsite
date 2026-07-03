import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { getVideoTranscripts } from "@/services/video-transcripts";
import { TranscriptVideosClient } from "@/components/transcript-videos-client";

export default async function TranscriptVideosPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (!(await hasPermission(user, PERMISSIONS.VIDEO_TRANSCRIBE_ACCESS))) {
    redirect(ROUTES.dashboard);
  }

  const userId = user.airtableUserId ?? user.id;
  const transcripts = await getVideoTranscripts({ uploaded_by_id: userId }).catch(() => []);

  return (
    <div className="w-full max-w-full px-4 py-6 md:px-6">
      <TranscriptVideosClient initialTranscripts={transcripts} />
    </div>
  );
}
