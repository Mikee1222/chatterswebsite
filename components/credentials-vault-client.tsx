"use client";

import * as React from "react";
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  FolderTree,
  Grid3X3,
  KeyRound,
  Layers,
  LayoutGrid,
  Loader2,
  Lock,
  Plus,
  ScrollText,
  Search,
  Shield,
  Trash2,
  User,
  X,
  Zap,
} from "lucide-react";
import { useToast } from "@/contexts/toast-context";
import { FormInput } from "@/components/ui/form-input";
import { Label, Textarea } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CountUp, LuxuryStatCard } from "@/components/infloww-performance-ui";
import { copyTextToClipboard } from "@/lib/winner-videos-copy";
import {
  CREDENTIAL_CATEGORY_SUGGESTIONS,
  CREDENTIAL_FIELD_LABELS,
  CREDENTIAL_FIELDS,
  MASKED_VALUE,
  toCustomFieldRef,
  type CredentialField,
  type CredentialFieldRef,
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
const PAGE_SIZE = 24;

type ViewMode = "tree" | "all";
type ScopeFilter = "" | "general" | "model";
type CustomFieldsFilter = "" | "yes" | "no";

type CredentialsVaultClientProps = {
  modelById: Record<string, string>;
  models: ModelRecord[];
  canManage: boolean;
};

type FormCustomField = { id: string; key: string; value: string };

type FormState = CredentialSecretData & {
  model_id: string;
  category: string;
  label: string;
  customFieldRows: FormCustomField[];
};

const EMPTY_FORM: FormState = {
  model_id: "",
  category: "",
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
  customFieldRows: [],
};

function newCustomRow(): FormCustomField {
  return { id: `cf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, key: "", value: "" };
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function libraryToast(title: string, body: string, priority: "normal" | "high"): AppNotification {
  const id = `pl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function fieldDisplayLabel(fieldRef: string): string {
  if ((CREDENTIAL_FIELDS as readonly string[]).includes(fieldRef)) {
    return CREDENTIAL_FIELD_LABELS[fieldRef as CredentialField];
  }
  if (fieldRef.startsWith("custom:")) return fieldRef.slice("custom:".length);
  return fieldRef;
}

type CategoryVisual = {
  label: string;
  bg: string;
  text: string;
  initials: string;
};

function categoryVisual(category: string): CategoryVisual {
  const c = category.toLowerCase();
  if (c.includes("instagram") || c === "ig") {
    return { label: category, bg: "linear-gradient(135deg,#f09433,#bc1888,#833ab4)", text: "#fff", initials: "IG" };
  }
  if (c.includes("tiktok") || c === "tt") {
    return { label: category, bg: "#010101", text: "#69C9D0", initials: "TT" };
  }
  if (c.includes("facebook") || c === "fb") {
    return { label: category, bg: "#1877F2", text: "#fff", initials: "FB" };
  }
  if (c.includes("snap")) {
    return { label: category, bg: "#FFFC00", text: "#111", initials: "SC" };
  }
  if (c.includes("paypal")) {
    return { label: category, bg: "#003087", text: "#fff", initials: "PP" };
  }
  if (c.includes("apple") || c.includes("icloud")) {
    return { label: category, bg: "#555", text: "#fff", initials: "AP" };
  }
  if (c.includes("onlyfans") || c === "of") {
    return { label: category, bg: "#00AFF0", text: "#fff", initials: "OF" };
  }
  if (c.includes("email") || c.includes("mail")) {
    return { label: category, bg: "rgba(212,175,140,0.25)", text: GOLD, initials: "@" };
  }
  if (c.includes("sim") || c.includes("phone")) {
    return { label: category, bg: "rgba(16,185,129,0.2)", text: "#6ee7b7", initials: "SIM" };
  }
  if (c.includes("payment") || c.includes("bank")) {
    return { label: category, bg: "rgba(212,175,140,0.18)", text: GOLD, initials: "$" };
  }
  return { label: category, bg: "rgba(255,255,255,0.08)", text: "rgba(255,255,255,0.7)", initials: "••" };
}

function CategoryBadge({ category, size = "md" }: { category: string; size?: "sm" | "md" }) {
  const v = categoryVisual(category);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg font-semibold tracking-tight",
        size === "sm" ? "h-7 w-7 text-[9px]" : "h-9 w-9 text-[10px]",
      )}
      style={{ background: v.bg, color: v.text }}
      title={v.label}
    >
      {v.initials}
    </span>
  );
}

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-max max-w-[220px] -translate-x-1/2 rounded-lg border px-2.5 py-1.5 text-[11px] leading-snug text-white/85 shadow-xl group-hover:block group-focus-within:block"
        style={{ borderColor: BORDER, background: "#141414" }}
      >
        {label}
      </span>
    </span>
  );
}

