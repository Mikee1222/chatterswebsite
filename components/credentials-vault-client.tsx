"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  FolderTree,
  Grid3X3,
  HeartPulse,
  KeyRound,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Loader2,
  Lock,
  Plus,
  ScrollText,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
  User,
  X,
  Zap,
} from "lucide-react";
import { useToast } from "@/contexts/toast-context";
import { AdminRowAvatar } from "@/components/admin-list-primitives";
import { FormInput } from "@/components/ui/form-input";
import { Label, Textarea } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CountUp, LuxuryStatCard, SectionLabel } from "@/components/infloww-performance-ui";
import { copyTextPreservingGesture, copyTextToClipboard } from "@/lib/winner-videos-copy";
import {
  EXPECTED_CATEGORY_LABELS,
  attentionReasonLabel,
  categoryVisual,
  entryCardSecondaryPreview,
  normalizeCategoryKey,
  parseBackupCodes,
  parseLabeledPipeNotes,
} from "@/lib/credentials-ui-helpers";
import {
  CREDENTIAL_CATEGORY_SUGGESTIONS,
  CREDENTIAL_FIELD_LABELS,
  CREDENTIAL_FIELDS,
  CREDENTIAL_LIST_PLAINTEXT_FIELDS,
  MASKED_VALUE,
  toCustomFieldRef,
  type CredentialField,
  type CredentialFieldRef,
  type CredentialSecretData,
} from "@/lib/credentials-types";
import type {
  CredentialAccessLogRecord,
  CredentialLibraryInsights,
  MaskedCredentialEntry,
} from "@/services/credential-entries";
import type { AppNotification, ModelRecord } from "@/types";
import { cn } from "@/lib/utils";

const Pie = dynamic(() => import("recharts").then((m) => m.Pie), { ssr: false });
const PieChart = dynamic(() => import("recharts").then((m) => m.PieChart), { ssr: false });
const Cell = dynamic(() => import("recharts").then((m) => m.Cell), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), {
  ssr: false,
});
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });

const BG = "#050505";
const PANEL = "#0d0d0d";
const BORDER = "rgba(255,255,255,0.08)";
const GOLD = "#D4AF8C";
const GOLD_DIM = "rgba(212,175,140,0.15)";
const PAGE_SIZE = 24;

type ViewMode = "dashboard" | "tree" | "category" | "security" | "all";

const VIEW_TABS: { id: ViewMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "tree", label: "By Model", icon: FolderTree },
  { id: "category", label: "By Category", icon: Layers },
  { id: "security", label: "Security Health", icon: ShieldAlert },
  { id: "all", label: "All Entries", icon: LayoutGrid },
];
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

function relativeTime(ts: string): string {
  try {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 48) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 14) return `${days}d ago`;
    return formatTimestamp(ts);
  } catch {
    return ts;
  }
}

function CoverageRing({ pct, size = "md" }: { pct: number; size?: "sm" | "md" }) {
  const reduce = useReducedMotion();
  const r = size === "sm" ? 18 : 24;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const tone = pct >= 70 ? "#10B981" : pct >= 45 ? GOLD : "#F59E0B";
  const dim = size === "sm" ? "h-12 w-12" : "h-16 w-16";
  const text = size === "sm" ? "text-[10px]" : "text-xs";

  return (
    <div className={cn("relative shrink-0", dim)}>
      <svg viewBox="0 0 56 56" className="h-full w-full -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
        <motion.circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduce ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn("font-semibold tabular-nums text-white/85", text)}>{pct}%</span>
      </div>
    </div>
  );
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

function SecretChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex max-w-full items-center rounded-full border px-2.5 py-1 font-mono text-[12px] tracking-wide text-[#F5E6D3]"
      style={{ borderColor: GOLD_DIM, background: "rgba(212,175,140,0.12)" }}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function RevealedFieldValue({
  field,
  value,
}: {
  field: CredentialField | "custom";
  value: string;
}) {
  if (!value || value === "—") {
    return <p className="mt-1 font-mono text-sm text-white/45">—</p>;
  }

  if (field === "backup_codes") {
    const codes = parseBackupCodes(value);
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {codes.map((code, index) => (
          <SecretChip key={`${code}-${index}`}>{code}</SecretChip>
        ))}
      </div>
    );
  }

  if (field === "notes") {
    const pairs = parseLabeledPipeNotes(value);
    if (pairs) {
      return (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {pairs.map((pair) => (
            <div
              key={pair.label}
              className="rounded-lg border px-3 py-2"
              style={{ borderColor: BORDER, background: "rgba(255,255,255,0.03)" }}
            >
              <p className="text-[10px] uppercase tracking-widest text-white/40">{pair.label}</p>
              <p className="mt-1 break-all font-mono text-sm text-white/90">{pair.value}</p>
            </div>
          ))}
        </div>
      );
    }
    return (
      <p className="mt-1 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-white/85">
        {value}
      </p>
    );
  }

  if (field === "custom") {
    return (
      <p className="mt-1 whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-white/85">
        {value}
      </p>
    );
  }

  return <p className="mt-1 break-all font-mono text-sm text-white/85">{value}</p>;
}

