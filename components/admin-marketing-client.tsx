"use client";

import * as React from "react";
import { Check, ChevronDown, Plus, Pencil, Trash2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  FunnelLink,
  MarketingPlatform,
  ShadowbanReport,
  SocialAccount,
  SocialAccountStatus,
} from "@/services/marketing";
import type { ModelRecord, UserRecord } from "@/types";

type Tab = "platforms" | "accounts" | "funnels" | "reports";

const REGIONS = ["USA", "Greek", "Global"] as const;
const ACCOUNT_TYPES = ["main", "secondary"] as const;

const STATUS_CONFIG: Record<
  SocialAccountStatus,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  active: {
    label: "Active",
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    dot: "bg-green-400",
  },
  shadowbanned: {
    label: "Shadowbanned",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    dot: "bg-amber-400",
  },
  banned: {
    label: "Banned",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    dot: "bg-red-500",
  },
};

const PLATFORM_ICONS: Record<string, string> = {
  Instagram: "📸",
  Facebook: "👥",
  TikTok: "🎵",
  Twitter: "🐦",
  YouTube: "▶️",
  Snapchat: "👻",
  Telegram: "✈️",
  GetMyLinks: "🔗",
  Other: "📱",
};

function pill(active: boolean) {
  return cn(
    "rounded-full px-4 py-2 text-sm font-medium transition-colors",
    active ? "bg-pink-500/25 text-pink-200 ring-1 ring-pink-400/40" : "text-white/60 hover:bg-white/5 hover:text-white/90",
  );
}

