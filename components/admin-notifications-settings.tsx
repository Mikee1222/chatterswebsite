"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserMinus, UserPlus } from "lucide-react";
import { FormField } from "@/components/ui/form-field";
import { FormSelect } from "@/components/ui/form-select";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { useToast } from "@/contexts/toast-context";
import { addAdminNotificationUser, removeAdminNotificationUser } from "@/app/actions/admin-settings";
import type { AppNotification } from "@/types";

const selectOptionClass = "bg-[#1a1a1a] text-white";

function localToast(id: string, title: string, body: string, priority: "normal" | "high"): AppNotification {
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

function initials(name: string, email: string): string {
  const n = name.trim();
  if (n.length >= 2) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0][0];
      const b = parts[parts.length - 1][0];
      if (a && b) return (a + b).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  const e = email.trim();
  if (e.length >= 2) return e.slice(0, 2).toUpperCase();
  return "?";
}

export type AdminNotificationRow = { id: string; name: string; email: string };

export function AdminNotificationsSettings({
  admins,
  pickableUsers,
}: {
  admins: AdminNotificationRow[];
  pickableUsers: AdminNotificationRow[];
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [selectId, setSelectId] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  const selectOptions = React.useMemo(
    () => [
      { value: "", label: "Select user to add…" },
      ...pickableUsers.map((u) => ({ value: u.id, label: `${u.name} · ${u.email || "no email"}` })),
    ],
    [pickableUsers]
  );

  async function onAdd() {
    if (!selectId) {
      addToast(localToast(`an-empty-${Date.now()}`, "Choose a user", "Select someone from the list first.", "high"));
      return;
    }
    setAdding(true);
    try {
      const res = await addAdminNotificationUser(selectId);
      if (!res.success) {
        addToast(localToast(`an-err-${Date.now()}`, "Could not add", res.error, "high"));
        return;
      }
      addToast(localToast(`an-ok-${Date.now()}`, "Recipient added", "They will receive admin notifications.", "normal"));
      setSelectId("");
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addToast(localToast(`an-err-${Date.now()}`, "Could not add", msg, "high"));
    } finally {
      setAdding(false);
    }
  }

  async function onRemove(id: string) {
    if (admins.length <= 1) return;
    setRemovingId(id);
    try {
      const res = await removeAdminNotificationUser(id);
      if (!res.success) {
        addToast(localToast(`an-rm-err-${Date.now()}`, "Could not remove", res.error, "high"));
        return;
      }
      addToast(localToast(`an-rm-ok-${Date.now()}`, "Recipient removed", "Admin notification list was updated.", "normal"));
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addToast(localToast(`an-rm-err-${Date.now()}`, "Could not remove", msg, "high"));
    } finally {
      setRemovingId(null);
    }
  }

  const onlyOne = admins.length <= 1;

  return (
    <section className="border-t border-white/10 pt-8">
      <h2 className="mb-2 text-lg font-semibold text-white">Admin Notifications</h2>
      <p className="mb-6 max-w-2xl text-sm text-white/60">
        Manage who receives admin notifications (shift alerts, whales, customs, etc.). Stored in Airtable{" "}
        <code className="text-white/80">system_settings.admin_notification_ids</code>; if unset,{" "}
        <code className="text-white/80">ADMIN_AIRTABLE_USER_IDS</code> is used.
      </p>

      <div className="glass-card rounded-2xl border border-white/10 p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white/60">Current recipients</h3>
        {admins.length === 0 ? (
          <p className="mb-6 text-sm text-white/50">
            No recipients configured. Add users below, or set env / Airtable so notifications can be delivered.
          </p>
        ) : (
          <ul className="mb-8 space-y-3">
            {admins.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-pink-500/15 text-sm font-semibold text-pink-200"
                  aria-hidden
                >
                  {initials(u.name, u.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">{u.name}</p>
                  <p className="truncate text-sm text-white/55">{u.email || "—"}</p>
                </div>
                <button
                  type="button"
                  disabled={onlyOne || removingId === u.id}
                  onClick={() => void onRemove(u.id)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
                  title={onlyOne ? "At least one recipient is required" : "Remove from list"}
                >
                  {removingId === u.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <UserMinus className="h-4 w-4 text-white/70" aria-hidden />
                  )}
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-4">
          <FormField
            label="Add recipient"
            icon={<UserPlus />}
            htmlFor="admin-notif-add-user"
            description="Active users who can log in. Already listed users are hidden."
          >
            <FormSelect
              id="admin-notif-add-user"
              value={selectId}
              onChange={(e) => setSelectId(e.target.value)}
              disabled={pickableUsers.length === 0}
            >
              {selectOptions.map((o) => (
                <option key={o.value || "empty"} value={o.value} className={selectOptionClass}>
                  {o.label}
                </option>
              ))}
            </FormSelect>
          </FormField>
          <FormSubmitButton
            type="button"
            disabled={adding || !selectId || pickableUsers.length === 0}
            loading={adding}
            onClick={() => void onAdd()}
            className="w-full text-[15px] disabled:pointer-events-none disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add user"}
          </FormSubmitButton>
        </div>
        {pickableUsers.length === 0 ? (
          <p className="mt-4 text-xs text-white/45">No additional active users to add.</p>
        ) : null}
      </div>
    </section>
  );
}
