"use client";

import * as React from "react";
import { Loader2, Send, Check, X } from "lucide-react";
import {
  NOTIFICATION_TEST_PRESETS,
  presetsForGroup,
  type NotificationTestGroup,
  type NotificationTestUserOption,
} from "@/lib/notification-test-presets";
import { cn } from "@/lib/utils";

const GROUP_LABEL: Record<NotificationTestGroup, string> = {
  chatter: "Chatter",
  virtual_assistant: "VA",
  model: "Model",
  admin: "Admin",
};

const GROUP_ORDER: NotificationTestGroup[] = ["chatter", "virtual_assistant", "model", "admin"];

type SendState = "idle" | "loading" | "ok" | "err";

export function AdminTestNotificationsClient() {
  const [users, setUsers] = React.useState<NotificationTestUserOption[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = React.useState(true);
  const [recipientByGroup, setRecipientByGroup] = React.useState<Record<NotificationTestGroup, string>>({
    chatter: "",
    virtual_assistant: "",
    model: "",
    admin: "",
  });
  const [sendState, setSendState] = React.useState<Record<string, SendState>>({});
  const [bulkLoading, setBulkLoading] = React.useState<NotificationTestGroup | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/debug/test-notifications", { credentials: "include" });
        if (!res.ok) {
          const text = res.status === 404 ? "Testing API disabled (production)." : `HTTP ${res.status}`;
          if (!cancelled) setLoadError(text);
          return;
        }
        const data = (await res.json()) as { users: NotificationTestUserOption[] };
        if (cancelled) return;
        setUsers(data.users ?? []);
        const next: Record<NotificationTestGroup, string> = {
          chatter: "",
          virtual_assistant: "",
          model: "",
          admin: "",
        };
        for (const g of GROUP_ORDER) {
          const first = data.users?.find((u) =>
            g === "virtual_assistant" ? u.role === "virtual_assistant" : u.role === g
          );
          next[g] = first?.id ?? "";
        }
        setRecipientByGroup(next);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load users");
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const usersForSelect = (group: NotificationTestGroup) =>
    users.filter((u) => (group === "virtual_assistant" ? u.role === "virtual_assistant" : u.role === group));

  const sendOne = React.useCallback(
    async (
      presetId: string,
      group: NotificationTestGroup,
      payload: (typeof NOTIFICATION_TEST_PRESETS)[0],
      userIdOverride?: string
    ) => {
      const userId = (userIdOverride ?? recipientByGroup[group])?.trim();
      if (!userId) return;
      setSendState((s) => ({ ...s, [presetId]: "loading" }));
      try {
        const res = await fetch("/api/debug/test-notifications", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_type: payload.event_type,
            user_id: userId,
            title: payload.title,
            body: payload.body,
            entity_type: payload.entity_type,
            entity_id: `debug_ui:${presetId}:${Date.now()}`,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setSendState((s) => ({ ...s, [presetId]: "err" }));
          return;
        }
        setSendState((s) => ({ ...s, [presetId]: "ok" }));
        void data;
      } catch {
        setSendState((s) => ({ ...s, [presetId]: "err" }));
      }
    },
    [recipientByGroup]
  );

  const sendAllForGroup = React.useCallback(
    async (group: NotificationTestGroup) => {
      const list = presetsForGroup(group);
      const userId = recipientByGroup[group]?.trim();
      if (!userId || list.length === 0) return;
      setBulkLoading(group);
      for (const p of list) {
        await sendOne(p.id, group, p, userId);
      }
      setBulkLoading(null);
    },
    [recipientByGroup, sendOne]
  );

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-red-500/30 bg-red-950/40 p-6 text-red-100">
        <p className="font-medium">Cannot load notification testing</p>
        <p className="mt-2 text-sm text-red-200/80">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100/95">
        <span className="font-semibold text-amber-200">Warning:</span> This page sends{""}
        <strong>real</strong> in-app notifications and may trigger <strong>real web push</strong> to the selected
        users (same as production <code className="rounded bg-black/30 px-1">notify()</code>).
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Notification testing</h1>
        <p className="text-sm text-white/55">
          Choose one Airtable user per role, then send individual presets or bulk-send every preset for that role.
        </p>
      </header>

      {loadingUsers ? (
        <div className="flex items-center gap-2 text-white/60">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading users…
        </div>
      ) : (
        GROUP_ORDER.map((group) => {
          const rows = presetsForGroup(group);
          const options = usersForSelect(group);
          return (
            <section
              key={group}
              className="rounded-2xl border border-white/10 bg-zinc-950/80 p-5 shadow-xl ring-1 ring-white/5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-medium text-white">{GROUP_LABEL[group]}</h2>
                  <p className="text-xs text-white/45">{rows.length} preset(s)</p>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex min-w-[220px] flex-col gap-1 text-xs text-white/50">
                    Recipient ({GROUP_LABEL[group]})
                    <select
                      className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
                      value={recipientByGroup[group]}
                      onChange={(e) =>
                        setRecipientByGroup((prev) => ({ ...prev, [group]: e.target.value }))
                      }
                    >
                      <option value="">— select user —</option>
                      {options.map((u) => (
                        <option key={u.id} value={u.id}>
                          {(u.full_name || u.email).slice(0, 48)} ({u.status})
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={!recipientByGroup[group] || bulkLoading !== null}
                    onClick={() => void sendAllForGroup(group)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
                      "bg-amber-500/90 text-zinc-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                    )}
                  >
                    {bulkLoading === group ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Send ALL for {GROUP_LABEL[group]}
                  </button>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-white/40">
                      <th className="py-2 pr-3 font-medium">Preset</th>
                      <th className="py-2 pr-3 font-medium">event_type</th>
                      <th className="py-2 pr-3 font-medium">Title</th>
                      <th className="w-28 py-2 font-medium">Result</th>
                      <th className="w-32 py-2 font-medium"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const st = sendState[row.id] ?? "idle";
                      return (
                        <tr key={row.id} className="border-b border-white/[0.06] text-white/85">
                          <td className="py-2.5 pr-3 font-mono text-xs text-amber-200/90">{row.id}</td>
                          <td className="py-2.5 pr-3 font-mono text-xs text-white/70">{row.event_type}</td>
                          <td className="max-w-[200px] truncate py-2.5 pr-3 text-white/80" title={row.title}>
                            {row.title}
                          </td>
                          <td className="py-2.5">
                            {st === "idle" && <span className="text-white/35">—</span>}
                            {st === "loading" && <Loader2 className="h-4 w-4 animate-spin text-amber-300/90" />}
                            {st === "ok" && <Check className="h-4 w-4 text-emerald-400" aria-label="Sent" />}
                            {st === "err" && <X className="h-4 w-4 text-red-400" aria-label="Failed" />}
                          </td>
                          <td className="py-2.5">
                            <button
                              type="button"
                              disabled={!recipientByGroup[group] || st === "loading" || bulkLoading !== null}
                              onClick={() => void sendOne(row.id, group, row)}
                              className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/90 hover:bg-white/10 disabled:opacity-40"
                            >
                              Send test
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
