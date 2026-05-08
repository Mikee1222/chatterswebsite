import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ActivityLogsAdminClient } from "@/components/activity-logs-admin-client";
import { buildActivityLogsFilterByFormula, listActivityLogs } from "@/services/activity-logs";
import { listAllUsers } from "@/services/users";
import type { UserRole } from "@/types";

export default async function ActivityLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; actor?: string }>;
}) {
  const session = await getSessionFromCookies();
  if (!session || (session.role !== "admin" && session.role !== "manager")) {
    redirect("/home");
  }

  const params = await searchParams;
  const filterByFormula = buildActivityLogsFilterByFormula({
    action: params.action?.trim().toLowerCase(),
    actor: params.actor?.trim().toLowerCase(),
  });

  const [logRes, users] = await Promise.all([
    listActivityLogs({
      pageSize: 50,
      filterByFormula,
    }).catch(() => ({ logs: [] })),
    listAllUsers().catch(() => []),
  ]);
  const roleByUserId = new Map<string, UserRole>();
  for (const u of users) {
    if (!u?.id) continue;
    roleByUserId.set(u.id, u.role);
  }

  const entries = logRes.logs.map((log) => ({
    ...log,
    actor_role: roleByUserId.get(log.actor_user_id) ?? ("unknown" as const),
  }));

  return <ActivityLogsAdminClient entries={entries} />;
}
