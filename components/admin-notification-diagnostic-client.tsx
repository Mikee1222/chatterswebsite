"use client";

import * as React from "react";
import { Loader2, RefreshCw, Download, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type CheckBlock = {
  pass?: boolean;
  fix?: string | null;
  error?: string;
  [key: string]: unknown;
};

type UserRow = {
  id: string;
  name: string;
  role: string;
  overall: string;
  checks: Record<string, CheckBlock | CheckBlock[]>;
};

type DiagnosticPayload = {
  env: Record<string, boolean>;
  airtable_tables: Record<string, { exists: boolean; error?: string; sample_count?: number }>;
  users: UserRow[];
  summary: {
    env_all_required?: boolean;
    airtable_tables_ok?: boolean;
    total_users: number;
    fully_working: number;
    has_issues: number;
    issues_by_user: Array<{ name: string; role: string; failed_checks: string[]; fixes: string[] }>;
  };
};

function EnvPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium",
        ok
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
          : "border-red-500/40 bg-red-500/10 text-red-200"
      )}
    >
      {ok ? "✅" : "❌"} {label}
    </span>
  );
}

function TablePill({ exists, name }: { exists: boolean; name: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium",
        exists
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
          : "border-red-500/40 bg-red-500/10 text-red-200"
      )}
    >
      {exists ? "✅" : "❌"} {name}
    </span>
  );
}

function checkBlockPass(v: CheckBlock | CheckBlock[] | undefined): boolean {
  if (v == null) return true;
  if (Array.isArray(v)) return v.every((x) => x.pass !== false);
  return v.pass !== false;
}

