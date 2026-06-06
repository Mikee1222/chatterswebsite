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

type DiagnosticResults = {
  env: Record<string, boolean>;
  airtable_tables: Record<string, { exists: boolean }>;
  summary: {
    fully_working: number;
    has_issues: number;
    total_users: number;
  };
  users: DiagnosticUser[];
};

function checkPassed(val: CheckValue | CheckValue[] | undefined): boolean {
  if (val == null) return true;
  if (Array.isArray(val)) return val.every((x) => x.pass !== false);
  if (Array.isArray(val.results)) return val.results.every((x) => x.pass !== false) && val.pass !== false;
  return val.pass !== false;
}

export function AdminNotificationDiagnosticClient() {
  const [results, setResults] = useState<DiagnosticResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostic = useCallback(async (userId?: string) => {
    setLoading(true);
    setError(null);
    const url = userId
      ? `/api/debug/notification-diagnostic?user_id=${encodeURIComponent(userId)}`
      : "/api/debug/notification-diagnostic";
    try {
      const res = await fetch(url, { credentials: "include" });
      const data = (await res.json()) as DiagnosticResults & { error?: string };
      if (!res.ok) {
        setResults(null);
        setError(data?.error ?? (res.status === 404 ? "Not found (diagnostic disabled in production?)" : `HTTP ${res.status}`));
        return;
      }
      setResults(data);
    } catch (e) {
      setResults(null);
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="mx-auto max-w-4xl p-6 pb-24">
      <div className="mb-6 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/95">
        Sends a real diagnostic notification and direct push per user in scope. Prefer filtering to one test user in
        staging.
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">Notification diagnostic</h1>
        <p className="mt-1 text-sm text-white/50">Full pipeline check for every user</p>
      </div>

      <button
        type="button"
        onClick={() => void runDiagnostic()}
        disabled={loading}
        className="mb-6 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Running diagnostic…" : "Run full diagnostic"}
      </button>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {results && (
        <div className="space-y-4">
          {/* ENV CHECKS */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">ENV checks</h2>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(results.env ?? {}).map(([key, val]) => (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <span>{val ? "" : ""}</span>
                  <span className={val ? "text-white/70" : "text-red-400"}>{key}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AIRTABLE TABLES */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">Airtable tables</h2>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(results.airtable_tables ?? {}).map(([table, info]) => (
                <div key={table} className="flex items-center gap-2 text-sm">
                  <span>{info.exists ? "" : ""}</span>
                  <span className={info.exists ? "text-white/70" : "text-red-400"}>{table}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SUMMARY */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">Summary</h2>
            <div className="flex flex-wrap gap-6">
              <div>
                <div className="text-3xl font-bold text-green-400">{results.summary?.fully_working ?? 0}</div>
                <div className="text-xs text-white/40">Fully working</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-red-400">{results.summary?.has_issues ?? 0}</div>
                <div className="text-xs text-white/40">Have issues</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">{results.summary?.total_users ?? 0}</div>
                <div className="text-xs text-white/40">Total users</div>
              </div>
            </div>
          </div>

          {/* PER USER */}
          <div className="space-y-3">
            {(results.users ?? []).map((user) => (
              <div
                key={user.id}
                className={`rounded-2xl border bg-white/5 p-5 ${
                  String(user.overall).startsWith("") ? "border-green-500/20" : "border-red-500/20"
                }`}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-white">{user.name}</span>
                    <span className="ml-2 text-sm text-white/40">({user.role})</span>
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      String(user.overall).startsWith("") ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {user.overall}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  {Object.entries(user.checks ?? {}).map(([check, val]) => {
                    const passed = checkPassed(val as CheckValue | CheckValue[]);
                    const v = val as CheckValue;
                    return (
                      <div key={check}>
                        <div className="flex items-center gap-2">
                          <span>{passed ? "" : ""}</span>
                          <span className={passed ? "text-white/60" : "text-red-400"}>{check}</span>
                        </div>
                        {!passed && v?.fix && (
                          <div className="ml-6 mt-1 text-xs text-amber-400">→ {v.fix}</div>
                        )}
                        {!passed && v?.error && (
                          <div className="ml-6 mt-1 text-xs text-red-400/80">Error: {v.error}</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!String(user.overall).startsWith("") && (
                  <button
                    type="button"
                    onClick={() => void runDiagnostic(user.id)}
                    disabled={loading}
                    className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50 hover:text-white disabled:opacity-50"
                  >
                    Re-test this user
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
