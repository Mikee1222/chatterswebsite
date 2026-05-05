import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { AdminEarningsDashboard } from "@/components/admin-earnings-dashboard";

function monthRangeToday() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

export default async function AdminEarningsPage() {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    redirect(ROUTES.dashboard);
  }

  const { from, to } = monthRangeToday();

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Admin earnings dashboard</h1>
        <p className="mt-1 text-sm text-white/55">Live earnings data from Infloww with filters and export.</p>
      </div>
      <AdminEarningsDashboard initialFrom={from} initialTo={to} />
    </div>
  );
}
