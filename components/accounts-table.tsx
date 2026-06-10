"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { KeyRound, LogIn, Pencil, Search, Trash2, UserRound, Users } from "lucide-react";
import type { RoleRecord, SopColor, UserRecord, UserRole } from "@/types";
import { toggleCanLogin, deleteUserAction } from "@/app/actions/accounts";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdminRowAvatar, RecordStatusBadge, UserRoleBadge } from "@/components/admin-list-primitives";
import { SOP_COLOR_STYLES } from "@/components/sop/sop-colors";
import { formatDateEuropean } from "@/lib/format";

const KNOWN_USER_ROLES: UserRole[] = ["admin", "manager", "chatter", "virtual_assistant", "model", "client"];

type RoleTabId = "all" | "chatter" | "virtual_assistant" | "other" | string;

type RoleTab = { id: RoleTabId; label: string; count: number };

function buildRoleTabs(users: UserRecord[], roles: RoleRecord[]): RoleTab[] {
  const customRoles = roles.filter((r) => !r.is_system_role);
  const customRoleIds = new Set(customRoles.map((r) => r.role_id));

  const countFor = (predicate: (u: UserRecord) => boolean) => users.filter(predicate).length;

  const tabs: RoleTab[] = [
    { id: "all", label: "All", count: users.length },
    { id: "chatter", label: "Chatters", count: countFor((u) => u.role === "chatter") },
    { id: "virtual_assistant", label: "VAs", count: countFor((u) => u.role === "virtual_assistant") },
  ];

  for (const r of customRoles) {
    const count = countFor((u) => u.role === r.role_id);
    if (count >= 1) {
      tabs.push({ id: r.role_id, label: r.label || r.role_id.replace(/_/g, " "), count });
    }
  }

  const otherCount = countFor(
    (u) =>
      u.role !== "chatter" &&
      u.role !== "virtual_assistant" &&
      !customRoleIds.has(u.role)
  );
  tabs.push({ id: "other", label: "Admin & other", count: otherCount });

  return tabs;
}

function userMatchesRoleTab(u: UserRecord, tab: RoleTabId, customRoleIds: Set<string>): boolean {
  if (tab === "all") return true;
  if (tab === "chatter") return u.role === "chatter";
  if (tab === "virtual_assistant") return u.role === "virtual_assistant";
  if (tab === "other") {
    return (
      u.role !== "chatter" &&
      u.role !== "virtual_assistant" &&
      !customRoleIds.has(u.role)
    );
  }
  return u.role === tab;
}

function roleStyleFor(role: string, roles: RoleRecord[]): { badge: string; dot: string; label: string } {
  const record = roles.find((r) => r.role_id === role);
  const label = record?.label || role.replace(/_/g, " ");
  const colorKey = (record?.color || "") as SopColor;
  if (colorKey && colorKey in SOP_COLOR_STYLES) {
    const cfg = SOP_COLOR_STYLES[colorKey];
    return { badge: cfg.badge, dot: cfg.dot, label };
  }
  if (KNOWN_USER_ROLES.includes(role as UserRole)) {
    const fallback: Record<UserRole, string> = {
      chatter: SOP_COLOR_STYLES.blue.badge,
      virtual_assistant: SOP_COLOR_STYLES.pink.badge,
      admin: SOP_COLOR_STYLES.orange.badge,
      manager: SOP_COLOR_STYLES.orange.badge,
      model: SOP_COLOR_STYLES.green.badge,
      client: SOP_COLOR_STYLES.purple.badge,
    };
    const dotFallback: Record<UserRole, string> = {
      chatter: SOP_COLOR_STYLES.blue.dot,
      virtual_assistant: SOP_COLOR_STYLES.pink.dot,
      admin: SOP_COLOR_STYLES.orange.dot,
      manager: SOP_COLOR_STYLES.orange.dot,
      model: SOP_COLOR_STYLES.green.dot,
      client: SOP_COLOR_STYLES.purple.dot,
    };
    return {
      badge: fallback[role as UserRole],
      dot: dotFallback[role as UserRole],
      label,
    };
  }
  return { badge: SOP_COLOR_STYLES.gray.badge, dot: SOP_COLOR_STYLES.gray.dot, label };
}

