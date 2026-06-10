"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Lock, Plus, Shield, Trash2, Users } from "lucide-react";
import { SOP_COLOR_STYLES } from "@/components/sop/sop-colors";
import { SopShell } from "@/components/sop/sop-shell";
import { SopEmptyState } from "@/components/sop/sop-empty-state";
import { ButtonPrimary, ButtonSecondary } from "@/components/ui/form";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/contexts/toast-context";
import type { AppNotification } from "@/types";
import {
  getPermissionGroups,
  PERMISSION_LABELS,
  type Permission,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { RoleRecord } from "@/types";

function localToast(
  id: string,
  title: string,
  body: string,
  priority: "normal" | "high"
): AppNotification {
  return {
    id,
    notification_id: id,
    user_id: "local",
    category: "system",
    event_type: "system_alert",
    priority,
    title,
    body,
    entity_type: "system",
    entity_id: "",
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

const ROLE_COLORS = ["blue", "pink", "green", "orange", "purple", "gray"] as const;
type RoleColor = (typeof ROLE_COLORS)[number];

type RoleDraft = {
  id: string;
  role_id: string;
  label: string;
  description: string;
  permissions: Permission[];
  is_system_role: boolean;
  color: string;
  isNew?: boolean;
};

function slugFromLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toDraft(role: RoleRecord): RoleDraft {
  return {
    id: role.id,
    role_id: role.role_id,
    label: role.label,
    description: role.description,
    permissions: [...role.permissions],
    is_system_role: role.is_system_role,
    color: role.color || "gray",
  };
}

function draftsEqual(a: RoleDraft, b: RoleDraft): boolean {
  return (
    a.role_id === b.role_id &&
    a.label === b.label &&
    a.description === b.description &&
    a.color === b.color &&
    a.permissions.length === b.permissions.length &&
    a.permissions.every((p) => b.permissions.includes(p))
  );
}

function PermissionSwitch({
  id,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "relative h-9 w-[3.25rem] shrink-0 rounded-full border-2 outline-none transition duration-300",
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer active:scale-[0.98]",
        checked
          ? "border-pink-300/45 bg-gradient-to-r from-pink-500 via-fuchsia-600 to-purple-600"
          : "border-white/18 bg-[#262626]"
      )}
    >
      <motion.span
        className={cn(
          "pointer-events-none absolute left-[4px] top-[4px] h-6 w-6 rounded-full bg-white shadow-md",
          checked && "ring-2 ring-pink-200/35"
        )}
        initial={false}
        animate={{ x: checked ? 22 : 0 }}
        transition={
          reduceMotion
            ? { duration: 0.12 }
            : { type: "spring", stiffness: 480, damping: 32, mass: 0.62 }
        }
      />
    </button>
  );
}

function RoleColorDot({ color }: { color: string }) {
  const cfg = SOP_COLOR_STYLES[(color as RoleColor) in SOP_COLOR_STYLES ? (color as RoleColor) : "gray"];
  return <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", cfg.dot)} />;
}

export function AdminRolesClient({
  initialRoles,
  initialUserCounts,
  grantablePermissions,
}: {
  initialRoles: RoleRecord[];
  initialUserCounts: Record<string, number>;
  grantablePermissions: Permission[];
}) {
  const { addToast } = useToast();
  const permissionGroups = React.useMemo(() => getPermissionGroups(), []);
  const grantableSet = React.useMemo(() => new Set(grantablePermissions), [grantablePermissions]);

  const [roles, setRoles] = React.useState<RoleRecord[]>(initialRoles);
  const [userCounts, setUserCounts] = React.useState(initialUserCounts);
  const [selectedId, setSelectedId] = React.useState<string | null>(initialRoles[0]?.id ?? null);
  const [draft, setDraft] = React.useState<RoleDraft | null>(
    initialRoles[0] ? toDraft(initialRoles[0]) : null
  );
  const [savedDraft, setSavedDraft] = React.useState<RoleDraft | null>(
    initialRoles[0] ? toDraft(initialRoles[0]) : null
  );
  const [expandedGroups, setExpandedGroups] = React.useState<Record<string, boolean>>({});
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const hasUnsavedChanges =
    draft != null && savedDraft != null && !draftsEqual(draft, savedDraft);

  const selectRole = React.useCallback((role: RoleRecord) => {
    const next = toDraft(role);
    setSelectedId(role.id);
    setDraft(next);
    setSavedDraft(next);
    setError(null);
  }, []);

  function handleNewRole() {
    const stamp = Date.now().toString(36);
    const role_id = `custom-${stamp}`;
    const next: RoleDraft = {
      id: `new-${stamp}`,
      role_id,
      label: "New role",
      description: "",
      permissions: [],
      is_system_role: false,
      color: "pink",
      isNew: true,
    };
    setSelectedId(next.id);
    setDraft(next);
    setSavedDraft(next);
    setError(null);
  }

  function updateDraft(patch: Partial<RoleDraft>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function togglePermission(perm: Permission, enabled: boolean) {
    if (!draft) return;
    if (!grantableSet.has(perm)) return;
    setDraft((prev) => {
      if (!prev) return prev;
      const set = new Set(prev.permissions);
      if (enabled) set.add(perm);
      else set.delete(perm);
      return { ...prev, permissions: [...set] };
    });
  }

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        label: draft.label.trim(),
        description: draft.description.trim(),
        permissions: draft.permissions,
        color: draft.color,
      };

      if (draft.isNew) {
        const slug = draft.is_system_role ? draft.role_id : slugFromLabel(draft.label) || draft.role_id;
        const res = await fetch("/api/admin/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, role_id: slug }),
        });
        const data = (await res.json()) as { role?: RoleRecord; error?: string };
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Create failed");
        const created = data.role!;
        setRoles((prev) => [...prev, created].sort((a, b) => a.label.localeCompare(b.label)));
        const next = toDraft(created);
        setSelectedId(created.id);
        setDraft(next);
        setSavedDraft(next);
        addToast(localToast("role-create", "Role created", "Custom role was added.", "normal"));
      } else {
        const res = await fetch(`/api/admin/roles/${encodeURIComponent(draft.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { role?: RoleRecord; error?: string };
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Save failed");
        const updated = data.role!;
        setRoles((prev) =>
          prev.map((r) => (r.id === updated.id ? updated : r)).sort((a, b) => a.label.localeCompare(b.label))
        );
        const next = toDraft(updated);
        setDraft(next);
        setSavedDraft(next);
        addToast(localToast("role-save", "Role saved", "Permissions were updated.", "normal"));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      setError(msg);
      addToast(localToast("role-save-e", "Save failed", msg, "high"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!draft || draft.isNew || draft.is_system_role) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/roles/${encodeURIComponent(draft.id)}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Delete failed");
      const remaining = roles.filter((r) => r.id !== draft.id);
      setRoles(remaining);
      if (remaining[0]) selectRole(remaining[0]);
      else {
        setSelectedId(null);
        setDraft(null);
        setSavedDraft(null);
      }
      setDeleteOpen(false);
      addToast(localToast("role-del", "Role deleted", "Custom role was removed.", "normal"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      setError(msg);
      addToast(localToast("role-del-e", "Delete failed", msg, "high"));
    } finally {
      setDeleting(false);
    }
  }

  const selectedRole = roles.find((r) => r.id === selectedId);

  return (
    <SopShell className="min-h-full pb-8">
      <div className="mx-auto max-w-7xl px-1 md:px-0">
        <div className="sop-glass-panel mb-6 rounded-2xl p-5 md:p-6">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-pink-400/55">Admin</p>
          <h1 className="text-2xl font-bold text-white md:text-3xl">Roles & permissions</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/50">
            Configure what each role can access. System roles keep a fixed slug but can otherwise be edited; custom roles can be created and removed.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(260px,320px)_1fr]">
          <aside className="sop-glass-panel flex flex-col rounded-2xl p-4">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55">Roles</h2>
              <button
                type="button"
                onClick={handleNewRole}
                className="inline-flex items-center gap-1.5 rounded-lg border border-pink-500/30 bg-pink-500/10 px-2.5 py-1.5 text-xs font-semibold text-pink-200 transition hover:bg-pink-500/20"
              >
                <Plus className="h-3.5 w-3.5" />
                New role
              </button>
            </div>
            <ul className="flex flex-1 flex-col gap-2 overflow-y-auto">
              {roles.map((role) => {
                const color = (role.color || "gray") as RoleColor;
                const cfg = SOP_COLOR_STYLES[ROLE_COLORS.includes(color) ? color : "gray"];
                const count = userCounts[role.role_id.toLowerCase()] ?? 0;
                const active = selectedId === role.id;
                return (
                  <li key={role.id}>
                    <button
                      type="button"
                      onClick={() => selectRole(role)}
                      className={cn(
                        "w-full rounded-xl border px-3 py-3 text-left transition",
                        active
                          ? cn("border-pink-500/35 bg-pink-500/10", cfg.glow)
                          : "border-white/10 bg-white/[0.03] hover:border-white/16 hover:bg-white/[0.06]"
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <RoleColorDot color={role.color || "gray"} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={cn("truncate font-semibold", cfg.text)}>{role.label}</span>
                            {role.is_system_role ? (
                              <Lock className="h-3.5 w-3.5 shrink-0 text-white/35" aria-label="System role" />
                            ) : null}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-white/40">{role.role_id}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                                cfg.badge
                              )}
                            >
                              <Users className="h-3 w-3" />
                              {count}
                            </span>
                            <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/45">
                              {role.is_system_role ? "System" : "Custom"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
              {draft?.isNew && !roles.some((r) => r.id === draft.id) ? (
                <li>
                  <div className="rounded-xl border border-dashed border-pink-500/35 bg-pink-500/5 px-3 py-3">
                    <p className="text-sm font-semibold text-pink-200">{draft.label}</p>
                    <p className="text-xs text-white/40">Unsaved draft</p>
                  </div>
                </li>
              ) : null}
            </ul>
          </aside>

          <section className="min-w-0">
            {!draft ? (
              <SopEmptyState
                icon={Shield}
                title="Select a role"
                description="Choose a role from the list or create a new custom role."
              />
            ) : (
              <div className="sop-glass-panel rounded-2xl p-5 md:p-6">
                <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-white">{draft.label || "Untitled role"}</h2>
                      {hasUnsavedChanges ? (
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200 ring-1 ring-amber-400/30">
                          Unsaved
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-white/45">
                      {draft.is_system_role ? "System role — slug cannot be changed" : "Custom role"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!draft.isNew && !draft.is_system_role ? (
                      <ButtonSecondary type="button" onClick={() => setDeleteOpen(true)} disabled={deleting}>
                        <Trash2 className="mr-1.5 inline h-4 w-4" />
                        Delete
                      </ButtonSecondary>
                    ) : null}
                    <ButtonPrimary type="button" onClick={handleSave} disabled={saving || (!hasUnsavedChanges && !draft.isNew)}>
                      {saving ? (
                        <>
                          <Spinner className="mr-2 inline h-4 w-4 border-white/30 border-t-white" />
                          Saving…
                        </>
                      ) : draft.isNew ? (
                        "Create role"
                      ) : (
                        "Save changes"
                      )}
                    </ButtonPrimary>
                  </div>
                </div>

                {error ? (
                  <p className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                    {error}
                  </p>
                ) : null}

                <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/45">
                      Slug
                    </label>
                    <FormInput
                      value={draft.isNew && !draft.is_system_role ? slugFromLabel(draft.label) || draft.role_id : draft.role_id}
                      readOnly
                      className="opacity-70"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/45">
                      Label
                    </label>
                    <FormInput
                      value={draft.label}
                      onChange={(e) => updateDraft({ label: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/45">
                      Description
                    </label>
                    <FormTextarea
                      value={draft.description}
                      onChange={(e) => updateDraft({ description: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/45">
                      Badge color
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {ROLE_COLORS.map((c) => {
                        const cfg = SOP_COLOR_STYLES[c];
                        const picked = (draft.color || "gray") === c;
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => updateDraft({ color: c })}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition",
                              picked ? cn(cfg.badge, cfg.glow) : "border-white/10 bg-white/5 text-white/50 hover:text-white/80"
                            )}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/55">Permissions</h3>
                  <div className="space-y-2">
                    {permissionGroups.map((group) => {
                      const open = expandedGroups[group.key] ?? false;
                      const groupPerms = group.permissions;
                      const enabledCount = groupPerms.filter((p) => draft.permissions.includes(p)).length;
                      return (
                        <div
                          key={group.key}
                          className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
                        >
                          <button
                            type="button"
                            onClick={() => toggleGroup(group.key)}
                            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04]"
                          >
                            <div>
                              <p className="font-semibold text-white/85">{group.label}</p>
                              <p className="text-xs text-white/40">
                                {enabledCount} of {groupPerms.length} enabled
                              </p>
                            </div>
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 shrink-0 text-white/40 transition",
                                open && "rotate-180"
                              )}
                            />
                          </button>
                          {open ? (
                            <ul className="border-t border-white/[0.06] px-2 py-2">
                              {groupPerms.map((perm) => {
                                const checked = draft.permissions.includes(perm);
                                const canGrant = grantableSet.has(perm);
                                const disabled = !canGrant;
                                const switchId = `perm-${draft.id}-${perm}`;
                                return (
                                  <li
                                    key={perm}
                                    className={cn(
                                      "flex items-center justify-between gap-3 rounded-lg px-2 py-2.5",
                                      !canGrant && "opacity-45"
                                    )}
                                  >
                                    <label htmlFor={switchId} className="min-w-0 flex-1 cursor-pointer">
                                      <p className="text-sm font-medium text-white/80">
                                        {PERMISSION_LABELS[perm]}
                                      </p>
                                      <p className="font-mono text-[11px] text-white/35">{perm}</p>
                                    </label>
                                    <PermissionSwitch
                                      id={switchId}
                                      checked={checked}
                                      disabled={disabled}
                                      onChange={(next) => togglePermission(perm, next)}
                                    />
                                  </li>
                                );
                              })}
                            </ul>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete role?"
        description={
          selectedRole
            ? `Remove "${selectedRole.label}"? Users assigned this role will keep it until changed in Accounts.`
            : "Remove this custom role?"
        }
        confirmLabel="Delete role"
        confirmVariant="danger"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </SopShell>
  );
}
