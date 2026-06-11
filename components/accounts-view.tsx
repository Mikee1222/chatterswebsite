"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, UserRound, Users } from "lucide-react";
import type { UserRecord, ModelRecord, RoleRecord } from "@/types";
import { AccountsTable } from "@/components/accounts-table";
import { ModelssTable } from "@/components/modelss-table";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/routes";

type Section = "users" | "modelss";

export type AccountStats = {
  total: number;
  chatters: number;
  vas: number;
  customRoles: number;
};

type Props = {
  users: UserRecord[];
  modelss: ModelRecord[];
  roles: RoleRecord[];
  stats: AccountStats;
  canCreate: boolean;
  success?: string;
  error?: string;
};

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3",
        accent
          ? "border-pink-500/25 bg-gradient-to-br from-pink-500/10 to-fuchsia-500/5"
          : "border-white/10 bg-white/[0.04]"
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-white/45">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

export function AccountsView({ users, modelss, roles, stats, canCreate, success, error }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = (searchParams.get("section") === "modelss" ? "modelss" : "users") as Section;

  function setSection(s: Section) {
    const params = new URLSearchParams(searchParams.toString());
    if (s === "users") params.delete("section");
    else params.set("section", "modelss");
    router.push(`${ROUTES.admin.accounts}${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Accounts</h1>
          <p className="mt-1 text-sm text-white/55">
            {stats.total} user{stats.total === 1 ? "" : "s"} · manage logins, roles, and access
          </p>
        </div>
        {section === "users" && canCreate ? (
          <Link
            href={ROUTES.accountsNew}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 self-start rounded-xl bg-[hsl(330,80%,55%)] px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_28px_-8px_rgba(236,72,153,0.45)] transition hover:bg-[hsl(330,80%,50%)]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New user
          </Link>
        ) : section === "modelss" && canCreate ? (
          <Link
            href={ROUTES.accountsModelssNew}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 self-start rounded-xl bg-[hsl(330,80%,55%)] px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_28px_-8px_rgba(236,72,153,0.45)] transition hover:bg-[hsl(330,80%,50%)]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New model
          </Link>
        ) : null}
      </div>

      {section === "users" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total" value={stats.total} accent />
          <StatCard label="Chatters" value={stats.chatters} />
          <StatCard label="VAs" value={stats.vas} />
          <StatCard label="Custom roles" value={stats.customRoles} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div
          className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1"
          role="tablist"
          aria-label="Section"
        >
          <button
            type="button"
            role="tab"
            aria-selected={section === "users"}
            onClick={() => setSection("users")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              section === "users"
                ? "bg-[hsl(330,80%,55%)]/20 text-[hsl(330,90%,65%)]"
                : "text-white/70 hover:bg-white/5 hover:text-white"
            )}
          >
            <Users className="h-4 w-4 opacity-80" aria-hidden />
            Users
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={section === "modelss"}
            onClick={() => setSection("modelss")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              section === "modelss"
                ? "bg-[hsl(330,80%,55%)]/20 text-[hsl(330,90%,65%)]"
                : "text-white/70 hover:bg-white/5 hover:text-white"
            )}
          >
            <UserRound className="h-4 w-4 opacity-80" aria-hidden />
            Modelss
          </button>
        </div>
      </div>

      {success && (
        <p className="rounded-xl border border-[hsl(330,80%,55%)]/30 bg-[hsl(330,80%,55%)]/10 px-4 py-2.5 text-sm text-[hsl(330,90%,75%)]">
          {success === "created" && "User created."}
          {success === "updated" && "User updated."}
          {success === "password_reset" && "Password reset."}
          {success === "user_deleted" && "User deleted."}
          {success === "model_created" && "Model created."}
          {success === "model_updated" && "Model updated."}
          {success === "model_deleted" && "Model deleted."}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {decodeURIComponent(error)}
        </p>
      )}

      {section === "users" && (
        <div className="glass-card overflow-hidden p-4 sm:p-5">
          <AccountsTable users={users} roles={roles} />
        </div>
      )}

      {section === "modelss" && (
        <>
          <p className="text-sm text-white/55">
            {modelss.length} model{modelss.length === 1 ? "" : "s"} · create and manage models, chatter
            occupancy, and payment details
          </p>
          <div className="glass-card overflow-hidden p-4 sm:p-5">
            <ModelssTable modelss={modelss} />
          </div>
        </>
      )}
    </div>
  );
}
