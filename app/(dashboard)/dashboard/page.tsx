import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { listAllUsers } from "@/services/users";

export default async function DashboardPage() {
  const [user, users] = await Promise.all([
    getSessionFromCookies(),
    listAllUsers().catch(() => []),
  ]);

  if (user?.role === "chatter") redirect(ROUTES.chatter.home);
  if (user?.role === "virtual_assistant") redirect(ROUTES.va.home);
  if (user?.role === "admin" || user?.role === "manager") redirect(ROUTES.admin.home);

  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-white">Dashboard</h1>
      <p className="text-sm text-white/60">
        Focus: admin-controlled user management. Accounts, auth, and roles first; operations features come later.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="glass-card p-5">
          <p className="text-sm font-medium text-white/60">Total accounts</p>
          <p className="mt-1 text-2xl font-semibold text-white">{users.length}</p>
        </div>
        {isAdmin && (
          <Link
            href={ROUTES.admin.accounts}
            className="glass-card flex items-center gap-3 p-5 transition-colors hover:bg-white/5"
          >
            <span className="text-2xl">👤</span>
            <div>
              <p className="font-medium text-white">Manage accounts</p>
              <p className="text-sm text-white/60">Create and manage users, roles, and access</p>
            </div>
          </Link>
        )}
      </div>

      {!isAdmin && (
        <p className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
          You’re signed in as <span className="font-medium text-white/90">{String(user?.role ?? "").replace("_", " ")}</span>. Account management is available to admins only.
        </p>
      )}
    </div>
  );
}
