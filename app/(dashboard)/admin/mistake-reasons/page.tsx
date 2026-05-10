import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getAllMistakeReasons } from "@/services/chatter-mistakes";
import { AdminMistakeReasonsClient } from "@/components/admin-mistake-reasons-client";

export default async function AdminMistakeReasonsPage() {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "admin") {
    redirect(ROUTES.dashboard);
  }

  const reasons = await getAllMistakeReasons().catch(() => []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <AdminMistakeReasonsClient initialReasons={reasons} />
    </div>
  );
}
