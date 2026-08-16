"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Plus,
  ScrollText,
  Search,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { useToast } from "@/contexts/toast-context";
import { FormInput } from "@/components/ui/form-input";
import { Label, Textarea } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { copyTextToClipboard } from "@/lib/winner-videos-copy";
import {
  CREDENTIAL_CATEGORIES,
  CREDENTIAL_FIELD_LABELS,
  CREDENTIAL_FIELDS,
  MASKED_VALUE,
  type CredentialField,
  type CredentialSecretData,
} from "@/lib/credentials-types";
import type { CredentialAccessLogRecord, MaskedCredentialEntry } from "@/services/credential-entries";
import type { AppNotification, ModelRecord } from "@/types";
import { cn } from "@/lib/utils";

const BG = "#050505";
const PANEL = "#0d0d0d";
const BORDER = "rgba(255,255,255,0.08)";
const GOLD = "#D4AF8C";
const GOLD_DIM = "rgba(212,175,140,0.15)";

type CredentialsVaultClientProps = {
  modelById: Record<string, string>;
  models: ModelRecord[];
  canManage: boolean;
};

type RevealedFields = Record<string, Partial<Record<CredentialField, string>>>;

const EMPTY_FORM: CredentialSecretData & {
  model_id: string;
  category: string;
  label: string;
} = {
  model_id: "",
  category: "General",
  label: "",
  username: "",
  password: "",
  email: "",
  email_password: "",
  phone: "",
  backup_codes: "",
  recovery_email: "",
  recovery_password: "",
  notes: "",
};

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function vaultToast(title: string, body: string, priority: "normal" | "high"): AppNotification {
  const id = `vault-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function actionLabel(action: CredentialAccessLogRecord["action"]): string {
  switch (action) {
    case "viewed_masked":
      return "Viewed (masked)";
    case "revealed":
      return "Revealed";
    case "copied":
      return "Copied";
    case "created":
      return "Created";
    case "updated":
      return "Updated";
    case "deleted":
      return "Deleted";
    default:
      return action;
  }
}

export function CredentialsVaultClient({
  modelById,
  models,
  canManage,
}: CredentialsVaultClientProps) {
  const { addToast } = useToast();
  const [entries, setEntries] = React.useState<MaskedCredentialEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("");
  const [modelFilter, setModelFilter] = React.useState("");
  const [expandedModels, setExpandedModels] = React.useState<Set<string>>(new Set(["__general__"]));
  const [expandedCategories, setExpandedCategories] = React.useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [revealed, setRevealed] = React.useState<RevealedFields>({});
  const [revealingField, setRevealingField] = React.useState<string | null>(null);
  const [showAudit, setShowAudit] = React.useState(false);
  const [auditLogs, setAuditLogs] = React.useState<CredentialAccessLogRecord[]>([]);
  const [auditLoading, setAuditLoading] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ ...EMPTY_FORM });
  const [saving, setSaving] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<MaskedCredentialEntry | null>(null);

  const loadEntries = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/credentials", { cache: "no-store" });
      const data = (await res.json()) as { entries?: MaskedCredentialEntry[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setEntries(data.entries ?? []);
    } catch (err) {
      addToast(vaultToast("Load failed", err instanceof Error ? err.message : "Could not load credentials", "high"));
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  React.useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (categoryFilter && e.category !== categoryFilter) return false;
      if (modelFilter === "__general__" && e.model_id) return false;
      if (modelFilter && modelFilter !== "__general__" && e.model_id !== modelFilter) return false;
      if (!q) return true;
      const modelName = e.model_id ? modelById[e.model_id]?.toLowerCase() ?? "" : "general";
      return (
        e.label.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        modelName.includes(q) ||
        e.fields.username.toLowerCase().includes(q)
      );
    });
  }, [entries, search, categoryFilter, modelFilter, modelById]);

  const tree = React.useMemo(() => {
    const byModel = new Map<string, Map<string, MaskedCredentialEntry[]>>();
    for (const entry of filtered) {
      const modelKey = entry.model_id ?? "__general__";
      if (!byModel.has(modelKey)) byModel.set(modelKey, new Map());
      const byCat = byModel.get(modelKey)!;
      if (!byCat.has(entry.category)) byCat.set(entry.category, []);
      byCat.get(entry.category)!.push(entry);
    }
    return byModel;
  }, [filtered]);

  const selected = entries.find((e) => e.id === selectedId) ?? null;

  async function loadAuditLog(credentialId?: string) {
    if (!canManage) return;
    setAuditLoading(true);
    try {
      const qs = credentialId ? `?credential_id=${encodeURIComponent(credentialId)}` : "";
      const res = await fetch(`/api/admin/credentials/audit-log${qs}`, { cache: "no-store" });
      const data = (await res.json()) as { logs?: CredentialAccessLogRecord[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load audit log");
      setAuditLogs(data.logs ?? []);
    } catch (err) {
      addToast(vaultToast("Audit log failed", err instanceof Error ? err.message : "Could not load audit log", "high"));
    } finally {
      setAuditLoading(false);
    }
  }

  function toggleModel(key: string) {
    setExpandedModels((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleCategory(key: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormOpen(true);
  }

  function openEdit(entry: MaskedCredentialEntry) {
    setEditingId(entry.id);
    setForm({
      model_id: entry.model_id ?? "",
      category: entry.category,
      label: entry.label,
      username: entry.fields.username,
      password: "",
      email: "",
      email_password: "",
      phone: "",
      backup_codes: "",
      recovery_email: "",
      recovery_password: "",
      notes: "",
    });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!canManage) return;
    setSaving(true);
    try {
      const data: CredentialSecretData = {};
      for (const field of CREDENTIAL_FIELDS) {
        const value = form[field]?.trim() ?? "";
        if (value) data[field] = value;
      }

      const payload = {
        model_id: form.model_id.trim() || null,
        category: form.category.trim(),
        label: form.label.trim(),
        data,
      };

      const url = editingId ? `/api/admin/credentials/${editingId}` : "/api/admin/credentials";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as { entry?: MaskedCredentialEntry; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Save failed");

      addToast(vaultToast(editingId ? "Credential updated" : "Credential created", payload.label, "normal"));
      setFormOpen(false);
      setEditingId(null);
      setRevealed((prev) => {
        const next = { ...prev };
        if (editingId) delete next[editingId];
        return next;
      });
      await loadEntries();
      if (body.entry) setSelectedId(body.entry.id);
    } catch (err) {
      addToast(vaultToast("Save failed", err instanceof Error ? err.message : "Could not save", "high"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(entry: MaskedCredentialEntry) {
    if (!canManage) return;
    try {
      const res = await fetch(`/api/admin/credentials/${entry.id}`, { method: "DELETE" });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Delete failed");
      addToast(vaultToast("Deleted", entry.label, "normal"));
      setDeleteTarget(null);
      if (selectedId === entry.id) setSelectedId(null);
      await loadEntries();
    } catch (err) {
      addToast(vaultToast("Delete failed", err instanceof Error ? err.message : "Could not delete", "high"));
    }
  }

  async function handleReveal(entryId: string, field: CredentialField) {
    const key = `${entryId}:${field}`;
    setRevealingField(key);
    try {
      const res = await fetch(`/api/admin/credentials/${entryId}/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field }),
      });
      const body = (await res.json()) as { value?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Reveal failed");
      setRevealed((prev) => ({
        ...prev,
        [entryId]: { ...(prev[entryId] ?? {}), [field]: body.value ?? "" },
      }));
    } catch (err) {
      addToast(vaultToast("Reveal failed", err instanceof Error ? err.message : "Could not reveal field", "high"));
    } finally {
      setRevealingField(null);
    }
  }

  function handleRemask(entryId: string, field: CredentialField) {
    setRevealed((prev) => {
      const entryRevealed = { ...(prev[entryId] ?? {}) };
      delete entryRevealed[field];
      const next = { ...prev };
      if (Object.keys(entryRevealed).length === 0) delete next[entryId];
      else next[entryId] = entryRevealed;
      return next;
    });
  }

  async function handleCopy(entryId: string, field: CredentialField) {
    try {
      const res = await fetch(`/api/admin/credentials/${entryId}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field }),
      });
      const body = (await res.json()) as { value?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Copy failed");
      await copyTextToClipboard(body.value ?? "");
      addToast(vaultToast("Copied", `${CREDENTIAL_FIELD_LABELS[field]} copied to clipboard`, "normal"));
    } catch (err) {
      addToast(vaultToast("Copy failed", err instanceof Error ? err.message : "Could not copy", "high"));
    }
  }

  function displayFieldValue(entry: MaskedCredentialEntry, field: CredentialField): string {
    if (!entry.has_value[field]) return "—";
    const revealedValue = revealed[entry.id]?.[field];
    if (revealedValue !== undefined) return revealedValue || "—";
    if (field === "username") return entry.fields.username || "—";
    return MASKED_VALUE;
  }

  function isFieldRevealed(entryId: string, field: CredentialField): boolean {
    return revealed[entryId]?.[field] !== undefined;
  }

  const categoriesInTree = [...new Set(entries.map((e) => e.category))].sort();

  return (
    <div className="min-h-full pb-24" style={{ background: BG }}>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl border p-6 sm:p-8" style={{ borderColor: BORDER, background: PANEL }}>
          <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full opacity-20 blur-3xl" style={{ background: GOLD }} />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em]" style={{ borderColor: GOLD_DIM, color: GOLD }}>
                <Shield className="h-3.5 w-3.5" aria-hidden />
                Encrypted vault
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Credentials Vault</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/55">
                AES-256-GCM encrypted storage. Secrets stay masked until you explicitly reveal or copy — every action is audit logged.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canManage && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAudit(true);
                      void loadAuditLog();
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-white/75 transition hover:text-white"
                    style={{ borderColor: BORDER, background: "rgba(255,255,255,0.03)" }}
                  >
                    <ScrollText className="h-4 w-4" aria-hidden />
                    Audit log
                  </button>
                  <button
                    type="button"
                    onClick={openCreate}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#0D0B0D] transition hover:opacity-90"
                    style={{ background: GOLD }}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Add credential
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="relative sm:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" aria-hidden />
            <FormInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search label, username, model…"
              className="pl-9"
            />
          </div>
          <select
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            className="rounded-lg border bg-[#0D0B0D]/80 px-3 py-2 text-sm text-white/85"
            style={{ borderColor: BORDER }}
          >
            <option value="">All models</option>
            <option value="__general__">General (non-model)</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.model_name}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border bg-[#0D0B0D]/80 px-3 py-2 text-sm text-white/85"
            style={{ borderColor: BORDER }}
          >
            <option value="">All categories</option>
            {categoriesInTree.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {/* Tree */}
          <div className="rounded-2xl border p-4" style={{ borderColor: BORDER, background: PANEL }}>
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-white/45">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              Browse
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-16 text-white/50">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              </div>
            ) : tree.size === 0 ? (
              <p className="py-12 text-center text-sm text-white/45">No credentials yet.</p>
            ) : (
              <div className="space-y-2">
                {[...tree.entries()]
                  .sort(([a], [b]) => {
                    if (a === "__general__") return -1;
                    if (b === "__general__") return 1;
                    return (modelById[a] ?? "").localeCompare(modelById[b] ?? "");
                  })
                  .map(([modelKey, categories]) => {
                    const modelLabel =
                      modelKey === "__general__"
                        ? "General / Non-model"
                        : modelById[modelKey] ?? "Unknown model";
                    const modelExpanded = expandedModels.has(modelKey);
                    return (
                      <div key={modelKey} className="rounded-xl border" style={{ borderColor: BORDER }}>
                        <button
                          type="button"
                          onClick={() => toggleModel(modelKey)}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-white/90 hover:bg-white/[0.03]"
                        >
                          {modelExpanded ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-white/45" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-white/45" />
                          )}
                          <KeyRound className="h-4 w-4 shrink-0" style={{ color: GOLD }} aria-hidden />
                          {modelLabel}
                        </button>
                        {modelExpanded && (
                          <div className="border-t px-2 py-2" style={{ borderColor: BORDER }}>
                            {[...categories.entries()]
                              .sort(([a], [b]) => a.localeCompare(b))
                              .map(([category, items]) => {
                                const catKey = `${modelKey}::${category}`;
                                const catExpanded = expandedCategories.has(catKey);
                                return (
                                  <div key={catKey} className="mb-1 last:mb-0">
                                    <button
                                      type="button"
                                      onClick={() => toggleCategory(catKey)}
                                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-white/75 hover:bg-white/[0.03]"
                                    >
                                      {catExpanded ? (
                                        <ChevronDown className="h-3.5 w-3.5 text-white/40" />
                                      ) : (
                                        <ChevronRight className="h-3.5 w-3.5 text-white/40" />
                                      )}
                                      {category}
                                      <span className="ml-auto text-xs text-white/35">{items.length}</span>
                                    </button>
                                    {catExpanded && (
                                      <div className="ml-5 space-y-1 border-l pl-2" style={{ borderColor: BORDER }}>
                                        {items.map((entry) => (
                                          <button
                                            key={entry.id}
                                            type="button"
                                            onClick={() => setSelectedId(entry.id)}
                                            className={cn(
                                              "block w-full rounded-lg px-2 py-2 text-left text-sm transition",
                                              selectedId === entry.id
                                                ? "bg-[#D4AF8C]/10 text-[#D4AF8C]"
                                                : "text-white/70 hover:bg-white/[0.04] hover:text-white",
                                            )}
                                          >
                                            {entry.label}
                                            {entry.fields.username ? (
                                              <span className="mt-0.5 block truncate font-mono text-xs text-white/40">
                                                {entry.fields.username}
                                              </span>
                                            ) : null}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Detail panel */}
          <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: BORDER, background: PANEL }}>
            {!selected ? (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center text-white/45">
                <Shield className="mb-3 h-10 w-10 opacity-30" aria-hidden />
                <p className="text-sm">Select a credential to view masked fields.</p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/40">{selected.category}</p>
                    <h2 className="mt-1 text-xl font-semibold text-white">{selected.label}</h2>
                    <p className="mt-1 text-sm text-white/45">
                      {selected.model_id ? modelById[selected.model_id] : "General / Non-model"}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(selected)}
                        className="rounded-lg border px-3 py-1.5 text-xs text-white/75 hover:text-white"
                        style={{ borderColor: BORDER }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(selected)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-500/25 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {CREDENTIAL_FIELDS.map((field) => {
                    if (!selected.has_value[field] && field !== "username") return null;
                    const value = displayFieldValue(selected, field);
                    const isSecret = field !== "username";
                    const isRevealed = isFieldRevealed(selected.id, field);
                    const revealKey = `${selected.id}:${field}`;
                    const busy = revealingField === revealKey;

                    return (
                      <div
                        key={field}
                        className="rounded-xl border px-3 py-3"
                        style={{ borderColor: isSecret && !isRevealed ? GOLD_DIM : BORDER, background: "rgba(255,255,255,0.02)" }}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] uppercase tracking-widest text-white/40">
                              {CREDENTIAL_FIELD_LABELS[field]}
                            </p>
                            <p
                              className={cn(
                                "mt-1 break-all text-sm",
                                isSecret && !isRevealed ? "font-mono tracking-widest text-[#D4AF8C]/70" : "font-mono text-white/85",
                              )}
                            >
                              {value}
                            </p>
                          </div>
                          {selected.has_value[field] && isSecret && (
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  isRevealed
                                    ? handleRemask(selected.id, field)
                                    : void handleReveal(selected.id, field)
                                }
                                className="inline-flex items-center justify-center rounded-md border border-white/[0.08] bg-[#0D0B0D]/60 p-1.5 text-white/55 transition hover:border-[#D4AF8C]/30 hover:text-[#D4AF8C]"
                                aria-label={isRevealed ? "Re-mask" : "Reveal"}
                              >
                                {busy ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : isRevealed ? (
                                  <EyeOff className="h-3.5 w-3.5" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleCopy(selected.id, field)}
                                className="inline-flex items-center justify-center rounded-md border border-white/[0.08] bg-[#0D0B0D]/60 p-1.5 text-white/55 transition hover:border-[#D4AF8C]/30 hover:text-[#D4AF8C]"
                                aria-label={`Copy ${CREDENTIAL_FIELD_LABELS[field]}`}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                          {field === "username" && selected.has_value.username && (
                            <button
                              type="button"
                              onClick={() => void handleCopy(selected.id, "username")}
                              className="inline-flex items-center justify-center rounded-md border border-white/[0.08] bg-[#0D0B0D]/60 p-1.5 text-white/55 transition hover:border-[#D4AF8C]/30 hover:text-[#D4AF8C]"
                              aria-label="Copy username"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="mt-4 text-xs text-white/35">
                  Updated {formatTimestamp(selected.updated_at)}
                  {selected.updated_by_name ? ` by ${selected.updated_by_name}` : ""}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Form modal */}
      {formOpen && canManage && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border p-5 sm:p-6"
            style={{ borderColor: BORDER, background: PANEL }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                {editingId ? "Edit credential" : "Add credential"}
              </h3>
              <button type="button" onClick={() => setFormOpen(false)} className="text-white/50 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Label</Label>
                <FormInput
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. Main OF login"
                />
              </div>
              <div>
                <Label>Model (optional)</Label>
                <select
                  value={form.model_id}
                  onChange={(e) => setForm((f) => ({ ...f, model_id: e.target.value }))}
                  className="mt-1 w-full rounded-lg border bg-[#0D0B0D]/80 px-3 py-2 text-sm text-white/85"
                  style={{ borderColor: BORDER }}
                >
                  <option value="">General / Non-model</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.model_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Category</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="mt-1 w-full rounded-lg border bg-[#0D0B0D]/80 px-3 py-2 text-sm text-white/85"
                  style={{ borderColor: BORDER }}
                >
                  {CREDENTIAL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              {CREDENTIAL_FIELDS.map((field) => (
                <div key={field} className={field === "notes" || field === "backup_codes" ? "sm:col-span-2" : ""}>
                  <Label>{CREDENTIAL_FIELD_LABELS[field]}</Label>
                  {field === "notes" || field === "backup_codes" ? (
                    <Textarea
                      value={form[field] ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                      rows={3}
                      placeholder={editingId ? "Leave blank to keep existing" : ""}
                    />
                  ) : (
                    <FormInput
                      value={form[field] ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                      type={field.includes("password") ? "password" : "text"}
                      autoComplete="off"
                      placeholder={
                        editingId && field !== "username"
                          ? "Leave blank to keep existing"
                          : undefined
                      }
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-lg border px-4 py-2 text-sm text-white/70"
                style={{ borderColor: BORDER }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !form.label.trim() || !form.category.trim()}
                onClick={() => void handleSave()}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-[#0D0B0D] disabled:opacity-50"
                style={{ background: GOLD }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit log modal */}
      {showAudit && canManage && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div
            className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border"
            style={{ borderColor: BORDER, background: PANEL }}
          >
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: BORDER }}>
              <div>
                <h3 className="text-lg font-semibold text-white">Audit log</h3>
                <p className="text-xs text-white/45">Every reveal, copy, and CRUD action</p>
              </div>
              <button type="button" onClick={() => setShowAudit(false)} className="text-white/50 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              {auditLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-white/50" />
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="py-8 text-center text-sm text-white/45">No audit events yet.</p>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-lg border px-3 py-2 text-sm"
                      style={{ borderColor: BORDER, background: "rgba(255,255,255,0.02)" }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide" style={{ background: GOLD_DIM, color: GOLD }}>
                          {actionLabel(log.action)}
                        </span>
                        {log.field_name && (
                          <span className="text-xs text-white/45">{log.field_name}</span>
                        )}
                        <span className="ml-auto text-xs text-white/35">{formatTimestamp(log.timestamp)}</span>
                      </div>
                      <p className="mt-1 text-white/70">
                        {log.user_name ?? log.user_id}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete credential?"
        description={`Permanently delete "${deleteTarget?.label ?? ""}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={() => {
          if (deleteTarget) void handleDelete(deleteTarget);
        }}
      />
    </div>
  );
}