function AccountRoleBadge({ role, roles }: { role: string; roles: RoleRecord[] }) {
  if (KNOWN_USER_ROLES.includes(role as UserRole) && !roles.some((r) => r.role_id === role)) {
    return <UserRoleBadge role={role as UserRole} />;
  }
  const { badge, dot, label } = roleStyleFor(role, roles);
  return (
    <span
      className={cn(
        "inline-flex max-w-[160px] items-center gap-1.5 truncate rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
        badge
      )}
      title={label}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} aria-hidden />
      {label}
    </span>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function AccountsTable({ users, roles }: { users: UserRecord[]; roles: RoleRecord[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; name: string } | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const customRoleIds = React.useMemo(
    () => new Set(roles.filter((r) => !r.is_system_role).map((r) => r.role_id)),
    [roles]
  );
  const tabs = React.useMemo(() => buildRoleTabs(users, roles), [users, roles]);

  const roleParam = searchParams.get("role") ?? "all";
  const activeTab: RoleTabId = tabs.some((t) => t.id === roleParam) ? roleParam : "all";

  function setRoleTab(tab: RoleTabId) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "all") params.delete("role");
    else params.set("role", tab);
    const q = params.toString();
    router.push(`${ROUTES.admin.accounts}${q ? `?${q}` : ""}`);
  }

  const filtered = React.useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (!userMatchesRoleTab(u, activeTab, customRoleIds)) return false;
      if (!q) return true;
      return `${u.full_name} ${u.email}`.toLowerCase().includes(q);
    });
  }, [users, activeTab, customRoleIds, debouncedSearch]);

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

      <div className="relative mb-4">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full rounded-xl border border-white/10 bg-black/25 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/35 focus:border-pink-500/40 focus:outline-none focus:ring-1 focus:ring-pink-500/25"
          aria-label="Search users"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2 border-b border-white/[0.06] pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setRoleTab(tab.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
              activeTab === tab.id
                ? "border-pink-500/40 bg-pink-500/15 text-pink-100 shadow-[0_0_20px_-8px_rgba(236,72,153,0.35)]"
                : "border-white/10 bg-white/[0.03] text-white/65 hover:border-white/20 hover:bg-white/[0.06] hover:text-white/90"
            )}
          >
            {tab.id === "chatter" ? <UserRound className="h-4 w-4 opacity-80" aria-hidden /> : null}
            {tab.id === "virtual_assistant" ? <Users className="h-4 w-4 opacity-80" aria-hidden /> : null}
            {tab.label}
            <span className="rounded-md bg-black/30 px-1.5 py-0.5 text-[11px] font-semibold text-white/70">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-4 md:hidden">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] p-8 text-center">
            <UserRound className="mx-auto h-8 w-8 text-white/25" aria-hidden />
            <p className="mt-3 text-sm font-medium text-white/70">No users found</p>
            <p className="mt-1 text-xs text-white/45">Try a different filter or search term.</p>
          </div>
        ) : (
          filtered.map((u, index) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.04, ease: "easeOut" }}
              className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 transition-[border-color,box-shadow] hover:border-pink-500/20 hover:shadow-[0_12px_40px_-28px_rgba(236,72,153,0.2)]"
            >
              <div className="flex items-start gap-3">
                <AdminRowAvatar name={u.full_name || u.email || "?"} />
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-white/95">{u.full_name}</p>
                  <p className="mt-0.5 truncate text-sm text-white/60">{u.email}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <AccountRoleBadge role={u.role} roles={roles} />
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
                  {u.created_at ? (
                    <p className="mt-2 text-xs text-white/40">Joined {formatDateEuropean(u.created_at)}</p>
                  ) : null}
                </div>
              </div>
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
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-gradient-to-r from-black/55 via-black/45 to-pink-950/15 text-left text-xs font-medium uppercase tracking-wider text-white/50">
              <th className="p-3.5 font-medium">User</th>
              <th className="p-3.5 font-medium">Role</th>
              <th className="p-3.5 font-medium">Status</th>
              <th className="p-3.5 font-medium">Login</th>
              <th className="p-3.5 font-medium">Created</th>
              <th className="p-3.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-10 text-center">
                  <UserRound className="mx-auto h-8 w-8 text-white/25" aria-hidden />
                  <p className="mt-3 text-sm text-white/55">No users found</p>
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
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white/92">{u.full_name}</p>
                        <p className="truncate text-xs text-white/50">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5">
                    <AccountRoleBadge role={u.role} roles={roles} />
                  </td>
                  <td className="p-3.5">
                    <RecordStatusBadge status={u.status} />
                  </td>
                  <td className="p-3.5">
                    <form action={toggleCanLogin} className="inline-flex">
                      <input type="hidden" name="recordId" value={u.id} />
                      <input type="hidden" name="can_login" value={u.can_login ? "false" : "true"} />
                      <button
                        type="submit"
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition hover:brightness-110",
                          u.can_login
                            ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-200"
                            : "border-white/12 bg-white/[0.05] text-white/55"
                        )}
                        title={u.can_login ? "Disable login" : "Enable login"}
                      >
                        <LogIn className="h-3 w-3" aria-hidden />
                        {u.can_login ? "On" : "Off"}
                      </button>
                    </form>
                  </td>
                  <td className="p-3.5 text-white/55">
                    {u.created_at ? formatDateEuropean(u.created_at) : "—"}
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