export function CredentialsVaultClient({
  modelById,
  models,
  canManage,
}: CredentialsVaultClientProps) {
  const { addToast } = useToast();
  const [entries, setEntries] = React.useState<MaskedCredentialEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [viewMode, setViewMode] = React.useState<ViewMode>("all");
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("");
  const [modelFilter, setModelFilter] = React.useState("");
  const [scopeFilter, setScopeFilter] = React.useState<ScopeFilter>("");
  const [customFieldsFilter, setCustomFieldsFilter] = React.useState<CustomFieldsFilter>("");
  const [page, setPage] = React.useState(0);
  const [expandedModels, setExpandedModels] = React.useState<Set<string>>(new Set(["__general__"]));
  const [expandedCategories, setExpandedCategories] = React.useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [quickCopyIds, setQuickCopyIds] = React.useState<Set<string>>(new Set());
  const [revealed, setRevealed] = React.useState<Record<string, Partial<Record<string, string>>>>({});
  const [revealingField, setRevealingField] = React.useState<string | null>(null);
  const [showAudit, setShowAudit] = React.useState(false);
  const [auditLogs, setAuditLogs] = React.useState<CredentialAccessLogRecord[]>([]);
  const [auditLoading, setAuditLoading] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>({ ...EMPTY_FORM });
  const [categoryQuery, setCategoryQuery] = React.useState("");
  const [showCategorySuggestions, setShowCategorySuggestions] = React.useState(false);
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
      addToast(libraryToast("Load failed", err instanceof Error ? err.message : "Could not load entries", "high"));
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  React.useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  React.useEffect(() => {
    setPage(0);
  }, [search, categoryFilter, modelFilter, scopeFilter, customFieldsFilter, viewMode]);

  const categoriesInUse = React.useMemo(
    () => [...new Set(entries.map((e) => e.category))].sort((a, b) => a.localeCompare(b)),
    [entries],
  );

  const categorySuggestions = React.useMemo(() => {
    const merged = new Set<string>([...CREDENTIAL_CATEGORY_SUGGESTIONS, ...categoriesInUse]);
    const q = categoryQuery.trim().toLowerCase();
    return [...merged]
      .filter((c) => !q || c.toLowerCase().includes(q))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 12);
  }, [categoriesInUse, categoryQuery]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (categoryFilter && e.category !== categoryFilter) return false;
      if (modelFilter && e.model_id !== modelFilter) return false;
      if (scopeFilter === "general" && e.model_id) return false;
      if (scopeFilter === "model" && !e.model_id) return false;
      if (customFieldsFilter === "yes" && !e.has_custom_fields) return false;
      if (customFieldsFilter === "no" && e.has_custom_fields) return false;
      if (!q) return true;
      const modelName = e.model_id ? modelById[e.model_id]?.toLowerCase() ?? "" : "company general";
      return (
        e.label.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        modelName.includes(q) ||
        e.fields.username.toLowerCase().includes(q) ||
        e.fields.email.toLowerCase().includes(q)
      );
    });
  }, [entries, search, categoryFilter, modelFilter, scopeFilter, customFieldsFilter, modelById]);

  const stats = React.useMemo(() => {
    const byCategory = new Map<string, number>();
    const modelIds = new Set<string>();
    for (const e of entries) {
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + 1);
      if (e.model_id) modelIds.add(e.model_id);
    }
    return {
      total: entries.length,
      categories: byCategory.size,
      models: modelIds.size,
      general: entries.filter((e) => !e.model_id).length,
    };
  }, [entries]);

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

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedEntries = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
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
      addToast(libraryToast("Audit log failed", err instanceof Error ? err.message : "Could not load audit log", "high"));
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

  function toggleQuickCopy(entryId: string) {
    setQuickCopyIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, customFieldRows: [newCustomRow()] });
    setCategoryQuery("");
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
      email: entry.fields.email,
      email_password: "",
      phone: "",
      backup_codes: "",
      recovery_email: "",
      recovery_password: "",
      notes: "",
      customFieldRows: entry.custom_field_keys.length
        ? entry.custom_field_keys.map((key) => ({ ...newCustomRow(), key, value: "" }))
        : [],
    });
    setCategoryQuery(entry.category);
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

      const customFields: Record<string, string> = {};
      for (const row of form.customFieldRows) {
        const key = row.key.trim();
        if (!key) continue;
        customFields[key] = row.value.trim();
      }
      if (editingId || Object.keys(customFields).length > 0) {
        data.customFields = customFields;
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

      addToast(libraryToast(editingId ? "Entry updated" : "Entry created", payload.label, "normal"));
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
      addToast(libraryToast("Save failed", err instanceof Error ? err.message : "Could not save", "high"));
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
      addToast(libraryToast("Deleted", entry.label, "normal"));
      setDeleteTarget(null);
      if (selectedId === entry.id) setSelectedId(null);
      await loadEntries();
    } catch (err) {
      addToast(libraryToast("Delete failed", err instanceof Error ? err.message : "Could not delete", "high"));
    }
  }

  async function handleReveal(entryId: string, field: CredentialFieldRef) {
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
      addToast(libraryToast("Reveal failed", err instanceof Error ? err.message : "Could not reveal field", "high"));
    } finally {
      setRevealingField(null);
    }
  }

  function handleRemask(entryId: string, field: string) {
    setRevealed((prev) => {
      const entryRevealed = { ...(prev[entryId] ?? {}) };
      delete entryRevealed[field];
      const next = { ...prev };
      if (Object.keys(entryRevealed).length === 0) delete next[entryId];
      else next[entryId] = entryRevealed;
      return next;
    });
  }

  async function handleCopy(entryId: string, field: CredentialFieldRef, label?: string) {
    try {
      const res = await fetch(`/api/admin/credentials/${entryId}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field }),
      });
      const body = (await res.json()) as { value?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Copy failed");
      await copyTextToClipboard(body.value ?? "");
      addToast(libraryToast("Copied", `${label ?? fieldDisplayLabel(field)} copied to clipboard`, "normal"));
    } catch (err) {
      addToast(libraryToast("Copy failed", err instanceof Error ? err.message : "Could not copy", "high"));
    }
  }

  function displayFieldValue(entry: MaskedCredentialEntry, field: CredentialField): string {
    if (!entry.has_value[field]) return "—";
    const revealedValue = revealed[entry.id]?.[field];
    if (revealedValue !== undefined) return revealedValue || "—";
    return entry.fields[field] || "—";
  }

  function displayCustomValue(entry: MaskedCredentialEntry, key: string): string {
    const ref = toCustomFieldRef(key);
    const revealedValue = revealed[entry.id]?.[ref];
    if (revealedValue !== undefined) return revealedValue || "—";
    return entry.custom_fields[key] ?? MASKED_VALUE;
  }

  function isFieldRevealed(entryId: string, field: string): boolean {
    return revealed[entryId]?.[field] !== undefined;
  }

  function renderEntryCard(entry: MaskedCredentialEntry, compact = false) {
    const isSelected = selectedId === entry.id;
    const quickCopy = quickCopyIds.has(entry.id);
    const modelLabel = entry.model_id ? modelById[entry.model_id] : null;

    return (
      <div
        key={entry.id}
        className={cn(
          "group relative overflow-hidden rounded-2xl border transition",
          isSelected ? "ring-1 ring-[#D4AF8C]/40" : "hover:border-white/15",
        )}
        style={{ borderColor: isSelected ? GOLD_DIM : BORDER, background: PANEL }}
      >
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10 blur-2xl" style={{ background: GOLD }} />
        <div className="relative p-4">
          <div className="flex items-start gap-3">
            <CategoryBadge category={entry.category} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-white">{entry.label}</h3>
                  <p className="mt-0.5 text-xs text-white/45">{entry.category}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Tip label={quickCopy ? "Expanded detail view" : "Quick copy username & password"}>
                    <button
                      type="button"
                      onClick={() => toggleQuickCopy(entry.id)}
                      className={cn(
                        "rounded-lg border p-1.5 transition",
                        quickCopy ? "border-[#D4AF8C]/40 text-[#D4AF8C]" : "border-white/10 text-white/45 hover:text-white",
                      )}
                    >
                      <Zap className="h-3.5 w-3.5" />
                    </button>
                  </Tip>
                  <button
                    type="button"
                    onClick={() => setSelectedId(entry.id)}
                    className={cn(
                      "rounded-lg border px-2 py-1 text-[11px] transition",
                      isSelected ? "border-[#D4AF8C]/40 text-[#D4AF8C]" : "border-white/10 text-white/50 hover:text-white",
                    )}
                  >
                    {compact ? "Open" : "Details"}
                  </button>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {modelLabel ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#D4AF8C]/25 bg-[#D4AF8C]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#D4AF8C]">
                    <User className="h-3 w-3" aria-hidden />
                    {modelLabel}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/50">
                    <Building2 className="h-3 w-3" aria-hidden />
                    Company / General
                  </span>
                )}
                {entry.has_custom_fields && (
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/40">
                    {entry.custom_field_keys.length} custom
                  </span>
                )}
              </div>

              {entry.fields.username ? (
                <p className="mt-2 truncate font-mono text-xs text-white/55">{entry.fields.username}</p>
              ) : null}
              {entry.fields.email ? (
                <p className="mt-0.5 truncate font-mono text-xs text-white/40">{entry.fields.email}</p>
              ) : null}

              {quickCopy ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {entry.has_value.username && (
                    <button
                      type="button"
                      onClick={() => void handleCopy(entry.id, "username", "Username")}
                      className="flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium text-white/85 transition hover:border-[#D4AF8C]/35 hover:text-[#D4AF8C]"
                      style={{ borderColor: BORDER, background: "rgba(255,255,255,0.03)" }}
                    >
                      <Copy className="h-4 w-4" />
                      Copy username
                    </button>
                  )}
                  {entry.has_value.password && (
                    <button
                      type="button"
                      onClick={() => void handleCopy(entry.id, "password", "Password")}
                      className="flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-[#0D0B0D] transition hover:opacity-90"
                      style={{ background: GOLD }}
                    >
                      <Copy className="h-4 w-4" />
                      Copy password
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderDetailPanel(entry: MaskedCredentialEntry) {
    const standardFields = CREDENTIAL_FIELDS.filter(
      (field) => entry.has_value[field] || field === "notes" || field === "username",
    );

    return (
      <>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <CategoryBadge category={entry.category} size="md" />
            <div>
              <p className="text-xs uppercase tracking-widest text-white/40">{entry.category}</p>
              <h2 className="mt-1 text-xl font-semibold text-white">{entry.label}</h2>
              <p className="mt-1 text-sm text-white/45">
                {entry.model_id ? modelById[entry.model_id] : "Company / General"}
              </p>
            </div>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => openEdit(entry)}
                className="rounded-lg border px-3 py-1.5 text-xs text-white/75 hover:text-white"
                style={{ borderColor: BORDER }}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(entry)}
                className="inline-flex items-center gap-1 rounded-lg border border-red-500/25 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Delete
              </button>
            </div>
          )}
        </div>

        {entry.has_value.username && entry.has_value.password && (
          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void handleCopy(entry.id, "username", "Username")}
              className="flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm text-white/85 hover:border-[#D4AF8C]/35"
              style={{ borderColor: BORDER }}
            >
              <Copy className="h-4 w-4" />
              Copy username
            </button>
            <button
              type="button"
              onClick={() => void handleCopy(entry.id, "password", "Password")}
              className="flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-[#0D0B0D]"
              style={{ background: GOLD }}
            >
              <Copy className="h-4 w-4" />
              Copy password
            </button>
          </div>
        )}

        <div className="space-y-3">
          {standardFields.map((field) => {
            if (!entry.has_value[field] && field !== "username") return null;
            const value = displayFieldValue(entry, field);
            const isSecret = !["username", "email"].includes(field) && field !== "notes";
            const isRevealedNow = isFieldRevealed(entry.id, field);
            const revealKey = `${entry.id}:${field}`;
            const busy = revealingField === revealKey;

            return (
              <div
                key={field}
                className="rounded-xl border px-3 py-3"
                style={{ borderColor: isSecret && !isRevealedNow ? GOLD_DIM : BORDER, background: "rgba(255,255,255,0.02)" }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-widest text-white/40">{CREDENTIAL_FIELD_LABELS[field]}</p>
                    <p
                      className={cn(
                        "mt-1 break-all text-sm",
                        isSecret && !isRevealedNow ? "font-mono tracking-widest text-[#D4AF8C]/70" : "font-mono text-white/85",
                        field === "notes" && "whitespace-pre-wrap font-sans tracking-normal",
                      )}
                    >
                      {value}
                    </p>
                  </div>
                  {entry.has_value[field] && (
                    <div className="flex shrink-0 items-center gap-1">
                      {isSecret && (
                        <Tip label={isRevealedNow ? "Hide value" : "Reveal value (audit logged)"}>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              isRevealedNow ? handleRemask(entry.id, field) : void handleReveal(entry.id, field)
                            }
                            className="inline-flex items-center justify-center rounded-md border border-white/[0.08] bg-[#0D0B0D]/60 p-1.5 text-white/55 transition hover:border-[#D4AF8C]/30 hover:text-[#D4AF8C]"
                          >
                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isRevealedNow ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </Tip>
                      )}
                      <Tip label="Copy to clipboard (audit logged)">
                        <button
                          type="button"
                          onClick={() => void handleCopy(entry.id, field, CREDENTIAL_FIELD_LABELS[field])}
                          className="inline-flex items-center justify-center rounded-md border border-white/[0.08] bg-[#0D0B0D]/60 p-1.5 text-white/55 transition hover:border-[#D4AF8C]/30 hover:text-[#D4AF8C]"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </Tip>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {entry.custom_field_keys.map((key) => {
            const ref = toCustomFieldRef(key);
            const value = displayCustomValue(entry, key);
            const isRevealedNow = isFieldRevealed(entry.id, ref);
            const revealKey = `${entry.id}:${ref}`;
            const busy = revealingField === revealKey;

            return (
              <div
                key={key}
                className="rounded-xl border px-3 py-3"
                style={{ borderColor: !isRevealedNow ? GOLD_DIM : BORDER, background: "rgba(255,255,255,0.02)" }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-widest text-white/40">{key}</p>
                    <p className={cn("mt-1 break-all font-mono text-sm", isRevealedNow ? "text-white/85" : "tracking-widest text-[#D4AF8C]/70")}>
                      {value}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Tip label={isRevealedNow ? "Hide value" : "Reveal custom field (audit logged)"}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          isRevealedNow ? handleRemask(entry.id, ref) : void handleReveal(entry.id, ref)
                        }
                        className="inline-flex items-center justify-center rounded-md border border-white/[0.08] bg-[#0D0B0D]/60 p-1.5 text-white/55 transition hover:border-[#D4AF8C]/30 hover:text-[#D4AF8C]"
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isRevealedNow ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </Tip>
                    <Tip label="Copy custom field (audit logged)">
                      <button
                        type="button"
                        onClick={() => void handleCopy(entry.id, ref, key)}
                        className="inline-flex items-center justify-center rounded-md border border-white/[0.08] bg-[#0D0B0D]/60 p-1.5 text-white/55 transition hover:border-[#D4AF8C]/30 hover:text-[#D4AF8C]"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </Tip>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-xs text-white/35">
          Updated {formatTimestamp(entry.updated_at)}
          {entry.updated_by_name ? ` by ${entry.updated_by_name}` : ""}
        </p>
      </>
    );
  }

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
                Encrypted library
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Password Library</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/55">
                AES-256-GCM encrypted storage with flexible categories and custom fields. Secrets stay masked until you reveal or copy — every action is audit logged.
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
                    Add entry
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <LuxuryStatCard label="Total entries" value={<CountUp value={stats.total} />} accent="champagne" tooltip="All saved passwords and credentials" />
          <LuxuryStatCard label="Categories" value={<CountUp value={stats.categories} />} accent="white" tooltip="Unique category labels in use" />
          <LuxuryStatCard label="Model-specific" value={<CountUp value={stats.models} />} accent="pink" tooltip="Models with at least one entry" />
          <LuxuryStatCard label="Company / General" value={<CountUp value={stats.general} />} accent="emerald" tooltip="Entries not tied to a model" />
        </div>

        {/* Filters */}
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" aria-hidden />
              <FormInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search label, category, model, username, email…"
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
              {categoriesInUse.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value as ScopeFilter)}
                className="rounded-lg border bg-[#0D0B0D]/80 px-3 py-2 text-sm text-white/85"
                style={{ borderColor: BORDER }}
              >
                <option value="">All scopes</option>
                <option value="general">Company / General</option>
                <option value="model">Model-specific</option>
              </select>
              <select
                value={customFieldsFilter}
                onChange={(e) => setCustomFieldsFilter(e.target.value as CustomFieldsFilter)}
                className="rounded-lg border bg-[#0D0B0D]/80 px-3 py-2 text-sm text-white/85"
                style={{ borderColor: BORDER }}
              >
                <option value="">Any fields</option>
                <option value="yes">Has custom fields</option>
                <option value="no">Standard only</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-white/35">View</span>
            <button
              type="button"
              onClick={() => setViewMode("all")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition",
                viewMode === "all" ? "border-[#D4AF8C]/40 text-[#D4AF8C]" : "border-white/10 text-white/50 hover:text-white",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              All entries
            </button>
            <button
              type="button"
              onClick={() => setViewMode("tree")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition",
                viewMode === "tree" ? "border-[#D4AF8C]/40 text-[#D4AF8C]" : "border-white/10 text-white/50 hover:text-white",
              )}
            >
              <FolderTree className="h-3.5 w-3.5" />
              Tree browse
            </button>
            <span className="ml-auto text-xs text-white/35">
              {filtered.length} result{filtered.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {viewMode === "all" ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div>
              {loading ? (
                <div className="flex items-center justify-center rounded-2xl border py-20" style={{ borderColor: BORDER, background: PANEL }}>
                  <Loader2 className="h-5 w-5 animate-spin text-white/50" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="rounded-2xl border py-16 text-center text-sm text-white/45" style={{ borderColor: BORDER, background: PANEL }}>
                  No entries match your filters.
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {pagedEntries.map((entry) => renderEntryCard(entry))}
                  </div>
                  {pageCount > 1 && (
                    <div className="mt-4 flex items-center justify-between rounded-xl border px-3 py-2" style={{ borderColor: BORDER, background: PANEL }}>
                      <button
                        type="button"
                        disabled={page === 0}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-white/60 disabled:opacity-30"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </button>
                      <span className="text-xs text-white/45">
                        Page {page + 1} of {pageCount}
                      </span>
                      <button
                        type="button"
                        disabled={page >= pageCount - 1}
                        onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-white/60 disabled:opacity-30"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="rounded-2xl border p-4 sm:p-5 lg:sticky lg:top-4 lg:self-start" style={{ borderColor: BORDER, background: PANEL }}>
              {!selected ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center text-center text-white/45">
                  <Grid3X3 className="mb-3 h-10 w-10 opacity-30" aria-hidden />
                  <p className="text-sm">Select an entry to view full details.</p>
                </div>
              ) : (
                renderDetailPanel(selected)
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="rounded-2xl border p-4" style={{ borderColor: BORDER, background: PANEL }}>
              <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-white/45">
                <Lock className="h-3.5 w-3.5" aria-hidden />
                Model → Category → Entry
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-16 text-white/50">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                </div>
              ) : tree.size === 0 ? (
                <p className="py-12 text-center text-sm text-white/45">No entries yet.</p>
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
                          ? "Company / General"
                          : modelById[modelKey] ?? "Unknown model";
                      const modelExpanded = expandedModels.has(modelKey);
                      const isGeneral = modelKey === "__general__";
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
                            {isGeneral ? (
                              <Building2 className="h-4 w-4 shrink-0 text-white/45" aria-hidden />
                            ) : (
                              <User className="h-4 w-4 shrink-0" style={{ color: GOLD }} aria-hidden />
                            )}
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
                                        <CategoryBadge category={category} size="sm" />
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

            <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: BORDER, background: PANEL }}>
              {!selected ? (
                <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center text-white/45">
                  <KeyRound className="mb-3 h-10 w-10 opacity-30" aria-hidden />
                  <p className="text-sm">Select an entry from the tree.</p>
                </div>
              ) : (
                renderDetailPanel(selected)
              )}
            </div>
          </div>
        )}
      </div>

      {/* Form modal */}
      {formOpen && canManage && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border p-5 sm:p-6"
            style={{ borderColor: BORDER, background: PANEL }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">{editingId ? "Edit entry" : "Add entry"}</h3>
              <button type="button" onClick={() => setFormOpen(false)} className="text-white/50 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="text-white/80">Label</Label>
                <FormInput
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. Main OF login"
                  className="mt-1 text-base"
                />
              </div>

              <div className="sm:col-span-2">
                <Label className="text-white/80">Notes</Label>
                <Textarea
                  value={form.notes ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  placeholder={editingId ? "Leave blank to keep existing notes" : "Recovery hints, context, 2FA details…"}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Scope</Label>
                <select
                  value={form.model_id}
                  onChange={(e) => setForm((f) => ({ ...f, model_id: e.target.value }))}
                  className={cn(
                    "mt-1 w-full rounded-lg border px-3 py-2 text-sm",
                    form.model_id
                      ? "border-[#D4AF8C]/30 bg-[#D4AF8C]/10 text-[#D4AF8C]"
                      : "border-white/10 bg-white/[0.03] text-white/70",
                  )}
                >
                  <option value="">Company / General</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.model_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <Label>Category</Label>
                <FormInput
                  value={form.category}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, category: e.target.value }));
                    setCategoryQuery(e.target.value);
                    setShowCategorySuggestions(true);
                  }}
                  onFocus={() => setShowCategorySuggestions(true)}
                  onBlur={() => window.setTimeout(() => setShowCategorySuggestions(false), 150)}
                  placeholder="Type or pick a category…"
                  className="mt-1"
                />
                {showCategorySuggestions && categorySuggestions.length > 0 && (
                  <div
                    className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-lg border shadow-xl"
                    style={{ borderColor: BORDER, background: "#111" }}
                  >
                    {categorySuggestions.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setForm((f) => ({ ...f, category: c }));
                          setCategoryQuery(c);
                          setShowCategorySuggestions(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white/75 hover:bg-white/[0.05]"
                      >
                        <CategoryBadge category={c} size="sm" />
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {CREDENTIAL_FIELDS.filter((f) => f !== "notes").map((field) => (
                <div key={field} className={field === "backup_codes" ? "sm:col-span-2" : ""}>
                  <Label>{CREDENTIAL_FIELD_LABELS[field]}</Label>
                  {field === "backup_codes" ? (
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
                        editingId && !["username", "email"].includes(field)
                          ? "Leave blank to keep existing"
                          : undefined
                      }
                    />
                  )}
                </div>
              ))}

              <div className="sm:col-span-2">
                <div className="mb-2 flex items-center justify-between">
                  <Label className="inline-flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5 text-white/45" />
                    Custom fields
                  </Label>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, customFieldRows: [...f.customFieldRows, newCustomRow()] }))}
                    className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-white/60 hover:text-white"
                    style={{ borderColor: BORDER }}
                  >
                    <Plus className="h-3 w-3" />
                    Add custom field
                  </button>
                </div>
                <div className="space-y-2">
                  {form.customFieldRows.length === 0 ? (
                    <p className="text-xs text-white/40">No custom fields — add API keys, PINs, security answers, etc.</p>
                  ) : (
                    form.customFieldRows.map((row) => (
                      <div key={row.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                        <FormInput
                          value={row.key}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              customFieldRows: f.customFieldRows.map((r) =>
                                r.id === row.id ? { ...r, key: e.target.value } : r,
                              ),
                            }))
                          }
                          placeholder="Field name"
                        />
                        <FormInput
                          value={row.value}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              customFieldRows: f.customFieldRows.map((r) =>
                                r.id === row.id ? { ...r, value: e.target.value } : r,
                              ),
                            }))
                          }
                          type="password"
                          autoComplete="off"
                          placeholder={editingId ? "Leave blank to keep existing" : "Value"}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              customFieldRows: f.customFieldRows.filter((r) => r.id !== row.id),
                            }))
                          }
                          className="rounded-lg border border-red-500/20 px-2 text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
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
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border"
            style={{ borderColor: BORDER, background: PANEL }}
          >
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: BORDER }}>
              <div>
                <h3 className="text-lg font-semibold text-white">Audit log</h3>
                <p className="text-xs text-white/45">Every reveal, copy, and change across the Password Library</p>
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
                  {auditLogs.map((log) => {
                    const entryLabel = entries.find((e) => e.id === log.credential_id)?.label;
                    return (
                      <div
                        key={log.id}
                        className="rounded-xl border px-3 py-3 text-sm"
                        style={{ borderColor: BORDER, background: "rgba(255,255,255,0.02)" }}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                            style={{ background: GOLD_DIM, color: GOLD }}
                          >
                            {actionLabel(log.action)}
                          </span>
                          {log.field_name && (
                            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/50">
                              {fieldDisplayLabel(log.field_name)}
                            </span>
                          )}
                          <span className="ml-auto text-xs text-white/35">{formatTimestamp(log.timestamp)}</span>
                        </div>
                        <p className="mt-1.5 font-medium text-white/80">{log.user_name ?? log.user_id}</p>
                        {entryLabel && <p className="mt-0.5 text-xs text-white/40">Entry: {entryLabel}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete entry?"
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

/** Display name alias for Password Library. */
export const PasswordLibraryClient = CredentialsVaultClient;
