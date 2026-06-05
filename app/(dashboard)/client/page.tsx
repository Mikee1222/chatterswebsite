import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";

export default async function ClientHomePage() {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "client") redirect(ROUTES.login);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Welcome, {user.fullName || user.email}
        </h1>
        <p className="mt-1 text-sm text-white/55">
          Gunzo Agency Client Portal
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <a href={ROUTES.client.payments} className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 hover:border-pink-400/25 transition-colors">
          <p className="text-lg font-semibold text-white">💳 Payments</p>
          <p className="mt-1 text-sm text-white/55">Submit and track payments</p>
        </a>
        <a href={ROUTES.client.invoices} className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 hover:border-pink-400/25 transition-colors">
          <p className="text-lg font-semibold text-white">📄 Invoices</p>
          <p className="mt-1 text-sm text-white/55">View your invoices</p>
        </a>
        <a href={ROUTES.client.models} className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 hover:border-pink-400/25 transition-colors">
          <p className="text-lg font-semibold text-white">👥 Models</p>
          <p className="mt-1 text-sm text-white/55">Your model roster</p>
        </a>
        <a href={ROUTES.client.calendar} className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 hover:border-pink-400/25 transition-colors">
          <p className="text-lg font-semibold text-white">📅 Calendar</p>
          <p className="mt-1 text-sm text-white/55">Payment schedule</p>
        </a>
        <a href={ROUTES.client.paymentHistory} className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 hover:border-pink-400/25 transition-colors">
          <p className="text-lg font-semibold text-white">📊 History</p>
          <p className="mt-1 text-sm text-white/55">Payment history</p>
        </a>
      </div>
    </div>
  );
}
