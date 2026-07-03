"use client";

import * as React from "react";
import { Check, ChevronDown, ExternalLink, Plus, Pencil, Trash2, Search, Smartphone, CheckCircle2, ImageIcon, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  FunnelLink,
  MarketingPlatform,
  ShadowbanReport,
  SocialAccount,
  SocialAccountStatus,
} from "@/services/marketing";
import type { ModelRecord, UserRecord } from "@/types";
import { PLATFORM_ICONS, SOCIAL_COLORS as PLATFORM_COLORS } from "@/lib/social-platform-config";

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
  const [pIcon, setPIcon] = React.useState("");
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
      setPIcon("");
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
  const [searchAccounts, setSearchAccounts] = React.useState("");
  const [filterModel, setFilterModel] = React.useState("");
  const [filterPlatform, setFilterPlatform] = React.useState("");
  const [filterVA, setFilterVA] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [accountModalOpen, setAccountModalOpen] = React.useState(false);
  const [editingAccountId, setEditingAccountId] = React.useState<string | null>(null);
  const [accountDraft, setAccountDraft] = React.useState<Partial<SocialAccount>>({});
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

  const platformColorByName = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of platforms) {
      if (p.name) m[p.name] = p.color;
    }
    return m;
  }, [platforms]);

  const filteredAccounts = React.useMemo(() => {
    const q = searchAccounts.trim().toLowerCase();
    return accounts.filter((a) => {
      if (filterModel && a.model_id !== filterModel) return false;
      if (filterVA && a.assigned_va_id !== filterVA) return false;
      if (filterPlatform && a.platform !== filterPlatform) return false;
      if (filterStatus && (a.account_status ?? "active") !== filterStatus) return false;
      if (!q) return true;
      return `${a.model_name} ${a.platform} ${a.username} ${a.account_link} ${a.notes}`.toLowerCase().includes(q);
    });
  }, [accounts, searchAccounts, filterModel, filterVA, filterPlatform, filterStatus]);

  const accountsByModel = React.useMemo(() => {
    const groups = new Map<string, { model_id: string; model_name: string; accounts: SocialAccount[] }>();
    for (const a of filteredAccounts) {
      const mid = a.model_id;
      const name = a.model_name || modelNameById[mid] || mid || "Unknown";
      let g = groups.get(mid);
      if (!g) {
        g = { model_id: mid, model_name: name, accounts: [] };
        groups.set(mid, g);
      }
      g.accounts.push(a);
    }
    return Array.from(groups.values()).sort((x, y) => x.model_name.localeCompare(y.model_name));
  }, [filteredAccounts, modelNameById]);

  function openNewAccount(preset?: { model_id?: string; model_name?: string }) {
    setEditingAccountId(null);
    const mid = preset?.model_id ?? "";
    setAccountDraft({
      model_id: mid,
      model_name: preset?.model_name ?? (mid ? (modelNameById[mid] ?? "") : ""),
      platform: "",
      username: "",
      account_link: "",
      account_type: "main",
      region: "Global",
      assigned_va_id: "",
      assigned_va_name: "",
      notes: "",
      active: true,
    });
    setAccountModalOpen(true);
  }

  function openEditAccount(acc: SocialAccount) {
    setEditingAccountId(acc.id);
    setAccountDraft({ ...acc });
    setAccountModalOpen(true);
  }

  function closeAccountModal() {
    setAccountModalOpen(false);
    setEditingAccountId(null);
    setAccountDraft({});
  }

  async function saveAccountFromModal(e: React.FormEvent) {
    e.preventDefault();
    const modelId = accountDraft.model_id?.trim() ?? "";
    const platform = accountDraft.platform?.trim() ?? "";
    const username = accountDraft.username?.trim() ?? "";
    if (!modelId || !platform || !username) {
      setError("Model, platform, and username are required.");
      return;
    }
    setError(null);
    const va = vaUsers.find((u) => u.id === (accountDraft.assigned_va_id ?? ""));
    const body = {
      model_id: modelId,
      model_name: accountDraft.model_name?.trim() || modelNameById[modelId] || "",
      platform,
      account_link: (accountDraft.account_link ?? "").trim(),
      username,
      account_type: (accountDraft.account_type === "secondary" ? "secondary" : "main") as "main" | "secondary",
      region: (accountDraft.region === "USA" || accountDraft.region === "Greek" ? accountDraft.region : "Global") as SocialAccount["region"],
      assigned_va_id: accountDraft.assigned_va_id ?? "",
      assigned_va_name: va?.full_name?.trim() || va?.email || accountDraft.assigned_va_name || "",
      notes: (accountDraft.notes ?? "").trim(),
    };
    setBusy(editingAccountId ? `account-${editingAccountId}` : "account-add");
    try {
      if (editingAccountId) {
        const res = await fetch(`/api/admin/marketing/accounts/${editingAccountId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
        setAccounts((prev) => prev.map((a) => (a.id === editingAccountId ? { ...a, ...body } : a)));
      } else {
        const res = await fetch("/api/admin/marketing/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { account: SocialAccount };
        setAccounts((prev) => [data.account, ...prev]);
      }
      closeAccountModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save account");
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteAccount(id: string) {
    if (!confirm("Permanently delete this account?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/marketing/accounts/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      if (editingAccountId === id) closeAccountModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
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
        const newStatus: SocialAccountStatus = reportBefore.report_type === "banned" ? "banned" : "shadowbanned";
        setAccounts((prev) =>
          prev.map((a) =>
            a.account_id === reportBefore.account_id ? { ...a, account_status: newStatus } : a,
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
      fd.append("report_type", "shadowbanned");
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
        <div>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Social Accounts</h2>
              <p className="mt-0.5 text-sm text-white/40">
                {accounts.length} accounts across {[...new Set(accounts.map((a) => a.model_id))].length} models
              </p>
            </div>
            <button
              type="button"
              onClick={() => openNewAccount()}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-5 py-2.5 font-semibold text-white shadow-lg shadow-pink-500/25 transition-all hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Add Account
            </button>
          </div>

          <div className="mb-6 flex flex-wrap gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                placeholder="Search username, model..."
                value={searchAccounts}
                onChange={(e) => setSearchAccounts(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-sm text-white placeholder:text-white/20 focus:border-pink-500/50 focus:outline-none"
              />
            </div>
            <select
              value={filterModel}
              onChange={(e) => setFilterModel(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
            >
              <option value="">All models</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.model_name || m.model_id}
                </option>
              ))}
            </select>
            <select
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
            >
              <option value="">All platforms</option>
              {[...new Set(accounts.map((a) => a.platform).filter(Boolean))].sort().map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_ICONS[p] ?? ""} {p}
                </option>
              ))}
            </select>
            <select
              value={filterVA}
              onChange={(e) => setFilterVA(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
            >
              <option value="">All VAs</option>
              {vaUsers.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.full_name || v.email}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="shadowbanned">Shadowbanned</option>
              <option value="banned">Banned</option>
            </select>
            {(searchAccounts || filterModel || filterPlatform || filterVA || filterStatus) && (
              <button
                type="button"
                onClick={() => {
                  setSearchAccounts("");
                  setFilterModel("");
                  setFilterPlatform("");
                  setFilterVA("");
                  setFilterStatus("");
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/40 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {accountsByModel.length === 0 ? (
            <div className="py-20 text-center text-white/20">
              <p className="mb-4 flex justify-center"><Smartphone className="h-12 w-12 text-white/30" aria-hidden /></p>
              <p className="text-lg">No social accounts yet</p>
              <p className="mt-1 text-sm">Add the first account to get started</p>
            </div>
          ) : (
            accountsByModel.map((group) => (
              <div key={group.model_id} className="mb-10">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-pink-500/20 bg-gradient-to-br from-pink-500/20 to-rose-500/20 text-lg font-bold text-pink-400">
                    {(group.model_name || "?")[0]}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-white">{group.model_name}</h3>
                    <p className="text-xs text-white/30">
                      {group.accounts.length} account{group.accounts.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      openNewAccount({ model_id: group.model_id, model_name: group.model_name })
                    }
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/40 transition-all hover:bg-white/10 hover:text-white"
                  >
                    <Plus className="h-3 w-3" /> Add account
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {group.accounts.map((acc) => {
                    const color =
                      platformColorByName[acc.platform] ?? PLATFORM_COLORS[acc.platform] ?? "#888888";
                    const icon = PLATFORM_ICONS[acc.platform] ?? "";
                    const statusCfg = STATUS_CONFIG[acc.account_status ?? "active"];

                    return (
                      <div
                        key={acc.id}
                        className={cn(
                          "group relative overflow-hidden rounded-2xl border transition-all hover:scale-[1.01]",
                          acc.account_status === "banned"
                            ? "border-red-500/25 bg-red-500/[0.03]"
                            : acc.account_status === "shadowbanned"
                              ? "border-amber-500/25 bg-amber-500/[0.03]"
                              : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]",
                          !acc.active && "opacity-60",
                        )}
                      >
                        <div className="h-1 w-full" style={{ backgroundColor: `${color}99` }} />

                        <div className="p-4">
                          <div className="mb-3 flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
                                style={{
                                  backgroundColor: `${color}26`,
                                  border: `1px solid ${color}4d`,
                                }}
                              >
                                {icon}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-white">@{acc.username}</p>
                                <p className="text-xs text-white/40">{acc.platform}</p>
                              </div>
                            </div>

                            <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100">
                              {acc.account_link ? (
                                <a
                                  href={acc.account_link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-lg p-1.5 text-white/30 transition-all hover:bg-white/10 hover:text-white"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => openEditAccount(acc)}
                                className="rounded-lg p-1.5 text-white/30 transition-all hover:bg-white/10 hover:text-white"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteAccount(acc.id)}
                                className="rounded-lg p-1.5 text-white/30 transition-all hover:bg-red-500/10 hover:text-red-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="mb-3 flex flex-wrap gap-1.5">
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-xs font-semibold",
                                acc.account_type === "main"
                                  ? "border-green-500/20 bg-green-500/10 text-green-400"
                                  : "border-blue-500/20 bg-blue-500/10 text-blue-400",
                              )}
                            >
                              {acc.account_type === "main" ? "⭐ Main" : "2nd"}
                            </span>
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-xs font-semibold",
                                acc.region === "Greek"
                                  ? "border-blue-500/20 bg-blue-500/10 text-blue-400"
                                  : acc.region === "USA"
                                    ? "border-red-500/20 bg-red-500/10 text-red-400"
                                    : "border-purple-500/20 bg-purple-500/10 text-purple-400",
                              )}
                            >
                              {acc.region === "Greek" ? "🇬🇷" : acc.region === "USA" ? "🇺🇸" : ""} {acc.region}
                            </span>
                          </div>

                          {acc.assigned_va_name ? (
                            <div className="mb-3 flex items-center gap-1.5">
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/20 text-xs font-bold text-purple-400">
                                {acc.assigned_va_name[0]}
                              </div>
                              <span className="text-xs text-white/40">{acc.assigned_va_name}</span>
                            </div>
                          ) : null}

                          <div className="mb-3">
                            <button
                              type="button"
                              onClick={() => void patchAccount(acc.id, { active: !acc.active })}
                              disabled={busy === `account-${acc.id}`}
                              className={cn(
                                "rounded-lg px-2 py-1 text-xs font-medium",
                                acc.active ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/50",
                              )}
                            >
                              Active: {acc.active ? "On" : "Off"}
                            </button>
                          </div>

                          <div className="group/status relative mt-auto">
                            <button
                              type="button"
                              className={cn(
                                "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all",
                                statusCfg.bg,
                                statusCfg.border,
                              )}
                            >
                              <div
                                className={cn(
                                  "h-2 w-2 rounded-full",
                                  statusCfg.dot,
                                  acc.account_status === "active" ? "animate-pulse" : "",
                                )}
                              />
                              <span className={statusCfg.color}>{statusCfg.label}</span>
                              <ChevronDown className={cn("ml-auto h-3 w-3 opacity-50", statusCfg.color)} />
                            </button>

                            <div className="absolute bottom-full left-0 z-30 mb-1 hidden min-w-[11rem] rounded-xl border border-white/15 bg-[#0f0f1a] p-1.5 shadow-2xl group-hover/status:block">
                              {(["active", "shadowbanned", "banned"] as const).map((status) => {
                                const cfg = STATUS_CONFIG[status];
                                return (
                                  <button
                                    key={status}
                                    type="button"
                                    onClick={() => void handleUpdateAccountStatus(acc.id, status)}
                                    className={cn(
                                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all hover:bg-white/5",
                                      cfg.color,
                                      acc.account_status === status ? "bg-white/5" : "",
                                    )}
                                  >
                                    <div className={cn("h-2 w-2 rounded-full", cfg.dot)} />
                                    {cfg.label}
                                    {acc.account_status === status ? (
                                      <Check className="ml-auto h-3 w-3 opacity-60" />
                                    ) : null}
                                  </button>
                                );
                              })}
                              <div className="my-1 h-px bg-white/[0.08]" />
                              <button
                                type="button"
                                onClick={() => {
                                  setShadowbanReportTarget(acc);
                                  setShadowbanFile(null);
                                  setShadowbanNotes("");
                                }}
                                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-semibold text-amber-400 transition-all hover:bg-amber-500/10"
                              >
                                Report shadowban
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
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
              <p className="mb-3 flex justify-center"><CheckCircle2 className="h-10 w-10 text-emerald-400" aria-hidden /></p>
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
                        <span className="text-xl">{PLATFORM_ICONS[report.platform] ?? ""}</span>
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
                          <span className="inline-flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" aria-hidden />View screenshot</span>
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
                        Approve — mark as {report.report_type === "banned" ? "banned" : "shadowbanned"}
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

      {accountModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/15 bg-[#0f0f1a] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{editingAccountId ? "Edit account" : "Add social account"}</h3>
              <button
                type="button"
                onClick={closeAccountModal}
                className="rounded-lg px-2 py-1 text-sm text-white/50 hover:bg-white/10 hover:text-white"
              >
                Close
              </button>
            </div>
            <form onSubmit={saveAccountFromModal} className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-white/50 sm:col-span-2">
                Model
                <select
                  value={accountDraft.model_id ?? ""}
                  onChange={(e) => {
                    const id = e.target.value;
                    setAccountDraft((d) => ({
                      ...d,
                      model_id: id,
                      model_name: id ? modelNameById[id] ?? "" : "",
                    }));
                  }}
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
              <div className="sm:col-span-2">
                <label className="mb-2 block text-xs uppercase tracking-widest text-white/40">Platform *</label>
                <div className="flex flex-wrap gap-2">
                  {[...platforms]
                    .filter((p) => p.active)
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((p) => {
                      const selected = accountDraft.platform === p.name;
                      const col = p.color ?? "#888888";
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setAccountDraft((prev) => ({ ...prev, platform: p.name }))}
                          className={cn(
                            "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all",
                            selected
                              ? "scale-105 text-white"
                              : "border-white/10 bg-white/5 text-white/40 hover:bg-white/[0.08]",
                          )}
                          style={
                            selected
                              ? {
                                  backgroundColor: `${col}33`,
                                  borderColor: `${col}80`,
                                  color: col,
                                  boxShadow: `0 0 12px ${col}40`,
                                }
                              : undefined
                          }
                        >
                          <span className="text-lg">{p.icon}</span>
                          {p.name}
                        </button>
                      );
                    })}
                </div>
                {accountDraft.platform ? (
                  <p className="mt-2 text-xs text-white/25">
                    Selected: {platforms.find((p) => p.name === accountDraft.platform)?.icon}{""}
                    {accountDraft.platform}
                  </p>
                ) : null}
              </div>
              <label className="flex flex-col gap-1 text-xs text-white/50">
                Username
                <input
                  value={accountDraft.username ?? ""}
                  onChange={(e) => setAccountDraft((d) => ({ ...d, username: e.target.value }))}
                  className={selectClass}
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50 sm:col-span-2">
                Link
                <input
                  value={accountDraft.account_link ?? ""}
                  onChange={(e) => setAccountDraft((d) => ({ ...d, account_link: e.target.value }))}
                  className={selectClass}
                  placeholder="https://…"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50">
                Type
                <select
                  value={accountDraft.account_type ?? "main"}
                  onChange={(e) =>
                    setAccountDraft((d) => ({
                      ...d,
                      account_type: e.target.value as "main" | "secondary",
                    }))
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
                  value={accountDraft.region ?? "Global"}
                  onChange={(e) =>
                    setAccountDraft((d) => ({
                      ...d,
                      region: e.target.value as SocialAccount["region"],
                    }))
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
              <label className="flex flex-col gap-1 text-xs text-white/50 sm:col-span-2">
                Assigned VA
                <select
                  value={accountDraft.assigned_va_id ?? ""}
                  onChange={(e) => {
                    const id = e.target.value;
                    const u = vaUsers.find((x) => x.id === id);
                    setAccountDraft((d) => ({
                      ...d,
                      assigned_va_id: id,
                      assigned_va_name: u?.full_name?.trim() || u?.email || "",
                    }));
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
              <label className="flex flex-col gap-1 text-xs text-white/50 sm:col-span-2">
                Notes
                <input
                  value={accountDraft.notes ?? ""}
                  onChange={(e) => setAccountDraft((d) => ({ ...d, notes: e.target.value }))}
                  className={selectClass}
                />
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <button
                  type="submit"
                  disabled={busy === "account-add" || (!!editingAccountId && busy === `account-${editingAccountId}`)}
                  className="rounded-xl bg-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 hover:bg-pink-400 disabled:opacity-50"
                >
                  {editingAccountId ? "Save changes" : "Add account"}
                </button>
                <button
                  type="button"
                  onClick={closeAccountModal}
                  className="rounded-xl px-4 py-2.5 text-sm text-white/60 hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {shadowbanReportTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#0f0f1a] p-6 shadow-2xl">
            <h3 className="mb-1 text-lg font-bold text-white">Report shadowban</h3>
            <div className="mb-5 flex items-center gap-2">
              <span className="text-xl">{PLATFORM_ICONS[shadowbanReportTarget.platform] ?? ""}</span>
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
                    <p className="mb-1 flex justify-center"><ClipboardList className="h-8 w-8 text-white/30" aria-hidden /></p>
                    <p className="text-sm text-white/40">Paste (Ctrl+V) or tap</p>
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
