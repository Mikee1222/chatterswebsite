import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { AdminEarningsDashboard } from "@/components/admin-earnings-dashboard";

/**
 * Default range: 30 calendar days ending on **yesterday** (inclusive).
 * `infloww-api` uses `to` + `T23:59:59.999Z` as `endTime`; using “today” can make `endTime`
 * slightly ahead of the API clock → “must be a past or present time”.
 */
function last30DaysRange() {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  yesterday.setHours(23, 59, 59, 999);

  const thirtyDaysAgo = new Date(yesterday);
  thirtyDaysAgo.setDate(yesterday.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: ymd(thirtyDaysAgo), to: ymd(yesterday) };
}

export default async function AdminEarningsPage() {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    redirect(ROUTES.dashboard);
  }

  const { from, to } = last30DaysRange();

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Admin earnings dashboard</h1>
        <p className="mt-1 text-sm text-white/55">
          Infloww Open API — defaults to the last 30 days ending yesterday so the range never extends into
          “today” (avoids future endTime). Adjust dates or creator if totals look empty.
        </p>
      </div>
      <AdminEarningsDashboard initialFrom={from} initialTo={to} />
    </div>
  );
}
