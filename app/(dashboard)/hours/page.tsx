import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getHoursSummary } from "@/services/hours";
import { listAllUsers } from "@/services/users";
import { Select, btnSecondaryClass } from "@/components/ui/form";

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

export default async function HoursPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; role?: string; user?: string }>;
}) {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  const params = await searchParams;
  const period = params.period ?? "week";
  const today = new Date().toISOString().split("T")[0];
  const weekStart = getWeekStart(new Date());
  const monthKey = new Date().toISOString().slice(0, 7);

  let fromDate: string | undefined;
  let toDate: string | undefined;
  if (period === "today") {
    fromDate = today;
    toDate = today;
  } else if (period === "week") {
    fromDate = weekStart;
    toDate = undefined;
  } else if (period === "month") {
    fromDate = `${monthKey}-01`;
    toDate = undefined;
  }

  const [summary, users] = await Promise.all([
    getHoursSummary({
      userId: params.user || undefined,
      role: params.role as "chatter" | "virtual_assistant" | undefined,
      weekStart: period === "week" ? weekStart : undefined,
      monthKey: period === "month" ? monthKey : undefined,
      fromDate,
      toDate,
    }).catch(() => ({ shifts: [], totalMinutes: 0, totalHoursDecimal: 0, shiftsCount: 0 })),
    listAllUsers().catch(() => []),
  ]);

  const byUser = new Map<string, { minutes: number; hours: number; count: number }>();
  for (const s of summary.shifts) {
    const key = s.chatter_id;
    const cur = byUser.get(key) ?? { minutes: 0, hours: 0, count: 0 };
    cur.minutes += s.total_minutes ?? 0;
    cur.hours += s.total_hours_decimal ?? 0;
    cur.count += 1;
    byUser.set(key, cur);
  }

  const userNames = new Map(users.map((u) => [u.id, u.full_name ?? u.email]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <form method="get" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="role" value={params.role ?? ""} />
          <input type="hidden" name="user" value={params.user ?? ""} />
          <Select name="period" defaultValue={period} className="min-w-0">
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
          </Select>
          <button type="submit" className={btnSecondaryClass}>Apply</button>
        </form>
        {user.role === "admin" && (
          <form method="get" className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="period" value={period} />
            <Select name="role" defaultValue={params.role ?? ""} className="min-w-0">
              <option value="">All roles</option>
              <option value="chatter">Chatter</option>
              <option value="virtual_assistant">Virtual assistant</option>
            </Select>
            <button type="submit" className={btnSecondaryClass}>Filter</button>
          </form>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass-card p-5">
          <p className="text-sm text-white/60">Total hours</p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {typeof summary.totalHoursDecimal === "number" && !Number.isNaN(summary.totalHoursDecimal)
              ? summary.totalHoursDecimal.toFixed(1)
              : "—"}
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-white/60">Total minutes</p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {typeof summary.totalMinutes === "number" ? summary.totalMinutes : "—"}
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-white/60">Shifts</p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {typeof summary.shiftsCount === "number" ? summary.shiftsCount : "—"}
          </p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <h2 className="border-b border-white/10 p-4 text-lg font-semibold text-white">By user</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-white/60">
              <th className="p-3 font-medium">User</th>
              <th className="p-3 font-medium">Total hours</th>
              <th className="p-3 font-medium">Shifts</th>
              <th className="p-3 font-medium">Avg (hours)</th>
            </tr>
          </thead>
          <tbody>
            {byUser.size === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-white/50">
                  No data
                </td>
              </tr>
            ) : (
              Array.from(byUser.entries())
                .sort((a, b) => b[1].hours - a[1].hours)
                .map(([uid, data]) => (
                  <tr key={uid} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3 font-medium text-white/90">{userNames.get(uid) ?? uid}</td>
                    <td className="p-3 text-white/80">{data.hours.toFixed(1)}</td>
                    <td className="p-3 text-white/80">{data.count}</td>
                    <td className="p-3 text-white/80">{data.count ? (data.hours / data.count).toFixed(1) : "—"}</td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
