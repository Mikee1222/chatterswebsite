"use client";

import { useState, useCallback } from "react";

type CheckValue = {
  pass?: boolean;
  fix?: string | null;
  error?: string;
  results?: Array<{ pass?: boolean; error?: string }>;
  [key: string]: unknown;
};

type DiagnosticUser = {
  id: string;
  name: string;
  role: string;
  overall: string;
  checks: Record<string, CheckValue | CheckValue[]>;
};

type DiagnosticPayload = {
  status?: string;
  message?: string;
  env?: Record<string, boolean>;
  airtable_tables?: Record<string, { exists: boolean }>;
  summary?: { fully_working: number; has_issues: number; total_users: number };
  users?: DiagnosticUser[];
};

function checkRowPassed(val: CheckValue | CheckValue[] | undefined): boolean {
  if (val == null) return true;
  if (Array.isArray(val)) return val.every((x) => x.pass !== false);
  if (Array.isArray(val.results)) {
    const subsOk = val.results.every((x) => x.pass !== false);
    return val.pass !== false && subsOk;
  }
  return val.pass !== false;
}

export default function NotificationDiagnosticPage() {
  const [results, setResults] = useState<DiagnosticPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, string>>({});
  const [testingUser, setTestingUser] = useState<string | null>(null);

  const runDiagnostic = useCallback(async () => {
    setLoading(true);
    setResults(null);
    setFetchError(null);
    try {
      const res = await fetch("/api/debug/notification-diagnostic", { credentials: "include" });
      const data = (await res.json()) as DiagnosticPayload & { error?: string };
      if (!res.ok) {
        setFetchError(data?.error ?? `HTTP ${res.status}`);
        return;
      }
      setResults(data);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const sendTestPush = useCallback(async (userId: string, userName: string) => {
    setTestingUser(userId);
    try {
      const res = await fetch("/api/debug/test-notifications", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          event_type: "system_alert",
          title: "🧪 Test push notification",
          body: `Direct push test for ${userName} — ${new Date().toLocaleTimeString()}`,
          entity_type: "system",
          entity_id: `test_push:${userId}:${Date.now()}`,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      setTestResults((prev) => ({
        ...prev,
        [userId]: data.success ? "✅ Sent! Check device." : `❌ Failed: ${data.error ?? res.statusText}`,
      }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [userId]: `❌ Error: ${err instanceof Error ? err.message : String(err)}`,
      }));
    } finally {
      setTestingUser(null);
    }
  }, []);

  const sendTestToAll = useCallback(async () => {
    if (!results?.users?.length) return;
    for (const user of results.users) {
      await sendTestPush(user.id, user.name);
      await new Promise((r) => setTimeout(r, 500));
    }
  }, [results?.users, sendTestPush]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 pb-24">
      <div>
        <h1 className="text-3xl font-bold text-white">🧪 Notification diagnostic</h1>
        <p className="mt-1 text-sm text-white/50">
          Check pipeline and send real push notifications (admin session; test-notifications API may still require
          ENABLE_NOTIFICATION_TESTING in production).
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void runDiagnostic()}
          disabled={loading}
          className="rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "⏳ Running…" : "🔍 Run diagnostic"}
        </button>

        {results?.users && (
          <button
            type="button"
            onClick={() => void sendTestToAll()}
            disabled={!!testingUser}
            className="rounded-xl border border-white/20 bg-white/10 px-6 py-3 font-semibold text-white hover:bg-white/20 disabled:opacity-50"
          >
            📤 Send test push to ALL users
          </button>
        )}
      </div>

      {fetchError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{fetchError}</div>
      )}

      {results && results.status === "ok" && results.env === undefined && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {results.message ?? "Diagnostic API reachable (smoke test). Restore full GET in route for pipeline data."}
        </div>
      )}

      {results && results.env != null && (
        <>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">ENV variables</h2>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(results.env ?? {}).map(([key, val]) => (
                <div key={key} className="flex flex-wrap items-center gap-2 text-sm">
                  <span>{val ? "✅" : "❌"}</span>
                  <span className={val ? "text-white/70" : "font-semibold text-red-400"}>{key}</span>
                  {!val && <span className="text-xs text-red-400">← missing</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">Airtable tables</h2>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(results.airtable_tables ?? {}).map(([table, info]) => (
                <div key={table} className="flex items-center gap-2 text-sm">
                  <span>{info.exists ? "✅" : "❌"}</span>
                  <span className={info.exists ? "text-white/70" : "text-red-400"}>{table}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">Summary</h2>
            <div className="flex flex-wrap gap-8">
              <div>
                <div className="text-4xl font-bold text-green-400">{results.summary?.fully_working ?? 0}</div>
                <div className="mt-1 text-xs text-white/40">Fully working</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-red-400">{results.summary?.has_issues ?? 0}</div>
                <div className="mt-1 text-xs text-white/40">Have issues</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-white">{results.summary?.total_users ?? 0}</div>
                <div className="mt-1 text-xs text-white/40">Total users</div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">Per user</h2>
            {(results.users ?? []).map((user) => {
              const allPassed = String(user.overall).startsWith("✅");
              return (
                <div
                  key={user.id}
                  className={`rounded-2xl border bg-white/5 p-5 ${allPassed ? "border-green-500/20" : "border-red-500/20"}`}
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-lg font-bold text-white">{user.name}</span>
                      <span className="ml-2 text-sm capitalize text-white/40">({user.role})</span>
                    </div>
                    <span className={`text-sm font-semibold ${allPassed ? "text-green-400" : "text-red-400"}`}>
                      {user.overall}
                    </span>
                  </div>

                  <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {Object.entries(user.checks ?? {}).map(([check, val]) => {
                      const passed = checkRowPassed(val as CheckValue | CheckValue[]);
                      const v = val as CheckValue;
                      return (
                        <div key={check}>
                          <div className="flex items-center gap-2 text-sm">
                            <span>{passed ? "✅" : "❌"}</span>
                            <span className={passed ? "text-white/60" : "text-red-400"}>{check.replace(/_/g, " ")}</span>
                          </div>
                          {!passed && v?.fix && (
                            <div className="ml-6 mt-0.5 text-xs text-amber-400">→ {v.fix}</div>
                          )}
                          {!passed && v?.error && (
                            <div className="ml-6 mt-0.5 truncate text-xs text-red-400/60">Error: {v.error}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 border-t border-white/5 pt-3">
                    <button
                      type="button"
                      onClick={() => void sendTestPush(user.id, user.name)}
                      disabled={testingUser === user.id}
                      className="rounded-xl border border-pink-500/30 bg-pink-500/20 px-4 py-2 text-sm font-semibold text-pink-300 hover:bg-pink-500/30 disabled:opacity-50"
                    >
                      {testingUser === user.id ? "⏳ Sending…" : "📤 Send test push"}
                    </button>
                    {testResults[user.id] && (
                      <span
                        className={`text-sm font-medium ${
                          testResults[user.id].startsWith("✅") ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {testResults[user.id]}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