export function CredentialsVaultClient({
  modelById,
  models,
  canManage,
}: CredentialsVaultClientProps) {
  const { addToast } = useToast();
  const reduceMotion = useReducedMotion();
  const [entries, setEntries] = React.useState<MaskedCredentialEntry[]>([]);
  const [insights, setInsights] = React.useState<CredentialLibraryInsights | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [insightsLoading, setInsightsLoading] = React.useState(true);
  const [viewMode, setViewMode] = React.useState<ViewMode>("dashboard");
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("");
  const [modelFilter, setModelFilter] = React.useState("");
  const [scopeFilter, setScopeFilter] = React.useState<ScopeFilter>("");
  const [customFieldsFilter, setCustomFieldsFilter] = React.useState<CustomFieldsFilter>("");
  const [page, setPage] = React.useState(0);
  const [expandedModels, setExpandedModels] = React.useState<Set<string>>(new Set(["__general__"]));
  const [expandedCategories, setExpandedCategories] = React.useState<Set<string>>(new Set());
  const [expandedCategoryGroups, setExpandedCategoryGroups] = React.useState<Set<string>>(new Set());
  const [expandedCategoryModels, setExpandedCategoryModels] = React.useState<Set<string>>(new Set());
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

  const loadInsights = React.useCallback(async () => {
    setInsightsLoading(true);
    try {
      const res = await fetch("/api/admin/credentials/insights", { cache: "no-store" });
      const data = (await res.json()) as { insights?: CredentialLibraryInsights; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load insights");
      setInsights(data.insights ?? null);
    } catch (err) {
      addToast(
        libraryToast(
          "Insights failed",
          err instanceof Error ? err.message : "Could not load dashboard insights",
          "high",
        ),
      );
    } finally {
      setInsightsLoading(false);
    }
  }, [addToast]);

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
    void loadInsights();
  }, [loadEntries, loadInsights]);

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

  const categoryTree = React.useMemo(() => {
    const byCategory = new Map<string, Map<string, MaskedCredentialEntry[]>>();
    for (const entry of filtered) {
      const catKey = normalizeCategoryKey(entry.category);
      if (!byCategory.has(catKey)) byCategory.set(catKey, new Map());
      const byModel = byCategory.get(catKey)!;
      const modelKey = entry.model_id ?? "__general__";
      if (!byModel.has(modelKey)) byModel.set(modelKey, []);
      byModel.get(modelKey)!.push(entry);
    }
    return byCategory;
  }, [filtered]);

  const modelQuickAccess = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      if (!e.model_id) continue;
      counts.set(e.model_id, (counts.get(e.model_id) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([modelId, count]) => ({
        modelId,
        name: modelById[modelId] ?? "Unknown model",
        count,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [entries, modelById]);

  const chartSegments = React.useMemo(() => {
    const source = insights?.category_breakdown ?? [];
    return source.slice(0, 8).map((row) => ({
      name: row.category,
      value: row.count,
      fill: categoryVisual(row.category).chartColor,
    }));
  }, [insights]);

  const neverAccessedEntries = React.useMemo(() => {
    if (!insights) return [];
    const idSet = new Set(insights.never_accessed_ids);
    return entries.filter((e) => idSet.has(e.id));
  }, [entries, insights]);

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

  function toggleCategoryGroup(key: string) {
    setExpandedCategoryGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleCategoryModel(key: string) {
    setExpandedCategoryModels((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function goToEntry(entryId: string, mode: ViewMode = "all") {
    setViewMode(mode);
    setSelectedId(entryId);
  }

  function goToModel(modelId: string) {
    setViewMode("tree");
    setModelFilter(modelId);
    setExpandedModels((prev) => new Set(prev).add(modelId));
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
      void loadInsights();
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
      void loadInsights();
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
    const fieldLabel = label ?? fieldDisplayLabel(field);
    const cached = revealed[entryId]?.[field];

    const fetchCopyValue = async (): Promise<string> => {
      const res = await fetch(`/api/admin/credentials/${entryId}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field }),
      });
      const body = (await res.json()) as { value?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Copy failed");
      const value = body.value ?? "";
      setRevealed((prev) => ({
        ...prev,
        [entryId]: { ...(prev[entryId] ?? {}), [field]: value },
      }));
      return value;
    };

    try {
      // Already revealed: write clipboard immediately (stays inside user gesture).
      if (cached !== undefined) {
        const ok = await copyTextToClipboard(cached);
        if (!ok) throw new Error("Clipboard unavailable");
        addToast(libraryToast("Copied!", `${fieldLabel} copied to clipboard`, "normal"));
        // Audit log in background — do not await before clipboard write.
        void fetch(`/api/admin/credentials/${entryId}/copy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field }),
        }).catch(() => {});
        return;
      }

      // Not revealed: ClipboardItem(Promise) keeps the gesture on Chromium/Safari;
      // otherwise resolve then fallback writeText/execCommand.
      const ok = await copyTextPreservingGesture(fetchCopyValue());
      if (!ok) throw new Error("Clipboard unavailable");
      addToast(libraryToast("Copied!", `${fieldLabel} copied to clipboard`, "normal"));
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
      <motion.div
        key={entry.id}
        layout={!reduceMotion}
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className={cn(
          "group relative overflow-hidden rounded-2xl border shadow-[0_8px_32px_rgba(0,0,0,0.35)] transition-all duration-300",
          isSelected ? "ring-1 ring-[#D4AF8C]/40 shadow-[0_12px_40px_rgba(212,175,140,0.08)]" : "hover:border-white/15 hover:shadow-[0_12px_40px_rgba(0,0,0,0.45)]",
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
              {(() => {
                const preview = entryCardSecondaryPreview(entry);
                return preview ? (
                  <p className="mt-2 text-xs leading-snug text-emerald-200/70">{preview}</p>
                ) : null;
              })()}

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
      </motion.div>
    );
  }

  function renderEmptyState({
    icon: Icon,
    title,
    description,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
  }) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-2xl border py-16 text-center"
        style={{ borderColor: BORDER, background: PANEL }}
      >
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D4AF8C]/20 bg-[#D4AF8C]/10">
          <Icon className="h-6 w-6 text-[#D4AF8C]/70" aria-hidden />
        </div>
        <p className="text-sm font-medium text-white/75">{title}</p>
        <p className="mt-1 max-w-sm px-4 text-xs text-white/40">{description}</p>
      </div>
    );
  }

  function renderLoadingState() {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-2xl border py-20"
        style={{ borderColor: BORDER, background: PANEL }}
      >
        <Loader2 className="h-6 w-6 animate-spin text-[#D4AF8C]/60" aria-hidden />
        <p className="text-sm text-white/45">Loading Password Library…</p>
      </div>
    );
  }

  function renderDetailShell(content: React.ReactNode, EmptyIcon: React.ComponentType<{ className?: string }>, emptyText: string) {
    return (
      <div className="rounded-2xl border p-4 sm:p-5 lg:sticky lg:top-4 lg:self-start" style={{ borderColor: BORDER, background: PANEL }}>
        {!selected ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center text-center text-white/45">
            <EmptyIcon className="mb-3 h-10 w-10 opacity-30" aria-hidden />
            <p className="text-sm">{emptyText}</p>
          </div>
        ) : (
          content
        )}
      </div>
    );
  }

  function renderDashboardView() {
    const pieTotal = chartSegments.reduce((sum, s) => sum + s.value, 0);

    return (
      <div className="mt-4 space-y-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: BORDER, background: PANEL }}>
            <SectionLabel>Category breakdown</SectionLabel>
            <div className="relative mt-4 h-64 w-full">
              {insightsLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-white/40" />
                </div>
              ) : pieTotal === 0 ? (
                renderEmptyState({
                  icon: Layers,
                  title: "No categories yet",
                  description: "Add entries to see distribution across platforms.",
                })
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartSegments}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="46%"
                      innerRadius={52}
                      outerRadius={82}
                      paddingAngle={chartSegments.length > 1 ? 3 : 0}
                      stroke="rgba(10, 10, 16, 0.9)"
                      strokeWidth={2}
                    >
                      {chartSegments.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <text x="50%" y="46%" textAnchor="middle" dominantBaseline="central" fill="rgba(255,255,255,0.92)" fontSize={22} fontWeight={700}>
                      {pieTotal}
                    </text>
                    <text x="50%" y="46%" dy={18} textAnchor="middle" fill="rgba(255,255,255,0.42)" fontSize={11} fontWeight={500}>
                      entries
                    </text>
                    <Tooltip
                      contentStyle={{ background: "#141414", border: `1px solid ${BORDER}`, borderRadius: 12, fontSize: 12 }}
                      labelStyle={{ color: "rgba(255,255,255,0.7)" }}
                      itemStyle={{ color: GOLD }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <LuxuryStatCard
              label="Model-specific"
              value={<CountUp value={insights?.model_specific_count ?? stats.total - stats.general} />}
              accent="pink"
              tooltip="Entries tied to a creator model"
            />
            <LuxuryStatCard
              label="Company / General"
              value={<CountUp value={insights?.general_count ?? stats.general} />}
              accent="emerald"
              tooltip="Shared credentials not tied to a model"
            />
            <LuxuryStatCard
              label="Needs attention"
              value={<CountUp value={insights?.needs_attention.length ?? 0} />}
              accent="white"
              tooltip="Notes flagged banned, deactivated, or not working"
            />
            <LuxuryStatCard
              label="Never accessed"
              value={<CountUp value={insights?.never_accessed_ids.length ?? 0} />}
              accent="champagne"
              tooltip="No reveal or copy logged in audit trail"
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: BORDER, background: PANEL }}>
            <SectionLabel>Recently added</SectionLabel>
            <div className="mt-3 space-y-2">
              {(insights?.recently_added ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-white/40">No entries yet.</p>
              ) : (
                insights!.recently_added.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => goToEntry(row.id)}
                    className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition hover:border-[#D4AF8C]/25 hover:bg-white/[0.03]"
                    style={{ borderColor: BORDER }}
                  >
                    <CategoryBadge category={row.category} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white/90">{row.label}</p>
                      <p className="text-xs text-white/40">{relativeTime(row.created_at)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: BORDER, background: PANEL }}>
            <SectionLabel>Recently accessed</SectionLabel>
            <div className="mt-3 space-y-2">
              {(insights?.recently_accessed ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-white/40">No reveal or copy activity yet.</p>
              ) : (
                insights!.recently_accessed.map((row) => {
                  const entry = entries.find((e) => e.id === row.credential_id);
                  if (!entry) return null;
                  return (
                    <button
                      key={row.credential_id}
                      type="button"
                      onClick={() => goToEntry(row.credential_id)}
                      className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition hover:border-[#D4AF8C]/25 hover:bg-white/[0.03]"
                      style={{ borderColor: BORDER }}
                    >
                      <CategoryBadge category={entry.category} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white/90">{entry.label}</p>
                        <p className="text-xs text-white/40">
                          {relativeTime(row.last_accessed_at)} · {row.access_count} action{row.access_count === 1 ? "" : "s"}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: BORDER, background: PANEL }}>
          <SectionLabel>Quick access by model</SectionLabel>
          {modelQuickAccess.length === 0 ? (
            <p className="mt-4 py-8 text-center text-sm text-white/40">No model-specific entries yet.</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {modelQuickAccess.map(({ modelId, name, count }) => (
                <button
                  key={modelId}
                  type="button"
                  onClick={() => goToModel(modelId)}
                  className="group flex items-center gap-3 rounded-2xl border p-3 text-left transition hover:border-[#D4AF8C]/30 hover:bg-white/[0.03]"
                  style={{ borderColor: BORDER, background: "rgba(255,255,255,0.02)" }}
                >
                  <AdminRowAvatar name={name} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white/90 group-hover:text-[#D4AF8C]">{name}</p>
                    <p className="text-xs text-white/40">{count} entr{count === 1 ? "y" : "ies"}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderCategoryView() {
    return (
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="rounded-2xl border p-4" style={{ borderColor: BORDER, background: PANEL }}>
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-white/45">
            <Layers className="h-3.5 w-3.5" aria-hidden />
            Category → Model → Entry
          </div>
          {loading ? (
            renderLoadingState()
          ) : categoryTree.size === 0 ? (
            renderEmptyState({ icon: Layers, title: "No entries", description: "Try adjusting your filters." })
          ) : (
            <div className="space-y-2">
              {[...categoryTree.entries()]
                .sort(([a], [b]) => {
                  const labelA = categoryVisual(a === "other" ? "Other" : EXPECTED_CATEGORY_LABELS[a as keyof typeof EXPECTED_CATEGORY_LABELS] ?? a).label;
                  const labelB = categoryVisual(b === "other" ? "Other" : EXPECTED_CATEGORY_LABELS[b as keyof typeof EXPECTED_CATEGORY_LABELS] ?? b).label;
                  return labelA.localeCompare(labelB);
                })
                .map(([catKey, modelsMap]) => {
                  const displayCategory =
                    EXPECTED_CATEGORY_LABELS[catKey as keyof typeof EXPECTED_CATEGORY_LABELS] ??
                    [...modelsMap.values()].flat()[0]?.category ??
                    catKey;
                  const catExpanded = expandedCategoryGroups.has(catKey);
                  const total = [...modelsMap.values()].reduce((sum, items) => sum + items.length, 0);
                  return (
                    <div key={catKey} className="rounded-xl border" style={{ borderColor: BORDER }}>
                      <button
                        type="button"
                        onClick={() => toggleCategoryGroup(catKey)}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-white/90 hover:bg-white/[0.03]"
                      >
                        {catExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-white/45" /> : <ChevronRight className="h-4 w-4 shrink-0 text-white/45" />}
                        <CategoryBadge category={displayCategory} size="sm" />
                        {displayCategory}
                        <span className="ml-auto text-xs text-white/35">{total}</span>
                      </button>
                      {catExpanded && (
                        <div className="border-t px-2 py-2" style={{ borderColor: BORDER }}>
                          {[...modelsMap.entries()]
                            .sort(([a], [b]) => {
                              if (a === "__general__") return -1;
                              if (b === "__general__") return 1;
                              return (modelById[a] ?? "").localeCompare(modelById[b] ?? "");
                            })
                            .map(([modelKey, items]) => {
                              const modelLabel = modelKey === "__general__" ? "Company / General" : modelById[modelKey] ?? "Unknown model";
                              const modelNodeKey = `${catKey}::${modelKey}`;
                              const modelExpanded = expandedCategoryModels.has(modelNodeKey);
                              return (
                                <div key={modelNodeKey} className="mb-1 last:mb-0">
                                  <button
                                    type="button"
                                    onClick={() => toggleCategoryModel(modelNodeKey)}
                                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-white/75 hover:bg-white/[0.03]"
                                  >
                                    {modelExpanded ? <ChevronDown className="h-3.5 w-3.5 text-white/40" /> : <ChevronRight className="h-3.5 w-3.5 text-white/40" />}
                                    {modelKey === "__general__" ? (
                                      <Building2 className="h-4 w-4 shrink-0 text-white/45" />
                                    ) : (
                                      <AdminRowAvatar name={modelLabel} size="sm" />
                                    )}
                                    {modelLabel}
                                    <span className="ml-auto text-xs text-white/35">{items.length}</span>
                                  </button>
                                  {modelExpanded && (
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
        {renderDetailShell(selected ? renderDetailPanel(selected) : null, KeyRound, "Select an entry from the category tree.")}
      </div>
    );
  }

  function renderSecurityView() {
    const attention = insights?.needs_attention ?? [];

    return (
      <div className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <LuxuryStatCard label="Needs attention" value={<CountUp value={attention.length} />} accent="pink" tooltip="Banned, deactivated, or not working in notes" />
          <LuxuryStatCard label="Never accessed" value={<CountUp value={neverAccessedEntries.length} />} accent="champagne" tooltip="No reveal/copy in audit log" />
          <LuxuryStatCard label="Models tracked" value={<CountUp value={insights?.model_coverage.length ?? 0} />} accent="white" tooltip="Models with credential coverage data" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: BORDER, background: PANEL }}>
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-300" aria-hidden />
              <SectionLabel>Needs attention</SectionLabel>
            </div>
            {insightsLoading ? (
              renderLoadingState()
            ) : attention.length === 0 ? (
              renderEmptyState({ icon: Shield, title: "All clear", description: "No banned, deactivated, or not-working flags in notes." })
            ) : (
              <div className="space-y-2">
                {attention.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => goToEntry(row.id, "security")}
                    className="w-full rounded-xl border px-3 py-3 text-left transition hover:border-amber-500/30 hover:bg-amber-500/[0.04]"
                    style={{ borderColor: "rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.04)" }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <CategoryBadge category={row.category} size="sm" />
                      <span className="text-sm font-medium text-white/90">{row.label}</span>
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                        {attentionReasonLabel(row.reason)}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-white/45">{row.note_snippet}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: BORDER, background: PANEL }}>
            <div className="mb-3 flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-[#D4AF8C]" aria-hidden />
              <SectionLabel>Never accessed</SectionLabel>
            </div>
            {insightsLoading ? (
              renderLoadingState()
            ) : neverAccessedEntries.length === 0 ? (
              renderEmptyState({ icon: Lock, title: "Fully audited", description: "Every entry has at least one reveal or copy logged." })
            ) : (
              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {neverAccessedEntries.slice(0, 24).map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => goToEntry(entry.id, "security")}
                    className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition hover:border-white/15 hover:bg-white/[0.03]"
                    style={{ borderColor: BORDER }}
                  >
                    <CategoryBadge category={entry.category} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white/85">{entry.label}</p>
                      <p className="text-xs text-white/40">{entry.model_id ? modelById[entry.model_id] : "Company / General"}</p>
                    </div>
                  </button>
                ))}
                {neverAccessedEntries.length > 24 ? (
                  <p className="pt-2 text-center text-xs text-white/35">+ {neverAccessedEntries.length - 24} more</p>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: BORDER, background: PANEL }}>
          <SectionLabel>Completeness per model</SectionLabel>
          <p className="mt-1 text-xs text-white/40">Expected platform categories filled vs baseline set ({EXPECTED_CATEGORY_LABELS.instagram}, {EXPECTED_CATEGORY_LABELS.onlyfans}, etc.)</p>
          {insightsLoading ? (
            <div className="mt-4">{renderLoadingState()}</div>
          ) : (insights?.model_coverage ?? []).length === 0 ? (
            <p className="mt-6 py-8 text-center text-sm text-white/40">No model-specific entries to score.</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {insights!.model_coverage.map((row) => {
                const name = modelById[row.model_id] ?? "Unknown model";
                return (
                  <div key={row.model_id} className="rounded-2xl border p-3" style={{ borderColor: BORDER, background: "rgba(255,255,255,0.02)" }}>
                    <div className="flex items-center gap-3">
                      <AdminRowAvatar name={name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white/90">{name}</p>
                        <p className="text-xs text-white/40">
                          {row.filled_categories.length}/{row.expected_categories.length} categories · {row.entry_count} entries
                        </p>
                      </div>
                      <CoverageRing pct={row.coverage_pct} size="sm" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {row.expected_categories.map((key) => {
                        const filled = row.filled_categories.includes(key);
                        return (
                          <span
                            key={key}
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px]",
                              filled ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-200" : "border border-white/10 text-white/30",
                            )}
                          >
                            {EXPECTED_CATEGORY_LABELS[key]}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderDetailPanel(entry: MaskedCredentialEntry) {
    const isSim = normalizeCategoryKey(entry.category) === "sim";
    const standardFields = CREDENTIAL_FIELDS.filter((field) => entry.has_value[field]).sort((a, b) => {
      if (!isSim) return 0;
      const rank = (field: CredentialField) => (field === "notes" ? 0 : field === "phone" ? 1 : 2);
      return rank(a) - rank(b);
    });

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

        {isSim && entry.has_value.notes && (
          <div
            className="mb-4 rounded-xl border px-3 py-3"
            style={{ borderColor: "rgba(16,185,129,0.25)", background: "rgba(16,185,129,0.06)" }}
          >
            <p className="text-[10px] uppercase tracking-widest text-emerald-200/70">SIM details</p>
            <p className="mt-1 text-sm text-white/70">
              Number, PIN, and PUK live in Notes (Notion import). Reveal Notes below to view them as structured fields.
            </p>
          </div>
        )}

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
            const value = displayFieldValue(entry, field);
            const isPlain = (CREDENTIAL_LIST_PLAINTEXT_FIELDS as readonly string[]).includes(field);
            const isSecret = !isPlain;
            const isRevealedNow = isFieldRevealed(entry.id, field);
            const revealKey = `${entry.id}:${field}`;
            const busy = revealingField === revealKey;
            const showFormatted = !isSecret || isRevealedNow;

            return (
              <div
                key={field}
                className="rounded-xl border px-3 py-3"
                style={{ borderColor: isSecret && !isRevealedNow ? GOLD_DIM : BORDER, background: "rgba(255,255,255,0.02)" }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-widest text-white/40">{CREDENTIAL_FIELD_LABELS[field]}</p>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={isSecret && !isRevealedNow ? "masked" : `value-${value}`}
                        initial={reduceMotion ? false : { opacity: 0, rotateX: -8 }}
                        animate={{ opacity: 1, rotateX: 0 }}
                        exit={reduceMotion ? undefined : { opacity: 0, rotateX: 8 }}
                        transition={{ duration: 0.2 }}
                      >
                        {showFormatted ? (
                          <RevealedFieldValue field={field} value={value} />
                        ) : (
                          <p className="mt-1 break-all font-mono text-sm tracking-widest text-[#D4AF8C]/70">{value}</p>
                        )}
                      </motion.div>
                    </AnimatePresence>
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
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="text-[10px] uppercase tracking-widest text-white/40">{key}</p>
                    {isRevealedNow ? (
                      <RevealedFieldValue field="custom" value={value} />
                    ) : (
                      <p className="mt-1 break-all font-mono text-sm tracking-widest text-[#D4AF8C]/70">{value}</p>
                    )}
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

          {standardFields.length === 0 && entry.custom_field_keys.length === 0 && (
            <p className="rounded-xl border border-dashed px-3 py-6 text-center text-sm text-white/40" style={{ borderColor: BORDER }}>
              No stored fields on this entry.
            </p>
          )}
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

        {/* Stats — always visible */}
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <LuxuryStatCard label="Total entries" value={<CountUp value={stats.total} />} accent="champagne" tooltip="All saved passwords and credentials" />
          <LuxuryStatCard label="Categories" value={<CountUp value={stats.categories} />} accent="white" tooltip="Unique category labels in use" />
          <LuxuryStatCard label="Models covered" value={<CountUp value={stats.models} />} accent="pink" tooltip="Models with at least one entry" />
          <LuxuryStatCard label="Company / General" value={<CountUp value={stats.general} />} accent="emerald" tooltip="Entries not tied to a model" />
        </div>

        {/* Tab navigation */}
        <div
          className="mt-4 inline-flex max-w-full flex-wrap rounded-2xl border border-white/[0.08] bg-[#0D0B0D]/70 p-1 shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)]"
          role="tablist"
          aria-label="Password Library views"
        >
          {VIEW_TABS.map(({ id, label, icon: Icon }) => {
            const active = viewMode === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setViewMode(id)}
                className={cn(
                  "relative inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition sm:px-4",
                  active ? "text-white" : "text-[#B8B4B8]/55 hover:text-[#B8B4B8]",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="password-library-tab"
                    className="absolute inset-0 rounded-xl border border-[#D4AF8C]/25 bg-gradient-to-br from-[#D4AF8C]/20 to-[#D4AF8C]/5"
                    transition={reduceMotion ? { duration: 0 } : { type: "spring", damping: 28, stiffness: 380 }}
                  />
                ) : null}
                <Icon className="relative h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="relative">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Filters — browse views */}
        {viewMode !== "dashboard" && viewMode !== "security" ? (
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
            <p className="text-right text-xs text-white/35">
              {filtered.length} result{filtered.length === 1 ? "" : "s"}
            </p>
          </div>
        ) : null}

        <AnimatePresence mode="wait">
          <motion.div
            key={viewMode}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            {viewMode === "dashboard" && renderDashboardView()}
            {viewMode === "category" && renderCategoryView()}
            {viewMode === "security" && renderSecurityView()}
            {viewMode === "all" && (
              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <div>
                  {loading ? (
                    renderLoadingState()
                  ) : filtered.length === 0 ? (
                    renderEmptyState({
                      icon: LayoutGrid,
                      title: "No matches",
                      description: "Try adjusting your search or filters.",
                    })
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
                {renderDetailShell(selected ? renderDetailPanel(selected) : null, Grid3X3, "Select an entry to view full details.")}
              </div>
            )}
            {viewMode === "tree" && (
              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                <div className="rounded-2xl border p-4" style={{ borderColor: BORDER, background: PANEL }}>
                  <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-white/45">
                    <Lock className="h-3.5 w-3.5" aria-hidden />
                    Model → Category → Entry
                  </div>
                  {loading ? (
                    renderLoadingState()
                  ) : tree.size === 0 ? (
                    renderEmptyState({ icon: FolderTree, title: "No entries", description: "Try adjusting your filters." })
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
                                  <AdminRowAvatar name={modelLabel} size="sm" />
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
                {renderDetailShell(selected ? renderDetailPanel(selected) : null, KeyRound, "Select an entry from the tree.")}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
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