function UserCard({ user }: { user: UserRow }) {
  const [open, setOpen] = React.useState(!String(user.overall).startsWith("✅"));
  const entries = Object.entries(user.checks ?? {});

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div>
          <p className="font-medium text-white">
            {String(user.overall).startsWith("✅") ? "✅" : "❌"} {user.name}{" "}
            <span className="text-white/50">({user.role})</span>
          </p>
          <p className="mt-1 text-xs text-white/50">
            prefs {checkBlockPass(user.checks?.has_preferences as CheckBlock) ? "✅" : "❌"} · subs{" "}
            {checkBlockPass(user.checks?.has_push_subscriptions as CheckBlock) ? "✅" : "❌"} · notify row{" "}
            {checkBlockPass(user.checks?.notify_pipeline as CheckBlock) ? "✅" : "❌"} · notify push{" "}
            {checkBlockPass(user.checks?.notify_push_sent as CheckBlock) ? "✅" : "❌"} · direct push{" "}
            {checkBlockPass(user.checks?.push_delivery_direct as CheckBlock) ? "✅" : "❌"}
          </p>
        </div>
        {open ? <ChevronDown className="h-5 w-5 shrink-0 text-white/40" /> : <ChevronRight className="h-5 w-5 shrink-0 text-white/40" />}
      </button>
      {open && (
        <ul className="mt-4 space-y-3 border-t border-white/10 pt-4 text-sm">
          {entries.map(([key, val]) => (
            <li key={key} className="rounded-xl bg-black/20 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-pink-200/90">{key}</span>
                {Array.isArray(val) ? (
                  <span className={cn("text-xs", val.every((x) => x.pass !== false) ? "text-emerald-300" : "text-red-300")}>
                    {val.every((x) => x.pass !== false) ? "✅" : "❌"}
                  </span>
                ) : (
                  <span className={cn("text-xs", val?.pass !== false ? "text-emerald-300" : "text-red-300")}>
                    {val?.pass !== false ? "✅" : "❌"}
                  </span>
                )}
              </div>
              {val && !Array.isArray(val) && val.fix && (
                <p className="mt-1 text-xs text-red-300/90">Fix: {val.fix}</p>
              )}
              {val && !Array.isArray(val) && val.error && (
                <p className="mt-1 text-xs text-amber-200/90">{String(val.error)}</p>
              )}
              {key === "push_delivery_direct" &&
                val &&
                !Array.isArray(val) &&
                Array.isArray((val as { results?: unknown }).results) && (
                  <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-black/40 p-2 text-[10px] text-white/70">
                    {JSON.stringify((val as { results: unknown }).results, null, 2)}
                  </pre>
                )}
              {val && !Array.isArray(val) && key !== "push_delivery_direct" && (
                <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-black/40 p-2 text-[10px] text-white/60">
                  {JSON.stringify(val, null, 2)}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdminNotificationDiagnosticClient() {
  const [data, setData] = React.useState<DiagnosticPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [userFilter, setUserFilter] = React.useState("");

  const run = React.useCallback(async (userId?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const q = userId?.trim() ? `?user_id=${encodeURIComponent(userId.trim())}` : "";
      const res = await fetch(`/api/debug/notification-diagnostic${q}`, { credentials: "include" });
      if (!res.ok) {
        const text = res.status === 404 ? "Diagnostic API disabled (production without ENABLE_NOTIFICATION_TESTING)." : `HTTP ${res.status}`;
        setError(text);
        setData(null);
        return;
      }
      setData((await res.json()) as DiagnosticPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void run(null);
  }, [run]);

  const exportJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notification-diagnostic-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const env = data?.env;
  const tables = data?.airtable_tables;
  const summary = data?.summary;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 pb-24">
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        ⚠️ This tool sends a real <strong className="font-semibold">system_alert</strong> notification and a direct Web Push
        ping to each subscription for every user in scope. Use a staging base or filter to a single test user when possible.
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-xl font-semibold text-white">🧪 Notification diagnostic</h1>
        <p className="mt-1 text-sm text-white/60">Full pipeline check: env → Airtable → preferences → subscriptions → notify() → direct push.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void run(null)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Run all users
          </button>
          <button
            type="button"
            disabled={loading || !userFilter.trim()}
            onClick={() => void run(userFilter)}
            className="inline-flex items-center gap-2 rounded-xl border border-pink-500/30 bg-pink-500/15 px-4 py-2 text-sm font-medium text-pink-100 hover:bg-pink-500/25 disabled:opacity-50"
          >
            Run one user
          </button>
          <input
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            placeholder="Airtable user record id (rec…)"
            className="min-w-[200px] flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/35"
          />
          <button
            type="button"
            disabled={!data}
            onClick={exportJson}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15 disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            Export JSON
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>
      )}

      {loading && !data && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          ))}
        </div>
      )}

      {data && env && (
        <>
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Environment</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(env).map(([k, v]) => (
                <EnvPill key={k} ok={Boolean(v)} label={k} />
              ))}
            </div>
            <p className="mt-3 text-xs text-white/45">
              Required for push + Airtable: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, AIRTABLE_TOKEN, AIRTABLE_BASE_ID. ADMIN_AIRTABLE_USER_IDS
              is optional (admin broadcast only). VAPID_SUBJECT is optional (server uses a fixed contact in web-push).
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Airtable tables</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {tables &&
                Object.entries(tables).map(([name, t]) => <TablePill key={name} exists={t.exists} name={name} />)}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Summary</h2>
            <p className="mt-2 text-lg text-white">
              {summary?.fully_working ?? 0}/{summary?.total_users ?? 0} users fully passing ·{" "}
              <span className="text-red-300">{summary?.has_issues ?? 0} with issues</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <span
                className={cn(
                  "rounded-lg border px-2 py-1",
                  summary?.env_all_required ? "border-emerald-500/40 text-emerald-200" : "border-red-500/40 text-red-200"
                )}
              >
                Env required: {summary?.env_all_required ? "✅" : "❌"}
              </span>
              <span
                className={cn(
                  "rounded-lg border px-2 py-1",
                  summary?.airtable_tables_ok ? "border-emerald-500/40 text-emerald-200" : "border-red-500/40 text-red-200"
                )}
              >
                Tables: {summary?.airtable_tables_ok ? "✅" : "❌"}
              </span>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Per user</h2>
            {(data.users ?? []).length === 0 && (
              <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">No users in scope.</p>
            )}
            {(data.users ?? []).map((u) => (
              <UserCard key={u.id} user={u} />
            ))}
          </section>
        </>
      )}
    </div>
  );
}
