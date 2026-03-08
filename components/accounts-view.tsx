"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { UserRecord, ModelRecord } from "@/types";
import { AccountsTable } from "@/components/accounts-table";
import { ModelssTable } from "@/components/modelss-table";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/routes";

type Section = "users" | "modelss";

type Props = {
  users: UserRecord[];
  modelss: ModelRecord[];
  success?: string;
  error?: string;
};

export function AccountsView({ users, modelss, success, error }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = (searchParams.get("section") === "modelss" ? "modelss" : "users") as Section;

  function setSection(s: Section) {
    const params = new URLSearchParams(searchParams.toString());
    if (s === "users") params.delete("section");
    else params.set("section", "modelss");
    router.push(`${ROUTES.accounts}${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Admin</h1>
        <p className="mt-1 text-sm text-white/60">Manage users and modelss</p>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
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
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                section === "users"
                  ? "bg-[hsl(330,80%,55%)]/20 text-[hsl(330,90%,65%)]"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              )}
            >
              Users
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={section === "modelss"}
              onClick={() => setSection("modelss")}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                section === "modelss"
                  ? "bg-[hsl(330,80%,55%)]/20 text-[hsl(330,90%,65%)]"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              )}
            >
              Modelss
            </button>
          </div>
          {section === "users" ? (
            <Link
              href={ROUTES.accountsNew}
              className="rounded-xl bg-[hsl(330,80%,55%)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[hsl(330,80%,50%)]"
            >
              Create user
            </Link>
          ) : (
            <Link
              href={ROUTES.accountsModelssNew}
              className="rounded-xl bg-[hsl(330,80%,55%)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[hsl(330,80%,50%)]"
            >
              Create model
            </Link>
          )}
        </div>
      </div>

      {success && (
        <p className="rounded-lg border border-[hsl(330,80%,55%)]/30 bg-[hsl(330,80%,55%)]/10 px-4 py-2 text-sm text-[hsl(330,90%,75%)]">
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
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {decodeURIComponent(error)}
        </p>
      )}

      {section === "users" && (
        <>
          <p className="text-sm text-white/60">
            Create and manage user accounts. Passwords are hashed and never stored in plain text.
          </p>
          <div className="glass-card overflow-hidden">
            <AccountsTable users={users} />
          </div>
        </>
      )}

      {section === "modelss" && (
        <>
          <p className="text-sm text-white/60">
            Create and manage modelss. Current status and current chatter are shown when a model is in use.
          </p>
          <div className="glass-card overflow-hidden">
            <ModelssTable modelss={modelss} />
          </div>
        </>
      )}
    </div>
  );
}
