"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { KeyRound, LogIn, Pencil, Trash2, UserRound, Users } from "lucide-react";
import type { UserRecord } from "@/types";
import { toggleCanLogin, deleteUserAction } from "@/app/actions/accounts";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdminRowAvatar, RecordStatusBadge, UserRoleBadge } from "@/components/admin-list-primitives";

type RoleTab = "all" | "chatter" | "virtual_assistant" | "other";

function roleTabLabel(tab: RoleTab): string {
  switch (tab) {
    case "all":
      return "All";
    case "chatter":
      return "Chatters";
    case "virtual_assistant":
      return "VAs";
    default:
      return "Admin & other";
  }
}

function userMatchesRoleTab(u: UserRecord, tab: RoleTab): boolean {
  if (tab === "all") return true;
  if (tab === "chatter") return u.role === "chatter";
  if (tab === "virtual_assistant") return u.role === "virtual_assistant";
  return u.role !== "chatter" && u.role !== "virtual_assistant";
}

export function AccountsTable({ users }: { users: UserRecord[] }) {
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; name: string } | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [roleTab, setRoleTab] = React.useState<RoleTab>("all");

  const filtered = React.useMemo(
    () => users.filter((u) => userMatchesRoleTab(u, roleTab)),
    [users, roleTab]
  );

  const counts = React.useMemo(() => {
    const c = { all: users.length, chatter: 0, virtual_assistant: 0, other: 0 };
    for (const u of users) {
      if (u.role === "chatter") c.chatter++;
      else if (u.role === "virtual_assistant") c.virtual_assistant++;
      else c.other++;
    }
    return c;
  }, [users]);

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      await deleteUserAction(deleteTarget.id);
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  }

  const tabs: RoleTab[] = ["all", "chatter", "virtual_assistant", "other"];

  return (
    <>
      <ConfirmDialog
        open={deleteTarget != null}
        onClose={() => deletingId == null && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete user"
        description={`This will permanently delete "${deleteTarget?.name ?? ""}" and remove all their data including shifts, assignments, notifications, and points. This cannot be undone.`}
        confirmLabel="Delete permanently"
        confirmVariant="danger"
        loading={deletingId !== null}
        requireNameConfirmation
        nameToConfirm={deleteTarget?.name ?? ""}
      />

      <div className="mb-4 flex flex-wrap gap-2 border-b border-white/[0.06] pb-4">
        {tabs.map((tab) => {
          const count =
            tab === "all"
              ? counts.all
              : tab === "chatter"
                ? counts.chatter
                : tab === "virtual_assistant"
                  ? counts.virtual_assistant
                  : counts.other;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setRoleTab(tab)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
                roleTab === tab
                  ? "border-pink-500/40 bg-pink-500/15 text-pink-100 shadow-[0_0_20px_-8px_rgba(236,72,153,0.35)]"
                  : "border-white/10 bg-white/[0.03] text-white/65 hover:border-white/20 hover:bg-white/[0.06] hover:text-white/90"
              )}
            >
              {tab === "chatter" ? <UserRound className="h-4 w-4 opacity-80" aria-hidden /> : null}
              {tab === "virtual_assistant" ? <Users className="h-4 w-4 opacity-80" aria-hidden /> : null}
              {roleTabLabel(tab)}
              <span className="rounded-md bg-black/30 px-1.5 py-0.5 text-[11px] font-semibold text-white/70">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-4 md:hidden">
        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/50">No users in this view.</p>
        ) : (
          filtered.map((u, index) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.04, ease: "easeOut" }}
              whileHover={{ scale: 1.01 }}
              className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 transition-[border-color,box-shadow] hover:border-pink-500/20 hover:shadow-[0_12px_40px_-28px_rgba(236,72,153,0.2)]"
              style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.04)" }}
            >
              <div className="flex items-start gap-3">
                <AdminRowAvatar name={u.full_name || u.email || "?"} />
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-white/95">{u.full_name}</p>
                  <p className="mt-0.5 truncate text-sm text-white/60">{u.email}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <UserRoleBadge role={u.role} />
                    <RecordStatusBadge status={u.status} />
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        u.can_login
                          ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-200"
                          : "border-white/12 bg-white/[0.05] text-white/55"
                      )}
                    >
                      {u.can_login ? "Login on" : "Login off"}
                    </span>
                  </div>
                </div>
              </div>
              {u.notes ? <p className="mt-3 line-clamp-2 text-sm text-white/55">{u.notes}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={ROUTES.accountEdit(u.id)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white/90 hover:border-pink-500/35 hover:bg-pink-500/10"
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                  Edit
                </Link>
                <Link
                  href={ROUTES.accountResetPassword(u.id)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10"
                >
                  <KeyRound className="h-4 w-4" aria-hidden />
                  Reset password
                </Link>
                <form action={toggleCanLogin} className="inline-block">
                  <input type="hidden" name="recordId" value={u.id} />
                  <input type="hidden" name="can_login" value={u.can_login ? "false" : "true"} />
                  <button
                    type="submit"
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10"
                  >
                    <LogIn className="h-4 w-4" aria-hidden />
                    {u.can_login ? "Disable login" : "Enable login"}
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() =>
                    setDeleteTarget({
                      id: u.id,
                      name: u.full_name?.trim() || u.email?.trim() || "User",
                    })
                  }
                  disabled={deletingId !== null}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Delete
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-gradient-to-r from-black/55 via-black/45 to-pink-950/15 text-left text-xs font-medium uppercase tracking-wider text-white/50">
              <th className="p-3.5 font-medium">User</th>
              <th className="p-3.5 font-medium">Email</th>
              <th className="p-3.5 font-medium">Role</th>
              <th className="p-3.5 font-medium">Status</th>
              <th className="p-3.5 font-medium">Login</th>
              <th className="p-3.5 font-medium">Notes</th>
              <th className="p-3.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-white/50">
                  No users in this view.
                </td>
              </tr>
            ) : (
              filtered.map((u, index) => (
                <motion.tr
                  key={u.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03, ease: "easeOut" }}
                  className={cn(
                    "group transition-[background-color,box-shadow] duration-200",
                    "hover:bg-gradient-to-r hover:from-white/[0.04] hover:to-pink-500/[0.03] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
                  )}
                >
                  <td className="p-3.5">
                    <div className="flex items-center gap-3">
                      <AdminRowAvatar name={u.full_name || u.email || "?"} size="sm" className="ring-1 ring-white/10" />
                      <span className="font-semibold text-white/92">{u.full_name}</span>
                    </div>
                  </td>
                  <td className="p-3.5 text-white/75">{u.email}</td>
                  <td className="p-3.5">
                    <UserRoleBadge role={u.role} />
                  </td>
                  <td className="p-3.5">
                    <RecordStatusBadge status={u.status} />
                  </td>
                  <td className="p-3.5">
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        u.can_login
                          ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-200"
                          : "border-white/12 bg-white/[0.05] text-white/55"
                      )}
                    >
                      {u.can_login ? "On" : "Off"}
                    </span>
                  </td>
                  <td className="max-w-[200px] truncate p-3.5 text-white/55" title={u.notes || undefined}>
                    {u.notes || "—"}
                  </td>
                  <td className="p-3.5 text-right">
                    <div className="inline-flex items-center justify-end gap-0.5 rounded-xl border border-white/[0.08] bg-black/25 p-0.5 opacity-90 transition-opacity group-hover:opacity-100">
                      <Link
                        href={ROUTES.accountEdit(u.id)}
                        className="rounded-lg p-2 text-white/55 hover:bg-pink-500/15 hover:text-pink-200"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Link>
                      <Link
                        href={ROUTES.accountResetPassword(u.id)}
                        className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white/85"
                        title="Reset password"
                      >
                        <KeyRound className="h-4 w-4" aria-hidden />
                      </Link>
                      <form action={toggleCanLogin} className="inline-flex">
                        <input type="hidden" name="recordId" value={u.id} />
                        <input type="hidden" name="can_login" value={u.can_login ? "false" : "true"} />
                        <button
                          type="submit"
                          className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white/85"
                          title={u.can_login ? "Disable login" : "Enable login"}
                        >
                          <LogIn className="h-4 w-4" aria-hidden />
                        </button>
                      </form>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            id: u.id,
                            name: u.full_name?.trim() || u.email?.trim() || "User",
                          })
                        }
                        disabled={deletingId !== null}
                        className="rounded-lg p-2 text-white/45 hover:bg-red-500/15 hover:text-red-300 disabled:opacity-50"
                        title="Delete user"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
