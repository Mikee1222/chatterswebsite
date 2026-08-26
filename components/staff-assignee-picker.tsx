"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { VA_CHAMPAGNE_DIVIDER, VA_FILTER_INPUT } from "@/lib/va-tasks-tokens";

export type StaffUserOption = {
  id: string;
  full_name: string;
  email: string;
  role: string;
};

const STAFF_ROLE_GROUP_ORDER = [
  "admin",
  "manager",
  "chatter",
  "virtual_assistant",
  "model",
  "client",
] as const;

export const DEFAULT_STAFF_ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  chatter: "Chatters",
  virtual_assistant: "VAs",
  model: "Model",
  client: "Client",
};

export function staffDisplayName(u: { full_name?: string; email?: string; id: string }): string {
  return (u.full_name || u.email || u.id).trim();
}

function roleGroupLabel(role: string, roleLabels: Record<string, string>): string {
  return roleLabels[role] ?? DEFAULT_STAFF_ROLE_LABELS[role] ?? role.replace(/_/g, " ");
}

export function groupStaffByRole(
  users: StaffUserOption[],
  roleLabels: Record<string, string>,
  query: string,
): Array<{ role: string; label: string; users: StaffUserOption[] }> {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? users.filter((u) => {
        const name = staffDisplayName(u).toLowerCase();
        const email = (u.email ?? "").toLowerCase();
        return name.includes(q) || email.includes(q);
      })
    : users;

  const byRole = new Map<string, StaffUserOption[]>();
  for (const u of filtered) {
    const role = (u.role || "other").trim() || "other";
    const list = byRole.get(role) ?? [];
    list.push(u);
    byRole.set(role, list);
  }

  for (const list of byRole.values()) {
    list.sort((a, b) => staffDisplayName(a).localeCompare(staffDisplayName(b)));
  }

  const known = STAFF_ROLE_GROUP_ORDER.filter((role) => byRole.has(role));
  const custom = [...byRole.keys()]
    .filter((role) => !STAFF_ROLE_GROUP_ORDER.includes(role as (typeof STAFF_ROLE_GROUP_ORDER)[number]))
    .sort((a, b) => roleGroupLabel(a, roleLabels).localeCompare(roleGroupLabel(b, roleLabels)));

  return [...known, ...custom]
    .map((role) => ({
      role,
      label: roleGroupLabel(role, roleLabels),
      users: byRole.get(role) ?? [],
    }))
    .filter((g) => g.users.length > 0);
}

type StaffAssigneePickerProps = {
  users: StaffUserOption[];
  roleLabels: Record<string, string>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  singleSelect?: boolean;
  /** Unique radio group name when multiple pickers can mount on one page. */
  name?: string;
  className?: string;
};

export function StaffAssigneePicker({
  users,
  roleLabels,
  selectedIds,
  onChange,
  singleSelect = false,
  name = "staff-assignee",
  className,
}: StaffAssigneePickerProps) {
  const [query, setQuery] = React.useState("");

  const grouped = React.useMemo(
    () => groupStaffByRole(users, roleLabels, query),
    [users, roleLabels, query],
  );

  const selectedUsers = React.useMemo(
    () => users.filter((u) => selectedIds.includes(u.id)),
    [users, selectedIds],
  );

  function toggleUser(id: string) {
    if (singleSelect) {
      onChange(selectedIds.includes(id) ? [] : [id]);
      return;
    }
    const set = new Set(selectedIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange([...set]);
  }

  return (
    <div className={cn("space-y-3", className)}>
      {selectedUsers.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedUsers.map((u) => {
            const name = staffDisplayName(u);
            return (
              <span
                key={u.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-pink-500/30 bg-pink-500/15 py-1 pl-1 pr-2 text-xs text-pink-200"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-pink-500/25 text-[10px] font-semibold text-pink-300">
                  {name.charAt(0).toUpperCase()}
                </span>
                <span className="max-w-[140px] truncate">{name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${name}`}
                  onClick={() => onChange(selectedIds.filter((id) => id !== u.id))}
                  className="rounded-full p-0.5 text-pink-300/60 hover:bg-pink-500/20 hover:text-pink-100"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B8B4B8]/35"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search members..."
          className={cn(
            VA_FILTER_INPUT,
            "w-full pl-9 shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)] focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.35),0_0_16px_-4px_rgba(255,20,147,0.25)]",
          )}
        />
      </div>
      <div className="max-h-52 overflow-y-auto rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0D0B0D]/60 p-2">
        {grouped.length === 0 ? (
          <p className="px-2 py-3 text-xs text-[#B8B4B8]/45">No members match your search.</p>
        ) : (
          grouped.map((group) => (
            <div key={group.role} className="mb-2 last:mb-0">
              <div className="sticky top-0 z-[1] flex items-center gap-2 bg-[#0D0B0D]/95 px-2 py-1.5 backdrop-blur-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/75">
                  {group.label}
                </p>
                <div className={cn(VA_CHAMPAGNE_DIVIDER, "flex-1")} />
              </div>
              <div className="space-y-0.5">
                {group.users.map((u) => {
                  const name = staffDisplayName(u);
                  const checked = selectedIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className={cn(
                        "flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2.5 text-sm transition hover:bg-white/5 touch-manipulation",
                        checked && "bg-pink-500/10",
                      )}
                    >
                      <input
                        type={singleSelect ? "radio" : "checkbox"}
                        name={singleSelect ? name : undefined}
                        checked={checked}
                        onChange={() => toggleUser(u.id)}
                        className="h-4 w-4 border-white/25 text-pink-500 focus:ring-pink-500/30"
                      />
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pink-500/15 text-[10px] font-semibold text-pink-300">
                        {name.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-white/80">{name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
