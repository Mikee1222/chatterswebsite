import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { AdminSubmissionsClient } from "@/components/admin-submissions-client";
import {
  getAllBillingCycles,
  getAllPaymentSubmissions,
  getCachedBillingClients,
} from "@/services/client-billing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminSubmissionsPage() {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) redirect(ROUTES.dashboard);

  const [allSubmissions, clients, billingCycles] = await Promise.all([
    getAllPaymentSubmissions(),
    getCachedBillingClients(),
    getAllBillingCycles(),
  ]);

  return (
    <div className="relative space-y-8">
      <div className="pointer-events-none absolute -right-10 -top-16 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(236,72,153,0.22),rgba(0,0,0,0)_60%)] opacity-70 blur-3xl" />
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-pink-300/80">Payments</p>
        <h1 className="mt-2 text-4xl font-semibold text-white">Payment submissions</h1>
        <p className="mt-2 text-gray-400">Review, approve, and track proof submissions.</p>
      </div>
      <AdminSubmissionsClient
        allSubmissions={allSubmissions}
        clients={clients}
        billingCycles={billingCycles}
      />
    </div>
  );
}
