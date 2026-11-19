"use client";

import { useState, useTransition } from "react";

export type AgentTokenListItem = {
  id: string;
  token_prefix: string;
  label: string | null;
  created_by: string | null;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
};

function statusOf(t: AgentTokenListItem): "active" | "revoked" | "expired" {
  if (t.revoked_at) return "revoked";
  if (Date.parse(t.expires_at) <= Date.now()) return "expired";
  return "active";
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return iso;
  return new Date(d).toLocaleString();
}

export function AdminAgentTokensClient({
  initialTokens,
}: {
  initialTokens: AgentTokenListItem[];
}) {
  const [tokens, setTokens] = useState(initialTokens);
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const res = await fetch("/api/admin/agent-tokens");
      const data = (await res.json().catch(() => ({}))) as {
        tokens?: AgentTokenListItem[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Failed to refresh");
        return;
      }
      setTokens(data.tokens ?? []);
      setError(null);
    });
  }

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreatedToken(null);
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const res = await fetch("/api/admin/agent-tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_email: email.trim(), label: label.trim() || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        token?: string;
        error?: string;
        warning?: string;
      };
      if (!res.ok) {
        setError(data.error || "Create failed");
        return;
      }
      if (data.token) setCreatedToken(data.token);
      setEmail("");
      setLabel("");
      refresh();
    });
  }

  function onRevoke(id: string) {
    if (!confirm("Revoke this agent token? Hermes will lose API access with it.")) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/agent-tokens/${encodeURIComponent(id)}/revoke`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Revoke failed");
        return;
      }
      refresh();
    });
  }

  async function copyToken() {
    if (!createdToken) return;
    try {
      await navigator.clipboard.writeText(createdToken);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={onCreate} className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <h2 className="text-sm font-medium text-white">Create token</h2>
        <p className="text-xs text-white/45">
          User must have <code className="text-white/60">is_agent=true</code>. Token expires in 90 days.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            placeholder="hermes@…"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/35"
          />
          <input
            type="text"
            placeholder="Label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="sm:w-48 rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/35"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-white/90 px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            Create
          </button>
        </div>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {createdToken ? (
          <div className="space-y-2 rounded-md border border-amber-400/40 bg-amber-400/10 p-3">
            <p className="text-sm font-medium text-amber-100">
              Copy this token now — it will not be shown again.
            </p>
            <code className="block break-all text-xs text-white/90">{createdToken}</code>
            <button
              type="button"
              onClick={copyToken}
              className="rounded-md border border-white/20 px-3 py-1.5 text-xs text-white"
            >
              {copied ? "Copied" : "Copy token"}
            </button>
          </div>
        ) : null}
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm text-white/80">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/45">
            <tr>
              <th className="py-2 pr-3 font-medium">Prefix</th>
              <th className="py-2 pr-3 font-medium">Label</th>
              <th className="py-2 pr-3 font-medium">Created</th>
              <th className="py-2 pr-3 font-medium">Last used</th>
              <th className="py-2 pr-3 font-medium">Expires</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {tokens.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-white/40">
                  No tokens yet.
                </td>
              </tr>
            ) : (
              tokens.map((t) => {
                const st = statusOf(t);
                return (
                  <tr key={t.id} className="border-b border-white/5">
                    <td className="py-2.5 pr-3 font-mono text-xs">{t.token_prefix}…</td>
                    <td className="py-2.5 pr-3">{t.label || "—"}</td>
                    <td className="py-2.5 pr-3 text-xs text-white/55">{fmt(t.created_at)}</td>
                    <td className="py-2.5 pr-3 text-xs text-white/55">{fmt(t.last_used_at)}</td>
                    <td className="py-2.5 pr-3 text-xs text-white/55">{fmt(t.expires_at)}</td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={
                          st === "active"
                            ? "text-emerald-300"
                            : st === "revoked"
                              ? "text-white/40"
                              : "text-amber-300"
                        }
                      >
                        {st}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      {st === "active" ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => onRevoke(t.id)}
                          className="text-xs text-red-300 hover:underline disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