export function AdminMarketingClient({
  platforms: initialPlatforms,
  accounts: initialAccounts,
  funnels: initialFunnels,
  models,
  vaUsers,
}: {
  platforms: MarketingPlatform[];
  accounts: SocialAccount[];
  funnels: FunnelLink[];
  models: ModelRecord[];
  vaUsers: UserRecord[];
}) {
  const [tab, setTab] = React.useState<Tab>("accounts");
  const [platforms, setPlatforms] = React.useState(initialPlatforms);
  const [accounts, setAccounts] = React.useState(initialAccounts);
  const [funnels, setFunnels] = React.useState(initialFunnels);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const modelNameById = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const x of models) m[x.id] = x.model_name || x.model_id || x.id;
    return m;
  }, [models]);

  const platformNames = React.useMemo(
    () => [...new Set(platforms.map((p) => p.name).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [platforms],
  );

  // —— Platforms ——
  const [pName, setPName] = React.useState("");
  const [pIcon, setPIcon] = React.useState("📱");
  const [pColor, setPColor] = React.useState("#ec4899");
  const [pSort, setPSort] = React.useState(99);
  const [editPlatform, setEditPlatform] = React.useState<MarketingPlatform | null>(null);

  async function addPlatform(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("platform-add");
    try {
      const res = await fetch("/api/admin/marketing/platforms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: pName.trim(), icon: pIcon, color: pColor, sort_order: pSort }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { platform: MarketingPlatform };
      setPlatforms((prev) => [...prev, data.platform].sort((a, b) => a.sort_order - b.sort_order));
      setPName("");
      setPIcon("📱");
      setPColor("#ec4899");
      setPSort(99);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add platform");
    } finally {
      setBusy(null);
    }
  }

  async function patchPlatform(id: string, body: Partial<MarketingPlatform>) {
    setError(null);
    setBusy(`platform-${id}`);
    try {
      const res = await fetch(`/api/admin/marketing/platforms/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setPlatforms((prev) => prev.map((p) => (p.id === id ? { ...p, ...body } : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  // —— Accounts ——
  const [accSearch, setAccSearch] = React.useState("");
  const [accModel, setAccModel] = React.useState("");
  const [accVa, setAccVa] = React.useState("");
  const [accPlatform, setAccPlatform] = React.useState("");
  const [aModelId, setAModelId] = React.useState("");
  const [aPlatform, setAPlatform] = React.useState("");
  const [aUsername, setAUsername] = React.useState("");
  const [aLink, setALink] = React.useState("");
  const [aType, setAType] = React.useState<"main" | "secondary">("main");
  const [aRegion, setARegion] = React.useState<(typeof REGIONS)[number]>("Global");
  const [aVaId, setAVaId] = React.useState("");
  const [aNotes, setANotes] = React.useState("");
  const [editAccount, setEditAccount] = React.useState<SocialAccount | null>(null);
  const [reports, setReports] = React.useState<ShadowbanReport[]>([]);
  const [shadowbanReportTarget, setShadowbanReportTarget] = React.useState<SocialAccount | null>(null);
  const [shadowbanFile, setShadowbanFile] = React.useState<File | null>(null);
  const [shadowbanNotes, setShadowbanNotes] = React.useState("");
  const [shadowbanSubmitting, setShadowbanSubmitting] = React.useState(false);
  const shadowbanProofRef = React.useRef<HTMLInputElement>(null);
  const shadowbanPreviewUrl = React.useMemo(
    () => (shadowbanFile ? URL.createObjectURL(shadowbanFile) : null),
    [shadowbanFile],
  );
  React.useEffect(() => {
    return () => {
      if (shadowbanPreviewUrl) URL.revokeObjectURL(shadowbanPreviewUrl);
    };
  }, [shadowbanPreviewUrl]);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/marketing/shadowban-reports", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { reports?: ShadowbanReport[] }) => {
        if (!cancelled) setReports(d.reports ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (!shadowbanReportTarget) return;
      const found = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      if (found) {
        const f = found.getAsFile();
        if (f) setShadowbanFile(f);
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [shadowbanReportTarget]);

  const filteredAccounts = React.useMemo(() => {
    const q = accSearch.trim().toLowerCase();
    return accounts.filter((a) => {
      if (accModel && a.model_id !== accModel) return false;
      if (accVa && a.assigned_va_id !== accVa) return false;
      if (accPlatform && a.platform !== accPlatform) return false;
      if (!q) return true;
      return `${a.model_name} ${a.platform} ${a.username} ${a.account_link} ${a.notes}`.toLowerCase().includes(q);
    });
  }, [accounts, accSearch, accModel, accVa, accPlatform]);

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!aModelId || !aPlatform.trim() || !aUsername.trim()) {
      setError("Model, platform, and username are required.");
      return;
    }
    setError(null);
    setBusy("account-add");
    const va = vaUsers.find((u) => u.id === aVaId);
    try {
      const res = await fetch("/api/admin/marketing/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_id: aModelId,
          model_name: modelNameById[aModelId] ?? "",
          platform: aPlatform.trim(),
          account_link: aLink.trim(),
          username: aUsername.trim(),
          account_type: aType,
          region: aRegion,
          assigned_va_id: aVaId || "",
          assigned_va_name: va?.full_name?.trim() || va?.email || "",
          notes: aNotes.trim(),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { account: SocialAccount };
      setAccounts((prev) => [data.account, ...prev]);
      setAPlatform("");
      setAUsername("");
      setALink("");
      setAVaId("");
      setANotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add account");
    } finally {
      setBusy(null);
    }
  }

  async function patchAccount(id: string, body: Partial<SocialAccount>) {
    setError(null);
    setBusy(`account-${id}`);
    try {
      const res = await fetch(`/api/admin/marketing/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...body } : a)));
      setEditAccount((cur) => (cur?.id === id ? { ...cur, ...body } : cur));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleUpdateAccountStatus(accountId: string, status: SocialAccountStatus) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/marketing/accounts/${encodeURIComponent(accountId)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ account_status: status }),
      });
      if (!res.ok) throw new Error(await res.text());
      setAccounts((prev) => prev.map((a) => (a.id === accountId ? { ...a, account_status: status } : a)));
      setEditAccount((cur) => (cur?.id === accountId ? { ...cur, account_status: status } : cur));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed");
    }
  }

  async function handleReviewReport(reportId: string, action: "approve" | "dismiss") {
    const reportBefore = reports.find((r) => r.id === reportId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/marketing/shadowban-reports/${encodeURIComponent(reportId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(await res.text());
      const listRes = await fetch("/api/admin/marketing/shadowban-reports", { credentials: "include" });
      const listData = (await listRes.json()) as { reports?: ShadowbanReport[] };
      setReports(listData.reports ?? []);
      if (action === "approve" && reportBefore) {
        setAccounts((prev) =>
          prev.map((a) =>
            a.account_id === reportBefore.account_id ? { ...a, account_status: "shadowbanned" as const } : a,
          ),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    }
  }

  async function handleSubmitShadowbanReportAdmin() {
    if (!shadowbanReportTarget || !shadowbanFile) return;
    setShadowbanSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("account_id", shadowbanReportTarget.account_id);
      fd.append("model_id", shadowbanReportTarget.model_id);
      fd.append("model_name", shadowbanReportTarget.model_name);
      fd.append("platform", shadowbanReportTarget.platform);
      fd.append("username", shadowbanReportTarget.username);
      fd.append("notes", shadowbanNotes);
      fd.append("screenshot", shadowbanFile);
      const res = await fetch("/api/va/marketing/report-shadowban", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      const listRes = await fetch("/api/admin/marketing/shadowban-reports", { credentials: "include" });
      const listData = (await listRes.json()) as { reports?: ShadowbanReport[] };
      setReports(listData.reports ?? []);
      setShadowbanReportTarget(null);
      setShadowbanFile(null);
      setShadowbanNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report failed");
    } finally {
      setShadowbanSubmitting(false);
    }
  }

  async function removeAccount(id: string) {
    if (!confirm("Deactivate this social account?")) return;
    setError(null);
    setBusy(`account-del-${id}`);
    try {
      const res = await fetch(`/api/admin/marketing/accounts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, active: false } : a)));
      setEditAccount((c) => (c?.id === id ? null : c));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  }

  // —— Funnels ——
  const [fModelId, setFModelId] = React.useState("");
  const [fLabel, setFLabel] = React.useState("");
  const [fUrl, setFUrl] = React.useState("");
  const [fPlatform, setFPlatform] = React.useState("");
  const [fRegion, setFRegion] = React.useState<(typeof REGIONS)[number]>("Global");
  const [editFunnel, setEditFunnel] = React.useState<FunnelLink | null>(null);

  async function addFunnel(e: React.FormEvent) {
    e.preventDefault();
    if (!fModelId || !fLabel.trim() || !fUrl.trim()) {
      setError("Model, label, and URL are required.");
      return;
    }
    setError(null);
    setBusy("funnel-add");
    try {
      const res = await fetch("/api/admin/marketing/funnels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_id: fModelId,
          model_name: modelNameById[fModelId] ?? "",
          label: fLabel.trim(),
          url: fUrl.trim(),
          platform: fPlatform.trim(),
          region: fRegion,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { funnel: FunnelLink };
      setFunnels((prev) => [data.funnel, ...prev]);
      setFLabel("");
      setFUrl("");
      setFPlatform("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add funnel");
    } finally {
      setBusy(null);
    }
  }

  async function patchFunnel(id: string, body: Partial<FunnelLink>) {
    setError(null);
    setBusy(`funnel-${id}`);
    try {
      const res = await fetch(`/api/admin/marketing/funnels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setFunnels((prev) => prev.map((f) => (f.id === id ? { ...f, ...body } : f)));
      setEditFunnel((c) => (c?.id === id ? { ...c, ...body } : c));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  async function removeFunnel(id: string) {
    if (!confirm("Deactivate this funnel link?")) return;
    setError(null);
    setBusy(`funnel-del-${id}`);
    try {
      const res = await fetch(`/api/admin/marketing/funnels/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setFunnels((prev) => prev.map((f) => (f.id === id ? { ...f, active: false } : f)));
      setEditFunnel((c) => (c?.id === id ? null : c));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  }

  const selectClass =
    "rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-pink-400/50";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Marketing</h1>
        <p className="mt-1 text-sm text-white/55">Platforms, model social accounts, and funnel links.</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        <button type="button" className={pill(tab === "accounts")} onClick={() => setTab("accounts")}>
          Social accounts
        </button>
        <button type="button" className={pill(tab === "reports")} onClick={() => setTab("reports")}>
          Shadowban reports
        </button>
        <button type="button" className={pill(tab === "funnels")} onClick={() => setTab("funnels")}>
          Funnel links
        </button>
        <button type="button" className={pill(tab === "platforms")} onClick={() => setTab("platforms")}>
          Platforms
        </button>
      </div>

      {tab === "platforms" ? (
        <div className="space-y-6">
          <form
            onSubmit={addPlatform}
            className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          >
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">Add platform</h2>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs text-white/50">
                Name
                <input
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  className={selectClass}
                  placeholder="Instagram"
                  required
                />
              </label>
              <label className="flex w-24 flex-col gap-1 text-xs text-white/50">
                Icon
                <input value={pIcon} onChange={(e) => setPIcon(e.target.value)} className={selectClass} />
              </label>
              <label className="flex w-28 flex-col gap-1 text-xs text-white/50">
                Color
                <input
                  type="color"
                  value={pColor}
                  onChange={(e) => setPColor(e.target.value)}
                  className="h-10 w-full cursor-pointer rounded-xl border border-white/15 bg-black/40"
                />
              </label>
              <label className="flex w-24 flex-col gap-1 text-xs text-white/50">
                Sort
                <input
                  type="number"
                  value={pSort}
                  onChange={(e) => setPSort(Number(e.target.value))}
                  className={selectClass}
                />
              </label>
              <button
                type="submit"
                disabled={busy === "platform-add"}
                className="inline-flex items-center gap-2 rounded-xl bg-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 transition hover:bg-pink-400 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>
          </form>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-zinc-950/40">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/45">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Icon</th>
                  <th className="px-4 py-3">Color</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3 w-32">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white/85">
                {platforms.map((p) => (
                  <React.Fragment key={p.id}>
                    <tr>
                      <td className="px-4 py-3 tabular-nums">{p.sort_order}</td>
                      <td className="px-4 py-3 font-medium text-white">{p.name}</td>
                      <td className="px-4 py-3 text-lg">{p.icon}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-5 w-5 rounded border border-white/20"
                            style={{ backgroundColor: p.color }}
                          />
                          <span className="font-mono text-xs text-white/55">{p.color}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => patchPlatform(p.id, { active: !p.active })}
                          disabled={busy === `platform-${p.id}`}
                          className={cn(
                            "rounded-lg px-2 py-1 text-xs font-medium",
                            p.active ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/50",
                          )}
                        >
                          {p.active ? "On" : "Off"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setEditPlatform((cur) => (cur?.id === p.id ? null : p))}
                          className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                    {editPlatform?.id === p.id ? (
                      <tr className="bg-white/[0.03]">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="flex flex-wrap items-end gap-3">
                            <label className="flex min-w-[120px] flex-1 flex-col gap-1 text-xs text-white/50">
                              Name
                              <input
                                value={editPlatform.name}
                                onChange={(e) => setEditPlatform({ ...editPlatform, name: e.target.value })}
                                className={selectClass}
                              />
                            </label>
                            <label className="flex w-24 flex-col gap-1 text-xs text-white/50">
                              Icon
                              <input
                                value={editPlatform.icon}
                                onChange={(e) => setEditPlatform({ ...editPlatform, icon: e.target.value })}
                                className={selectClass}
                              />
                            </label>
                            <label className="flex w-28 flex-col gap-1 text-xs text-white/50">
                              Color
                              <input
                                type="color"
                                value={editPlatform.color}
                                onChange={(e) => setEditPlatform({ ...editPlatform, color: e.target.value })}
                                className="h-10 w-full cursor-pointer rounded-xl border border-white/15"
                              />
                            </label>
                            <label className="flex w-24 flex-col gap-1 text-xs text-white/50">
                              Sort
                              <input
                                type="number"
                                value={editPlatform.sort_order}
                                onChange={(e) =>
                                  setEditPlatform({ ...editPlatform, sort_order: Number(e.target.value) })
                                }
                                className={selectClass}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={async () => {
                                await patchPlatform(editPlatform.id, {
                                  name: editPlatform.name,
                                  icon: editPlatform.icon,
                                  color: editPlatform.color,
                                  sort_order: editPlatform.sort_order,
                                });
                                setEditPlatform(null);
                              }}
                              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
                            >
                              Save
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "accounts" ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-zinc-950/50 px-4 py-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                value={accSearch}
                onChange={(e) => setAccSearch(e.target.value)}
                placeholder="Search…"
                className={cn(selectClass, "w-full pl-10")}
              />
            </div>
            <select value={accModel} onChange={(e) => setAccModel(e.target.value)} className={selectClass}>
              <option value="">All models</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.model_name || m.model_id}
                </option>
              ))}
            </select>
            <select value={accVa} onChange={(e) => setAccVa(e.target.value)} className={selectClass}>
              <option value="">All VAs</option>
              {vaUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.email}
                </option>
              ))}
            </select>
            <select value={accPlatform} onChange={(e) => setAccPlatform(e.target.value)} className={selectClass}>
              <option value="">All platforms</option>
              {platformNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <form
            onSubmit={addAccount}
            className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          >
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">Add social account</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="flex flex-col gap-1 text-xs text-white/50">
                Model
                <select
                  value={aModelId}
                  onChange={(e) => setAModelId(e.target.value)}
                  className={selectClass}
                  required
                >
                  <option value="">Select…</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.model_name || m.model_id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50">
                Platform
                <input
                  value={aPlatform}
                  onChange={(e) => setAPlatform(e.target.value)}
                  className={selectClass}
                  list="platform-name-list"
                  placeholder="e.g. Instagram"
                  required
                />
                <datalist id="platform-name-list">
                  {platformNames.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50">
                Username
                <input value={aUsername} onChange={(e) => setAUsername(e.target.value)} className={selectClass} required />
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50">
                Link
                <input value={aLink} onChange={(e) => setALink(e.target.value)} className={selectClass} placeholder="https://…" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50">
                Type
                <select value={aType} onChange={(e) => setAType(e.target.value as "main" | "secondary")} className={selectClass}>
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50">
                Region
                <select value={aRegion} onChange={(e) => setARegion(e.target.value as (typeof REGIONS)[number])} className={selectClass}>
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50">
                Assigned VA
                <select value={aVaId} onChange={(e) => setAVaId(e.target.value)} className={selectClass}>
                  <option value="">—</option>
                  {vaUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.email}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50 sm:col-span-2 lg:col-span-3">
                Notes
                <input value={aNotes} onChange={(e) => setANotes(e.target.value)} className={selectClass} />
              </label>
            </div>
            <div className="mt-4">
              <button
                type="submit"
                disabled={busy === "account-add"}
                className="inline-flex items-center gap-2 rounded-xl bg-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 hover:bg-pink-400 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Add account
              </button>
            </div>
          </form>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-zinc-950/40">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/45">
                <tr>
                  <th className="px-3 py-3">Model</th>
                  <th className="px-3 py-3">Platform</th>
                  <th className="px-3 py-3">Username</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Region</th>
                  <th className="px-3 py-3">VA</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-white/25">
                    Status
                  </th>
                  <th className="px-3 py-3">Active</th>
                  <th className="px-3 py-3 w-36"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white/85">
                {filteredAccounts.map((a) => (
                  <React.Fragment key={a.id}>
                    <tr className={!a.active ? "opacity-50" : undefined}>
                      <td className="px-3 py-2.5">{a.model_name || modelNameById[a.model_id] || a.model_id}</td>
                      <td className="px-3 py-2.5">{a.platform}</td>
                      <td className="px-3 py-2.5">
                        {a.account_link ? (
                          <a href={a.account_link} className="text-pink-300 hover:underline" target="_blank" rel="noreferrer">
                            @{a.username}
                          </a>
                        ) : (
                          <span>@{a.username}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 capitalize">{a.account_type}</td>
                      <td className="px-3 py-2.5">{a.region}</td>
                      <td className="px-3 py-2.5 text-xs text-white/60">{a.assigned_va_name || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="group/status relative">
                          {(() => {
                            const st = (a.account_status ?? "active") as SocialAccountStatus;
                            const cfg = STATUS_CONFIG[st];
                            return (
                              <div
                                className={cn(
                                  "flex w-fit cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-1.5",
                                  cfg.bg,
                                  cfg.border,
                                )}
                              >
                                <div className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
                                <span className={cn("text-xs font-semibold", cfg.color)}>{cfg.label}</span>
                                <ChevronDown className={cn("h-3 w-3 opacity-50", cfg.color)} aria-hidden />
                              </div>
                            );
                          })()}
                          <div className="absolute left-0 top-full z-20 mt-1 hidden min-w-[9rem] rounded-xl border border-white/15 bg-[#0f0f1a] p-1 shadow-2xl group-hover/status:block">
                            {(["active", "shadowbanned", "banned"] as const).map((status) => {
                              const cfg = STATUS_CONFIG[status];
                              return (
                                <button
                                  key={status}
                                  type="button"
                                  onClick={() => void handleUpdateAccountStatus(a.id, status)}
                                  className={cn(
                                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all hover:bg-white/5",
                                    cfg.color,
                                    (a.account_status ?? "active") === status ? "bg-white/5" : "",
                                  )}
                                >
                                  <div className={cn("h-2 w-2 rounded-full", cfg.dot)} />
                                  {cfg.label}
                                  {(a.account_status ?? "active") === status ? (
                                    <Check className="ml-auto h-3 w-3" aria-hidden />
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => patchAccount(a.id, { active: !a.active })}
                          disabled={busy === `account-${a.id}`}
                          className={cn(
                            "rounded-lg px-2 py-1 text-xs font-medium",
                            a.active ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/50",
                          )}
                        >
                          {a.active ? "On" : "Off"}
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {(a.account_status ?? "active") === "active" ? (
                            <button
                              type="button"
                              onClick={() => {
                                setShadowbanReportTarget(a);
                                setShadowbanFile(null);
                                setShadowbanNotes("");
                              }}
                              className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-400 hover:bg-amber-500/20"
                            >
                              Report
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => setEditAccount((c) => (c?.id === a.id ? null : a))}
                            className="rounded-lg p-2 text-white/60 hover:bg-white/10"
                            aria-label="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeAccount(a.id)}
                            disabled={busy?.startsWith("account-del")}
                            className="rounded-lg p-2 text-red-400/80 hover:bg-red-500/10"
                            aria-label="Deactivate"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editAccount?.id === a.id ? (
                      <tr className="bg-white/[0.03]">
                        <td colSpan={9} className="px-3 py-4">
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <label className="flex flex-col gap-1 text-xs text-white/50">
                              Username
                              <input
                                value={editAccount.username}
                                onChange={(e) => setEditAccount({ ...editAccount, username: e.target.value })}
                                className={selectClass}
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs text-white/50 sm:col-span-2">
                              Link
                              <input
                                value={editAccount.account_link}
                                onChange={(e) => setEditAccount({ ...editAccount, account_link: e.target.value })}
                                className={selectClass}
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs text-white/50">
                              Platform
                              <input
                                value={editAccount.platform}
                                onChange={(e) => setEditAccount({ ...editAccount, platform: e.target.value })}
                                className={selectClass}
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs text-white/50">
                              Type
                              <select
                                value={editAccount.account_type}
                                onChange={(e) =>
                                  setEditAccount({ ...editAccount, account_type: e.target.value as "main" | "secondary" })
                                }
                                className={selectClass}
                              >
                                {ACCOUNT_TYPES.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1 text-xs text-white/50">
                              Region
                              <select
                                value={editAccount.region}
                                onChange={(e) =>
                                  setEditAccount({
                                    ...editAccount,
                                    region: e.target.value as SocialAccount["region"],
                                  })
                                }
                                className={selectClass}
                              >
                                {REGIONS.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1 text-xs text-white/50">
                              Assigned VA
                              <select
                                value={editAccount.assigned_va_id}
                                onChange={(e) => {
                                  const id = e.target.value;
                                  const u = vaUsers.find((x) => x.id === id);
                                  setEditAccount({
                                    ...editAccount,
                                    assigned_va_id: id,
                                    assigned_va_name: u?.full_name?.trim() || u?.email || "",
                                  });
                                }}
                                className={selectClass}
                              >
                                <option value="">—</option>
                                {vaUsers.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.full_name || u.email}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1 text-xs text-white/50 sm:col-span-2 lg:col-span-4">
                              Notes
                              <input
                                value={editAccount.notes}
                                onChange={(e) => setEditAccount({ ...editAccount, notes: e.target.value })}
                                className={selectClass}
                              />
                            </label>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                await patchAccount(editAccount.id, {
                                  username: editAccount.username,
                                  account_link: editAccount.account_link,
                                  platform: editAccount.platform,
                                  account_type: editAccount.account_type,
                                  region: editAccount.region,
                                  assigned_va_id: editAccount.assigned_va_id,
                                  assigned_va_name: editAccount.assigned_va_name,
                                  notes: editAccount.notes,
                                });
                                setEditAccount(null);
                              }}
                              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
                            >
                              Save changes
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditAccount(null)}
                              className="rounded-xl px-4 py-2 text-sm text-white/60 hover:bg-white/5"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "reports" ? (
        <div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Shadowban reports</h2>
              <p className="text-sm text-white/40">Submitted by VAs — review and approve</p>
            </div>
            {reports.filter((r) => r.status === "pending").length > 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/15 px-3 py-1.5">
                <div className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                <span className="text-sm font-semibold text-amber-400">
                  {reports.filter((r) => r.status === "pending").length} pending
                </span>
              </div>
            ) : null}
          </div>

          {reports.length === 0 ? (
            <div className="py-16 text-center text-white/20">
              <p className="mb-3 text-4xl">✅</p>
              <p>No shadowban reports</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className={cn(
                    "rounded-2xl border p-5",
                    report.status === "pending"
                      ? "border-amber-500/20 bg-amber-500/[0.03]"
                      : report.status === "approved"
                        ? "border-red-500/15 bg-red-500/[0.02] opacity-70"
                        : "border-white/8 opacity-50",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="text-xl">{PLATFORM_ICONS[report.platform] ?? "📱"}</span>
                        <span className="font-bold text-white">@{report.username}</span>
                        <span className="text-sm text-white/40">{report.platform}</span>
                        <span className="text-xs text-white/30">·</span>
                        <span className="text-sm text-white/40">{report.model_name || "—"}</span>
                        <span
                          className={cn(
                            "ml-auto rounded-full border px-2 py-0.5 text-xs font-semibold",
                            report.status === "pending"
                              ? "border-amber-500/25 bg-amber-500/15 text-amber-400"
                              : report.status === "approved"
                                ? "border-red-500/25 bg-red-500/15 text-red-400"
                                : "border-white/10 bg-white/5 text-white/30",
                          )}
                        >
                          {report.status}
                        </span>
                      </div>
                      <div className="mb-3 flex flex-wrap gap-3 text-xs text-white/30">
                        <span>
                          Reported by {report.reported_by_name} ({report.reported_by_role})
                        </span>
                        <span>·</span>
                        <span>
                          {report.created_at
                            ? new Date(report.created_at).toLocaleString("el-GR", { timeZone: "Europe/Athens" })
                            : "—"}
                        </span>
                      </div>
                      {report.notes ? (
                        <p className="mb-3 rounded-xl bg-white/5 px-3 py-2 text-sm text-white/50">&ldquo;{report.notes}&rdquo;</p>
                      ) : null}
                      {report.screenshot?.[0]?.url ? (
                        <a
                          href={report.screenshot[0].url}
                          target="_blank"
                          rel="noreferrer"
                          className="mb-3 inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
                        >
                          🖼 View screenshot
                        </a>
                      ) : null}
                    </div>
                    {report.screenshot?.[0]?.url ? (
                      <a
                        href={report.screenshot[0].url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 transition-opacity hover:opacity-80"
                      >
                        <img
                          src={report.screenshot[0].url}
                          alt=""
                          className="h-16 w-24 rounded-xl border border-white/10 object-cover"
                        />
                      </a>
                    ) : null}
                  </div>
                  {report.status === "pending" ? (
                    <div className="mt-3 flex gap-2 border-t border-white/8 pt-3">
                      <button
                        type="button"
                        onClick={() => void handleReviewReport(report.id, "approve")}
                        className="flex-1 rounded-xl border border-red-500/30 bg-red-500/20 py-2 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/30"
                      >
                        Approve — mark as shadowbanned
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleReviewReport(report.id, "dismiss")}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/40 transition-all hover:bg-white/10"
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : null}
                  {report.status !== "pending" && report.reviewed_by ? (
                    <p className="mt-2 border-t border-white/5 pt-2 text-xs text-white/20">
                      Reviewed by {report.reviewed_by}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === "funnels" ? (
        <div className="space-y-6">
          <form
            onSubmit={addFunnel}
            className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          >
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">Add funnel link</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="flex flex-col gap-1 text-xs text-white/50">
                Model
                <select value={fModelId} onChange={(e) => setFModelId(e.target.value)} className={selectClass} required>
                  <option value="">Select…</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.model_name || m.model_id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50">
                Label
                <input value={fLabel} onChange={(e) => setFLabel(e.target.value)} className={selectClass} required />
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50 sm:col-span-2 lg:col-span-3">
                URL
                <input value={fUrl} onChange={(e) => setFUrl(e.target.value)} className={selectClass} required />
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50">
                Platform
                <input
                  value={fPlatform}
                  onChange={(e) => setFPlatform(e.target.value)}
                  className={selectClass}
                  list="platform-name-list-funnel"
                />
                <datalist id="platform-name-list-funnel">
                  {platformNames.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50">
                Region
                <select value={fRegion} onChange={(e) => setFRegion(e.target.value as (typeof REGIONS)[number])} className={selectClass}>
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4">
              <button
                type="submit"
                disabled={busy === "funnel-add"}
                className="inline-flex items-center gap-2 rounded-xl bg-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 hover:bg-pink-400 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Add funnel
              </button>
            </div>
          </form>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-zinc-950/40">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/45">
                <tr>
                  <th className="px-3 py-3">Model</th>
                  <th className="px-3 py-3">Label</th>
                  <th className="px-3 py-3">URL</th>
                  <th className="px-3 py-3">Platform</th>
                  <th className="px-3 py-3">Region</th>
                  <th className="px-3 py-3">Active</th>
                  <th className="px-3 py-3 w-24"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white/85">
                {funnels.map((f) => (
                  <React.Fragment key={f.id}>
                    <tr className={!f.active ? "opacity-50" : undefined}>
                      <td className="px-3 py-2.5">{f.model_name || modelNameById[f.model_id] || f.model_id}</td>
                      <td className="px-3 py-2.5 font-medium text-white">{f.label}</td>
                      <td className="max-w-[220px] truncate px-3 py-2.5">
                        <a href={f.url} className="text-pink-300 hover:underline" target="_blank" rel="noreferrer">
                          {f.url}
                        </a>
                      </td>
                      <td className="px-3 py-2.5">{f.platform || "—"}</td>
                      <td className="px-3 py-2.5">{f.region}</td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => patchFunnel(f.id, { active: !f.active })}
                          disabled={busy === `funnel-${f.id}`}
                          className={cn(
                            "rounded-lg px-2 py-1 text-xs font-medium",
                            f.active ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/50",
                          )}
                        >
                          {f.active ? "On" : "Off"}
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setEditFunnel((c) => (c?.id === f.id ? null : f))}
                            className="rounded-lg p-2 text-white/60 hover:bg-white/10"
                            aria-label="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFunnel(f.id)}
                            className="rounded-lg p-2 text-red-400/80 hover:bg-red-500/10"
                            aria-label="Deactivate"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editFunnel?.id === f.id ? (
                      <tr className="bg-white/[0.03]">
                        <td colSpan={7} className="px-3 py-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="flex flex-col gap-1 text-xs text-white/50">
                              Label
                              <input
                                value={editFunnel.label}
                                onChange={(e) => setEditFunnel({ ...editFunnel, label: e.target.value })}
                                className={selectClass}
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs text-white/50 sm:col-span-2">
                              URL
                              <input
                                value={editFunnel.url}
                                onChange={(e) => setEditFunnel({ ...editFunnel, url: e.target.value })}
                                className={selectClass}
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs text-white/50">
                              Platform
                              <input
                                value={editFunnel.platform}
                                onChange={(e) => setEditFunnel({ ...editFunnel, platform: e.target.value })}
                                className={selectClass}
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs text-white/50">
                              Region
                              <select
                                value={editFunnel.region}
                                onChange={(e) =>
                                  setEditFunnel({ ...editFunnel, region: e.target.value as FunnelLink["region"] })
                                }
                                className={selectClass}
                              >
                                {REGIONS.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                await patchFunnel(editFunnel.id, {
                                  label: editFunnel.label,
                                  url: editFunnel.url,
                                  platform: editFunnel.platform,
                                  region: editFunnel.region,
                                });
                                setEditFunnel(null);
                              }}
                              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditFunnel(null)}
                              className="rounded-xl px-4 py-2 text-sm text-white/60 hover:bg-white/5"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {shadowbanReportTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#0f0f1a] p-6 shadow-2xl">
            <h3 className="mb-1 text-lg font-bold text-white">Report shadowban</h3>
            <div className="mb-5 flex items-center gap-2">
              <span className="text-xl">{PLATFORM_ICONS[shadowbanReportTarget.platform] ?? "📱"}</span>
              <p className="text-sm text-white/50">
                @{shadowbanReportTarget.username} · {shadowbanReportTarget.platform}
              </p>
            </div>
            <div className="mb-4">
              <label className="mb-2 block text-xs uppercase tracking-widest text-white/40">
                Screenshot <span className="text-amber-400">*</span>
              </label>
              <button
                type="button"
                onClick={() => shadowbanProofRef.current?.click()}
                className={cn(
                  "w-full cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center transition-all",
                  shadowbanFile ? "border-amber-500/40 bg-amber-500/5" : "border-white/15 hover:border-amber-500/40 hover:bg-amber-500/5",
                )}
              >
                {shadowbanPreviewUrl ? (
                  <img
                    src={shadowbanPreviewUrl}
                    alt=""
                    className="mx-auto max-h-28 rounded-xl object-contain"
                  />
                ) : (
                  <>
                    <p className="mb-1 text-2xl">📋</p>
                    <p className="text-sm text-white/40">Paste (Ctrl+V) or click</p>
                  </>
                )}
              </button>
              <input
                ref={shadowbanProofRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setShadowbanFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="mb-5">
              <label className="mb-2 block text-xs uppercase tracking-widest text-white/40">Notes</label>
              <textarea
                value={shadowbanNotes}
                onChange={(e) => setShadowbanNotes(e.target.value)}
                rows={2}
                placeholder="What did you notice?"
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-amber-500/50 focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleSubmitShadowbanReportAdmin()}
                disabled={!shadowbanFile || shadowbanSubmitting}
                className="flex-1 rounded-2xl border border-amber-500/30 bg-amber-500/20 py-3 font-bold text-amber-400 hover:bg-amber-500/30 disabled:opacity-40"
              >
                {shadowbanSubmitting ? "Submitting…" : "Submit report"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShadowbanReportTarget(null);
                  setShadowbanFile(null);
                  setShadowbanNotes("");
                }}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-white/50 hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
