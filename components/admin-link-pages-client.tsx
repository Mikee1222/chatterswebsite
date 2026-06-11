"use client";

import * as React from "react";
import {
  AlertTriangle,
  Archive,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  Link2,
  Loader2,
  Monitor,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Smartphone,
  Trash2,
  Upload,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useToast } from "@/contexts/toast-context";
import { FormInput } from "@/components/ui/form-input";
import { Label, Textarea } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LINK_PAGE_PLATFORMS } from "@/lib/link-pages-schema";
import { PLATFORM_BRANDING, detectLinkPlatform } from "@/lib/link-page-styles";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type {
  AppNotification,
  AnalyticsSummary,
  GlobalAnalyticsSummary,
  LinkPageBlockRecord,
  LinkPageBlockType,
  LinkPageRecord,
  LinkPageWithBlocks,
  ModelRecord,
} from "@/types";

/* ── Design tokens ── */
const BG = "#050505";
const PANEL = "#0a0a0a";
const BORDER = "rgba(255,255,255,0.08)";
const ACCENT = "#ec4899";
const PIE_COLORS = ["#ec4899", "#a855f7", "#38bdf8", "#34d399", "#fbbf24", "#f97316"];

function localToast(title: string, body: string, priority: "normal" | "high"): AppNotification {
  const id = `toast-${Date.now()}`;
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

const COLOR_SWATCH_STYLE: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: "50%",
  border: "none",
  cursor: "pointer",
  padding: 0,
  background: "none",
};

function toColorInputValue(hex: string | undefined, fallback: string): string {
  if (!hex) return fallback;
  const trimmed = hex.trim();
  const full = trimmed.match(/^#([0-9a-fA-F]{6})$/);
  if (full) return `#${full[1].toLowerCase()}`;
  const short = trimmed.match(/^#([0-9a-fA-F]{3})$/);
  if (short) {
    const [r, g, b] = short[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return fallback;
}

function NativeColorSwatch({
  value,
  fallback,
  onChange,
}: {
  value: string | undefined;
  fallback: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="color"
      value={toColorInputValue(value, fallback)}
      onChange={(e) => onChange(e.target.value)}
      style={COLOR_SWATCH_STYLE}
    />
  );
}

const PLATFORM_PRESETS = LINK_PAGE_PLATFORMS.filter((p) => p.id !== "custom");

function blockPlatform(block: LinkPageBlockRecord): string {
  return detectLinkPlatform(block);
}

const BLOCK_TYPES: Array<{ value: LinkPageBlockType; label: string; icon: string }> = [
  { value: "link", label: "Link", icon: "🔗" },
  { value: "heading", label: "Heading", icon: "H" },
  { value: "bio_text", label: "Bio text", icon: "¶" },
  { value: "photo_grid", label: "Photo grid", icon: "🖼" },
  { value: "countdown", label: "Countdown", icon: "⏱" },
  { value: "social_bar", label: "Social bar", icon: "◎" },
  { value: "spacer", label: "Spacer", icon: "↕" },
];

const STATUS_FILTERS = [
  { value: "all" as const, label: "All" },
  { value: "published" as const, label: "Published" },
  { value: "draft" as const, label: "Draft" },
  { value: "archived" as const, label: "Archived" },
];

type SaveablePageFields = Pick<
  LinkPageRecord,
  | "title"
  | "slug"
  | "model_id"
  | "meta_description"
  | "show_powered_by"
  | "bio"
  | "profile_photo_url"
  | "theme"
  | "font"
  | "background_type"
  | "background_value"
  | "primary_color"
  | "accent_color"
  | "verified"
>;

type DomainDnsRecord = {
  type: string;
  name: string;
  value: string;
};

type DomainStatusResponse = {
  vercelConfigured?: boolean;
  domain?: string;
  verified?: boolean;
  records?: DomainDnsRecord[];
  error?: string;
  page?: LinkPageRecord;
};

function pickSaveableFields(page: LinkPageRecord): SaveablePageFields {
  return {
    title: page.title,
    slug: page.slug,
    model_id: page.model_id,
    meta_description: page.meta_description,
    show_powered_by: page.show_powered_by,
    bio: page.bio,
    profile_photo_url: page.profile_photo_url,
    theme: page.theme,
    font: page.font,
    background_type: page.background_type,
    background_value: page.background_value,
    primary_color: page.primary_color,
    accent_color: page.accent_color,
    verified: page.verified,
  };
}

function diffSaveableFields(baseline: SaveablePageFields, current: SaveablePageFields): Partial<LinkPageRecord> {
  const patch: Partial<LinkPageRecord> = {};
  (Object.keys(baseline) as Array<keyof SaveablePageFields>).forEach((key) => {
    if (current[key] !== baseline[key]) {
      patch[key] = current[key] as never;
    }
  });
  return patch;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function validateSlug(slug: string): string | null {
  if (!slug) return "Slug is required";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return "Use lowercase letters, numbers, and hyphens only";
  }
  return null;
}

type Props = {
  initialPages: LinkPageRecord[];
  modelById: Record<string, string>;
  models: ModelRecord[];
};

type Tab = "editor" | "analytics";

export function AdminLinkPagesClient({ initialPages, modelById, models }: Props) {
  const { addToast } = useToast();
  const [pages, setPages] = React.useState(initialPages);
  const [selectedId, setSelectedId] = React.useState<string | null>(initialPages[0]?.id ?? null);
  const [selectedPage, setSelectedPage] = React.useState<LinkPageWithBlocks | null>(null);
  const [tab, setTab] = React.useState<Tab>("editor");
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "draft" | "published" | "archived">("all");
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [analytics, setAnalytics] = React.useState<AnalyticsSummary | null>(null);
  const [realtime, setRealtime] = React.useState(0);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);

  /* UI-only state */
  const [globalAnalyticsOpen, setGlobalAnalyticsOpen] = React.useState(false);
  const [globalAnalytics, setGlobalAnalytics] = React.useState<GlobalAnalyticsSummary | null>(null);
  const [globalAnalyticsLoading, setGlobalAnalyticsLoading] = React.useState(false);
  const [previewDevice, setPreviewDevice] = React.useState<"mobile" | "desktop">("mobile");
  const [previewKey, setPreviewKey] = React.useState(0);
  const [draft, setDraft] = React.useState<SaveablePageFields | null>(null);
  const [saved, setSaved] = React.useState<SaveablePageFields | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [slugError, setSlugError] = React.useState<string | null>(null);
  const [showQr, setShowQr] = React.useState(false);
  const draftRef = React.useRef(draft);
  const savedRef = React.useRef(saved);

  draftRef.current = draft;
  savedRef.current = saved;
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    () => new Set(["identity", "profile", "appearance", "blocks"])
  );
  const [pageStatsMap, setPageStatsMap] = React.useState<Record<string, { views: number; clicks: number }>>({});

  const filteredPages = pages.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      p.slug.toLowerCase().includes(q) ||
      (modelById[p.model_id] ?? "").toLowerCase().includes(q)
    );
  });

  const loadPage = React.useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/link-pages/${encodeURIComponent(id)}`);
      const data = (await res.json()) as { page?: LinkPageWithBlocks; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load page");
      setSelectedPage(data.page ?? null);
    } catch (err) {
      addToast(localToast("Load failed", err instanceof Error ? err.message : "Could not load page", "high"));
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  React.useEffect(() => {
    if (selectedId) void loadPage(selectedId);
    else setSelectedPage(null);
  }, [selectedId, loadPage]);

  React.useEffect(() => {
    if (!selectedPage) {
      setDraft(null);
      setSaved(null);
      setIsSaving(false);
      setSlugError(null);
      return;
    }
    const fields = pickSaveableFields(selectedPage);
    setDraft(fields);
    setSaved(fields);
    setIsSaving(false);
    setSlugError(null);
  }, [selectedPage?.id]);

  const hasUnsavedChanges = React.useMemo(() => {
    if (!draft || !saved) return false;
    return Object.keys(diffSaveableFields(saved, draft)).length > 0;
  }, [draft, saved]);

  const handleSave = React.useCallback(
    async (data?: SaveablePageFields) => {
      if (!selectedId || !selectedPage || !savedRef.current) return;

      const source = data ?? draftRef.current;
      if (!source) return;

      let currentDraft = { ...source };
      if ("slug" in diffSaveableFields(savedRef.current, currentDraft)) {
        const normalizedSlug = slugify(currentDraft.slug);
        const slugValidation = validateSlug(normalizedSlug);
        if (slugValidation) {
          setSlugError(slugValidation);
          addToast(localToast("Invalid slug", slugValidation, "high"));
          return;
        }
        currentDraft.slug = normalizedSlug;
        if (normalizedSlug !== source.slug) {
          setDraft(currentDraft);
        }
      }

      const patch = diffSaveableFields(savedRef.current, currentDraft);
      if (Object.keys(patch).length === 0) {
        setSlugError(null);
        return;
      }

      setSlugError(null);
      setIsSaving(true);
      try {
        const res = await fetch(`/api/admin/link-pages/${encodeURIComponent(selectedId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const responseData = (await res.json()) as { page?: LinkPageRecord; error?: string };
        if (!res.ok) throw new Error(responseData.error ?? "Save failed");
        if (responseData.page) {
          const savedFields = pickSaveableFields(responseData.page);
          setSaved(savedFields);
          setDraft(savedFields);
          setPages((prev) =>
            prev.map((p) => (p.id === responseData.page!.id ? { ...p, ...responseData.page } : p))
          );
          setSelectedPage((prev) => (prev ? { ...prev, ...responseData.page! } : prev));
          setPreviewKey((prev) => prev + 1);
        }
      } catch (err) {
        addToast(localToast("Save failed", err instanceof Error ? err.message : "Error", "high"));
      } finally {
        setIsSaving(false);
      }
    },
    [selectedId, selectedPage, addToast]
  );

  const updateTextDraft = React.useCallback((patch: Partial<SaveablePageFields>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    if ("slug" in patch) {
      const normalized = slugify(patch.slug ?? "");
      setSlugError(validateSlug(normalized));
    }
  }, []);

  const updateImmediateField = React.useCallback(
    (patch: Partial<SaveablePageFields>) => {
      const next = draftRef.current ? { ...draftRef.current, ...patch } : null;
      if (!next) return;
      setDraft(next);
      void handleSave(next);
    },
    [handleSave]
  );

  const handleFieldBlur = React.useCallback(() => {
    void handleSave();
  }, [handleSave]);

  const handleDomainUpdated = React.useCallback(
    (domain: string) => {
      if (!selectedId) return;
      setPages((prev) => prev.map((p) => (p.id === selectedId ? { ...p, custom_domain: domain } : p)));
      setSelectedPage((prev) => (prev ? { ...prev, custom_domain: domain } : prev));
    },
    [selectedId]
  );

  const loadAnalytics = React.useCallback(async (id: string) => {
    try {
      const [aRes, rRes] = await Promise.all([
        fetch(`/api/admin/link-pages/${encodeURIComponent(id)}/analytics?days=30`),
        fetch(`/api/admin/link-pages/${encodeURIComponent(id)}/analytics/realtime`),
      ]);
      const aData = (await aRes.json()) as { summary?: AnalyticsSummary };
      const rData = (await rRes.json()) as { count?: number };
      setAnalytics(aData.summary ?? null);
      setRealtime(rData.count ?? 0);
    } catch {
      setAnalytics(null);
    }
  }, []);

  React.useEffect(() => {
    if (tab === "analytics" && selectedId) void loadAnalytics(selectedId);
  }, [tab, selectedId, loadAnalytics]);

  React.useEffect(() => {
    if (tab !== "analytics" || !selectedId) return;
    const t = setInterval(() => void loadAnalytics(selectedId), 30_000);
    return () => clearInterval(t);
  }, [tab, selectedId, loadAnalytics]);

  const loadGlobalAnalytics = React.useCallback(async () => {
    setGlobalAnalyticsLoading(true);
    try {
      const res = await fetch("/api/admin/link-pages/analytics/global?days=30");
      const data = (await res.json()) as { summary?: GlobalAnalyticsSummary; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load global analytics");
      setGlobalAnalytics(data.summary ?? null);
      if (data.summary) {
        const map: Record<string, { views: number; clicks: number }> = {};
        for (const row of data.summary.leaderboard) {
          map[row.page_id] = { views: row.views, clicks: row.clicks };
        }
        setPageStatsMap(map);
      }
    } catch (err) {
      addToast(
        localToast("Analytics failed", err instanceof Error ? err.message : "Could not load", "high")
      );
    } finally {
      setGlobalAnalyticsLoading(false);
    }
  }, [addToast]);

  React.useEffect(() => {
    if (globalAnalyticsOpen) void loadGlobalAnalytics();
  }, [globalAnalyticsOpen, loadGlobalAnalytics]);

  async function createPage() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/link-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New link page" }),
      });
      const data = (await res.json()) as { page?: LinkPageRecord; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      if (data.page) {
        setPages((prev) => [data.page!, ...prev]);
        setSelectedId(data.page.id);
        setGlobalAnalyticsOpen(false);
        addToast(localToast("Page created", data.page.title, "normal"));
      }
    } catch (err) {
      addToast(localToast("Create failed", err instanceof Error ? err.message : "Error", "high"));
    } finally {
      setSaving(false);
    }
  }

  async function publish(action: "publish" | "unpublish" | "archive" = "publish") {
    if (!selectedId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/link-pages/${encodeURIComponent(selectedId)}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: action === "publish" ? undefined : action }),
      });
      const data = (await res.json()) as { page?: LinkPageRecord; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      if (data.page) {
        setPages((prev) => prev.map((p) => (p.id === data.page!.id ? data.page! : p)));
        setSelectedPage((prev) => (prev ? { ...prev, ...data.page! } : prev));
        addToast(localToast("Updated", `Status: ${data.page.status}`, "normal"));
      }
    } catch (err) {
      addToast(localToast("Failed", err instanceof Error ? err.message : "Error", "high"));
    } finally {
      setSaving(false);
    }
  }

  async function deletePage() {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/admin/link-pages/${encodeURIComponent(selectedId)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Delete failed");
      }
      setPages((prev) => prev.filter((p) => p.id !== selectedId));
      setSelectedId(pages.find((p) => p.id !== selectedId)?.id ?? null);
      addToast(localToast("Deleted", "Page removed", "normal"));
    } catch (err) {
      addToast(localToast("Delete failed", err instanceof Error ? err.message : "Error", "high"));
    }
    setDeleteOpen(false);
  }

  async function addBlock(type: LinkPageBlockType) {
    if (!selectedId || !selectedPage) return;
    try {
      const res = await fetch(`/api/admin/link-pages/${encodeURIComponent(selectedId)}/blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          block_type: type,
          label: type === "heading" ? "Section title" : type === "link" ? "New link" : "",
          sort_order: selectedPage.blocks.length,
        }),
      });
      const data = (await res.json()) as { block?: LinkPageBlockRecord; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Add block failed");
      if (data.block) {
        setSelectedPage((prev) =>
          prev ? { ...prev, blocks: [...prev.blocks, data.block!].sort((a, b) => a.sort_order - b.sort_order) } : prev
        );
      }
    } catch (err) {
      addToast(localToast("Add block failed", err instanceof Error ? err.message : "Error", "high"));
    }
  }

  async function updateBlock(block: LinkPageBlockRecord) {
    try {
      const res = await fetch(`/api/admin/link-pages/blocks/${encodeURIComponent(block.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_id: block.page_id,
          block_type: block.block_type,
          sort_order: block.sort_order,
          is_visible: block.is_visible,
          label: block.label,
          url: block.url,
          icon: block.icon,
          sublabel: block.sublabel,
          style: block.style,
          platform: block.platform,
          custom_button_color: block.custom_button_color,
          photo_urls: block.photo_urls,
          countdown_target: block.countdown_target,
          heading_text: block.heading_text,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Update failed");
      }
    } catch (err) {
      addToast(localToast("Block save failed", err instanceof Error ? err.message : "Error", "high"));
    }
  }

  async function removeBlock(blockId: string) {
    try {
      const res = await fetch(`/api/admin/link-pages/blocks/${encodeURIComponent(blockId)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setSelectedPage((prev) =>
        prev ? { ...prev, blocks: prev.blocks.filter((b) => b.id !== blockId) } : prev
      );
    } catch (err) {
      addToast(localToast("Delete block failed", err instanceof Error ? err.message : "Error", "high"));
    }
  }

  async function reorderBlocks(newBlocks: LinkPageBlockRecord[]) {
    if (!selectedId || !selectedPage) return;
    setSelectedPage({ ...selectedPage, blocks: newBlocks });
    try {
      await fetch(`/api/admin/link-pages/${encodeURIComponent(selectedId)}/blocks/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: newBlocks.map((b) => b.id) }),
      });
    } catch {
      addToast(localToast("Reorder failed", "Could not save order", "high"));
    }
  }

  function moveBlock(index: number, dir: -1 | 1) {
    if (!selectedPage) return;
    const next = [...selectedPage.blocks].sort((a, b) => a.sort_order - b.sort_order);
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void reorderBlocks(next);
  }

  async function uploadPhoto(file: File, onUrl: (url: string) => void) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/admin/link-pages/upload", { method: "POST", body: form });
    const data = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed");
    onUrl(data.url);
  }

  function patchBlockLocal(blockId: string, patch: Partial<LinkPageBlockRecord>) {
    setSelectedPage((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        blocks: prev.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)),
      };
    });
  }

  function toggleSection(key: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function copyPublicUrl() {
    if (!publicUrl) return;
    void navigator.clipboard.writeText(publicUrl);
    addToast(localToast("Copied", "Link copied to clipboard", "normal"));
  }

  const editingPage = selectedPage && draft ? { ...selectedPage, ...draft } : selectedPage;

  const publicUrl = saved?.slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${ROUTES.linkPage(saved.slug)}`
    : "";

  const previewUrl = saved?.slug
    ? `${ROUTES.linkPage(saved.slug)}?preview=true&t=${previewKey}`
    : "";

  const qrUrl = publicUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(publicUrl)}`
    : "";

  const showPreview = !globalAnalyticsOpen && tab === "editor";

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden" style={{ background: BG }}>
      {/* ── LEFT PANEL ── */}
      <aside
        className="flex shrink-0 flex-col border-r"
        style={{ width: 280, background: PANEL, borderColor: BORDER }}
      >
        <div className="border-b p-4" style={{ borderColor: BORDER }}>
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h1 className="text-base font-bold text-white">Link Pages</h1>
              <p className="mt-0.5 text-[11px] leading-snug text-white/40">Build link-in-bio pages for models</p>
            </div>
            <button
              type="button"
              onClick={() => void createPage()}
              disabled={saving}
              title="New page"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ background: ACCENT }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setGlobalAnalyticsOpen((v) => !v);
              if (!globalAnalyticsOpen) setTab("editor");
            }}
            className={cn(
              "mb-3 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
              globalAnalyticsOpen
                ? "border-pink-500/40 bg-pink-500/10 text-pink-200"
                : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white/80"
            )}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            All pages analytics
          </button>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pages…"
              className="w-full rounded-lg border py-2 pl-8 pr-3 text-xs text-white placeholder:text-white/30"
              style={{ background: BG, borderColor: BORDER }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide transition-colors",
                  statusFilter === f.value
                    ? "text-white"
                    : "text-white/40 hover:text-white/70"
                )}
                style={
                  statusFilter === f.value
                    ? { background: `${ACCENT}22`, color: ACCENT, border: `1px solid ${ACCENT}44` }
                    : { border: `1px solid ${BORDER}` }
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filteredPages.map((p) => {
            const stats = pageStatsMap[p.page_id];
            const isSelected = selectedId === p.id && !globalAnalyticsOpen;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedId(p.id);
                  setGlobalAnalyticsOpen(false);
                }}
                className={cn(
                  "mb-1.5 flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all",
                  isSelected ? "border-pink-500/50 bg-pink-500/[0.08]" : "border-transparent hover:border-white/10 hover:bg-white/[0.03]"
                )}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 text-sm font-bold text-white/60"
                  style={{ borderColor: isSelected ? ACCENT : "rgba(255,255,255,0.12)", background: "#141414" }}
                >
                  {p.profile_photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.profile_photo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (p.title || "?").charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1">
                    <span className="truncate text-sm font-medium text-white">{p.title || "Untitled"}</span>
                    <StatusPill status={p.status} />
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-white/35">/{p.slug}</p>
                  {p.model_id ? (
                    <p className="mt-0.5 truncate text-[10px] text-white/25">{modelById[p.model_id] ?? "Model"}</p>
                  ) : null}
                  {stats ? (
                    <div className="mt-1.5 flex gap-3 text-[10px] tabular-nums text-white/40">
                      <span>{stats.views.toLocaleString()} views</span>
                      <span>{stats.clicks.toLocaleString()} clicks</span>
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
          {filteredPages.length === 0 ? (
            <p className="py-12 text-center text-xs text-white/30">No pages found</p>
          ) : null}
        </div>
      </aside>

      {/* ── GLOBAL ANALYTICS (full width) ── */}
      {globalAnalyticsOpen ? (
        <main className="flex flex-1 flex-col overflow-hidden" style={{ background: BG }}>
          <GlobalAnalyticsPanel
            summary={globalAnalytics}
            loading={globalAnalyticsLoading}
            pages={pages}
            onSelectPage={(id) => {
              setSelectedId(id);
              setGlobalAnalyticsOpen(false);
            }}
            onRefresh={() => void loadGlobalAnalytics()}
          />
        </main>
      ) : (
        <>
          {/* ── CENTER PANEL ── */}
          <section
            className="flex shrink-0 flex-col overflow-hidden border-r"
            style={{ width: tab === "analytics" ? undefined : 400, flex: tab === "analytics" ? 1 : undefined, background: PANEL, borderColor: BORDER }}
          >
            {!selectedPage && !loading ? (
              <EmptyState message="Select or create a page" />
            ) : loading ? (
              <LoadingState />
            ) : selectedPage ? (
              <>
                {/* Tab bar + actions */}
                <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: BORDER }}>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <div className="flex gap-1 rounded-lg p-0.5" style={{ background: BG }}>
                      <TabBtn active={tab === "editor"} onClick={() => setTab("editor")}>
                        Editor
                      </TabBtn>
                      <TabBtn active={tab === "analytics"} onClick={() => setTab("analytics")}>
                        <BarChart3 className="mr-1 inline h-3.5 w-3.5" />
                        Analytics
                      </TabBtn>
                    </div>
                    {tab === "editor" ? (
                      <>
                        <SaveStatusIndicator isSaving={isSaving} hasUnsavedChanges={hasUnsavedChanges} />
                        <button
                          type="button"
                          onClick={() => void handleSave()}
                          disabled={isSaving}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                          style={{ background: ACCENT }}
                        >
                          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                          Save
                        </button>
                      </>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StatusToggle
                      status={selectedPage.status}
                      onPublish={() => void publish("publish")}
                      onUnpublish={() => void publish("unpublish")}
                      disabled={saving}
                    />
                    {selectedPage.status === "published" ? (
                      <a
                        href={publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] text-white/60 transition-colors hover:text-white/90"
                        style={{ borderColor: BORDER }}
                      >
                        <ExternalLink className="h-3 w-3" /> Live
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void publish("archive")}
                      className="rounded-lg border p-1.5 text-white/40 transition-colors hover:text-white/70"
                      style={{ borderColor: BORDER }}
                      title="Archive"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteOpen(true)}
                      className="rounded-lg border p-1.5 text-rose-400/60 transition-colors hover:text-rose-300"
                      style={{ borderColor: "rgba(244,63,94,0.2)" }}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {tab === "editor" ? (
                    <EditorPanel
                      page={editingPage!}
                      pageId={selectedId!}
                      models={models}
                      expandedSections={expandedSections}
                      onToggleSection={toggleSection}
                      onPatchTextField={updateTextDraft}
                      onPatchImmediateField={updateImmediateField}
                      onFieldBlur={handleFieldBlur}
                      slugError={slugError}
                      onDomainUpdated={handleDomainUpdated}
                      onAddBlock={(t) => void addBlock(t)}
                      onUpdateBlock={updateBlock}
                      onRemoveBlock={(id) => void removeBlock(id)}
                      onMoveBlock={moveBlock}
                      onUpload={uploadPhoto}
                      patchBlock={patchBlockLocal}
                      dragIndex={dragIndex}
                      setDragIndex={setDragIndex}
                      onReorder={(blocks) => void reorderBlocks(blocks)}
                    />
                  ) : (
                    <div className="p-4">
                      <AnalyticsPanel summary={analytics} realtime={realtime} pageTitle={selectedPage.title} />
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </section>

          {/* ── RIGHT PANEL — Live Preview ── */}
          {showPreview ? (
            <aside
              className="flex shrink-0 flex-col overflow-hidden"
              style={{ width: 400, background: PANEL }}
            >
              <div className="flex shrink-0 items-center justify-between border-b px-4 py-3" style={{ borderColor: BORDER }}>
                <span className="text-sm font-semibold text-white/80">Preview</span>
                <div className="flex gap-1 rounded-lg p-0.5" style={{ background: BG }}>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("mobile")}
                    className={cn(
                      "rounded-md p-1.5 transition-colors",
                      previewDevice === "mobile" ? "text-pink-300" : "text-white/40 hover:text-white/70"
                    )}
                    style={previewDevice === "mobile" ? { background: `${ACCENT}22` } : undefined}
                    title="Mobile"
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("desktop")}
                    className={cn(
                      "rounded-md p-1.5 transition-colors",
                      previewDevice === "desktop" ? "text-pink-300" : "text-white/40 hover:text-white/70"
                    )}
                    style={previewDevice === "desktop" ? { background: `${ACCENT}22` } : undefined}
                    title="Desktop"
                  >
                    <Monitor className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="shrink-0 border-b px-4 py-2.5" style={{ borderColor: BORDER }}>
                <button
                  type="button"
                  onClick={() => setPreviewKey((k) => k + 1)}
                  disabled={!previewUrl}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium text-white/75 transition-colors hover:border-pink-500/40 hover:bg-pink-500/[0.06] hover:text-pink-200 disabled:opacity-40"
                  style={{ borderColor: BORDER, background: BG }}
                  title="Refresh preview"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  ↺ Refresh preview
                </button>
              </div>

              {/* URL bar */}
              <div className="shrink-0 space-y-2 border-b px-4 py-3" style={{ borderColor: BORDER }}>
                <div className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ background: BG, borderColor: BORDER }}>
                  <Link2 className="h-3 w-3 shrink-0 text-white/30" />
                  <span className="min-w-0 flex-1 truncate text-[11px] text-white/50">{publicUrl || "—"}</span>
                  <button type="button" onClick={copyPublicUrl} className="text-white/40 hover:text-white/70" title="Copy URL">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex gap-2">
                  {publicUrl ? (
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[11px] text-white/60 transition-colors hover:text-white/90"
                      style={{ borderColor: BORDER }}
                    >
                      <ExternalLink className="h-3 w-3" /> Test live
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setShowQr((v) => !v)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] transition-colors",
                      showQr ? "text-pink-300" : "text-white/60 hover:text-white/90"
                    )}
                    style={{ borderColor: showQr ? `${ACCENT}44` : BORDER }}
                  >
                    <QrCode className="h-3 w-3" /> QR
                  </button>
                </div>
                {showQr && qrUrl ? (
                  <div className="flex justify-center rounded-lg border p-3" style={{ borderColor: BORDER, background: BG }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrUrl} alt="QR code" width={160} height={160} className="rounded" />
                  </div>
                ) : null}
              </div>

              {/* Preview frame */}
              <div className="flex flex-1 items-start justify-center overflow-y-auto p-4">
                {previewUrl ? (
                  previewDevice === "mobile" ? (
                    <div
                      className="relative overflow-hidden rounded-[2rem] border-[3px] shadow-2xl"
                      style={{
                        width: 375 * 0.85,
                        height: 667 * 0.85,
                        borderColor: "#1a1a1a",
                        background: "#000",
                      }}
                    >
                      <iframe
                        key={previewKey}
                        src={previewUrl}
                        title="Mobile preview"
                        className="border-0"
                        style={{
                          width: 375,
                          height: 667,
                          transform: "scale(0.85)",
                          transformOrigin: "top left",
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      className="overflow-hidden rounded-xl border shadow-2xl"
                      style={{
                        width: 1024 * 0.4,
                        height: 768 * 0.4,
                        borderColor: BORDER,
                        background: "#000",
                      }}
                    >
                      <iframe
                        key={previewKey}
                        src={previewUrl}
                        title="Desktop preview"
                        className="border-0"
                        style={{
                          width: 1024,
                          height: 768,
                          transform: "scale(0.4)",
                          transformOrigin: "top left",
                        }}
                      />
                    </div>
                  )
                ) : (
                  <div className="flex items-center gap-2 text-xs text-white/30">Add a slug to preview</div>
                )}
              </div>
            </aside>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete page?"
        description="This removes the page and all its blocks. This cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={() => void deletePage()}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════ */

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center text-sm text-white/30">{message}</div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin" style={{ color: ACCENT }} />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "published"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : status === "archived"
        ? "bg-white/10 text-white/45 border-white/15"
        : "bg-amber-500/15 text-amber-300 border-amber-500/30";
  return (
    <span className={cn("shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase", cls)}>
      {status}
    </span>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "text-pink-200" : "text-white/45 hover:text-white/75"
      )}
      style={active ? { background: `${ACCENT}22` } : undefined}
    >
      {children}
    </button>
  );
}

function StatusToggle({
  status,
  onPublish,
  onUnpublish,
  disabled,
}: {
  status: string;
  onPublish: () => void;
  onUnpublish: () => void;
  disabled: boolean;
}) {
  const isPublished = status === "published";
  return (
    <button
      type="button"
      disabled={disabled || status === "archived"}
      onClick={() => (isPublished ? onUnpublish() : onPublish())}
      className={cn(
        "relative flex h-7 w-[52px] items-center rounded-full border transition-colors disabled:opacity-40",
        isPublished ? "border-emerald-500/40 bg-emerald-500/20" : "border-white/15 bg-white/[0.06]"
      )}
      title={isPublished ? "Published — click to unpublish" : "Draft — click to publish"}
    >
      <span
        className={cn(
          "absolute h-5 w-5 rounded-full bg-white shadow transition-transform",
          isPublished ? "translate-x-[26px]" : "translate-x-1"
        )}
      />
    </button>
  );
}

function AccordionSection({
  id,
  title,
  expanded,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  expanded: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b" style={{ borderColor: BORDER }}>
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-white/60">{title}</span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-white/30" />
        ) : (
          <ChevronRight className="h-4 w-4 text-white/30" />
        )}
      </button>
      {expanded ? <div className="space-y-3 px-4 pb-4">{children}</div> : null}
    </div>
  );
}

function SaveStatusIndicator({
  isSaving,
  hasUnsavedChanges,
}: {
  isSaving: boolean;
  hasUnsavedChanges: boolean;
}) {
  if (isSaving) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-white/45">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
      </span>
    );
  }
  if (hasUnsavedChanges) {
    return <span className="text-[10px] font-medium text-amber-400">● Unsaved</span>;
  }
  return <span className="text-[10px] font-medium text-emerald-400/90">✓ Saved</span>;
}

function DnsCopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] text-white/55 transition hover:bg-white/5"
      style={{ borderColor: BORDER }}
      title={`Copy ${label}`}
    >
      {copied ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function LinkPageDomainManager({
  pageId,
  customDomain,
  onDomainUpdated,
}: {
  pageId: string;
  customDomain: string;
  onDomainUpdated: (domain: string) => void;
}) {
  const { addToast } = useToast();
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState<DomainStatusResponse | null>(null);
  const [vercelConfigured, setVercelConfigured] = React.useState<boolean | null>(null);

  const checkStatus = React.useCallback(async () => {
    if (!customDomain.trim()) {
      setStatus(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/link-pages/${encodeURIComponent(pageId)}/domain?domain=${encodeURIComponent(customDomain)}`
      );
      const data = (await res.json()) as DomainStatusResponse;
      if (data.vercelConfigured !== undefined) setVercelConfigured(data.vercelConfigured);
      setStatus(data);
    } catch {
      setStatus({ domain: customDomain, verified: false, records: [] });
    } finally {
      setLoading(false);
    }
  }, [pageId, customDomain]);

  React.useEffect(() => {
    if (!customDomain.trim()) {
      setStatus(null);
      setInput("");
      void fetch(`/api/admin/link-pages/${encodeURIComponent(pageId)}/domain`)
        .then((r) => r.json())
        .then((data: DomainStatusResponse) => {
          if (data.vercelConfigured !== undefined) setVercelConfigured(data.vercelConfigured);
        })
        .catch(() => setVercelConfigured(false));
      return;
    }
    void checkStatus();
  }, [pageId, customDomain, checkStatus]);

  React.useEffect(() => {
    if (!customDomain.trim() || status?.verified) return;
    const t = setInterval(() => void checkStatus(), 30_000);
    return () => clearInterval(t);
  }, [customDomain, status?.verified, checkStatus]);

  async function connectDomain() {
    const domain = input.trim();
    if (!domain) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/link-pages/${encodeURIComponent(pageId)}/domain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data = (await res.json()) as DomainStatusResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to connect domain");
      if (data.vercelConfigured !== undefined) setVercelConfigured(data.vercelConfigured);
      if (data.page) onDomainUpdated(data.page.custom_domain);
      else onDomainUpdated(data.domain ?? domain);
      setStatus(data);
      setInput("");
      addToast(localToast("Domain connected", data.domain ?? domain, "normal"));
    } catch (err) {
      addToast(
        localToast("Domain failed", err instanceof Error ? err.message : "Could not connect domain", "high")
      );
    } finally {
      setLoading(false);
    }
  }

  async function removeDomain() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/link-pages/${encodeURIComponent(pageId)}/domain`, {
        method: "DELETE",
      });
      const data = (await res.json()) as DomainStatusResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to remove domain");
      onDomainUpdated("");
      setStatus(null);
      setInput("");
      addToast(localToast("Domain removed", "Custom domain disconnected", "normal"));
    } catch (err) {
      addToast(
        localToast("Remove failed", err instanceof Error ? err.message : "Could not remove domain", "high")
      );
    } finally {
      setLoading(false);
    }
  }

  const isVerified = Boolean(customDomain && status?.verified);
  const visitUrl = customDomain ? `https://${customDomain}` : "";

  return (
    <div className="space-y-2">
      {vercelConfigured === false ? (
        <div
          className="flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] text-amber-200/90"
          style={{ borderColor: "rgba(251,191,36,0.25)", background: "rgba(251,191,36,0.08)" }}
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Automatic domain setup is unavailable. Set <code className="text-amber-100/80">VERCEL_TOKEN</code> and{" "}
            <code className="text-amber-100/80">VERCEL_PROJECT_ID</code> on the server.
          </span>
        </div>
      ) : null}

      {!customDomain ? (
        <div
          className="rounded-lg border border-dashed px-3 py-4"
          style={{ borderColor: "rgba(255,255,255,0.15)" }}
        >
          <p className="mb-2 text-[11px] text-white/45">Connect a custom domain (e.g. links.example.com)</p>
          <div className="flex gap-2">
            <FormInput
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="links.example.com"
              disabled={loading || vercelConfigured === false}
              onKeyDown={(e) => {
                if (e.key === "Enter") void connectDomain();
              }}
            />
            <button
              type="button"
              onClick={() => void connectDomain()}
              disabled={loading || !input.trim() || vercelConfigured === false}
              className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-white transition disabled:opacity-40"
              style={{ background: ACCENT }}
            >
              Connect
            </button>
          </div>
        </div>
      ) : loading && !status ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border py-8" style={{ borderColor: BORDER }}>
          <Loader2 className="h-4 w-4 animate-spin text-white/40" />
          <span className="text-xs text-white/45">Checking domain…</span>
        </div>
      ) : isVerified ? (
        <div
          className="space-y-3 rounded-lg border px-3 py-3"
          style={{ borderColor: "rgba(52,211,153,0.3)", background: "rgba(52,211,153,0.08)" }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-300">Active</span>
            <span className="truncate text-xs text-white/60">{customDomain}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={visitUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] text-white/70 transition hover:text-white"
              style={{ borderColor: BORDER }}
            >
              <ExternalLink className="h-3 w-3" /> Visit link
            </a>
            <button
              type="button"
              onClick={() => void removeDomain()}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] text-rose-300/80 transition hover:text-rose-200 disabled:opacity-40"
              style={{ borderColor: "rgba(244,63,94,0.25)" }}
            >
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          className="space-y-3 rounded-lg border px-3 py-3"
          style={{ borderColor: "rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.06)" }}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-amber-200">Pending DNS</p>
              <p className="mt-0.5 text-[11px] text-white/50">{customDomain}</p>
            </div>
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-amber-200/60" /> : null}
          </div>

          {status?.error ? (
            <p className="text-[11px] text-rose-300/80">{status.error}</p>
          ) : null}

          {(status?.records ?? []).length > 0 ? (
            <div className="overflow-x-auto rounded-lg border" style={{ borderColor: BORDER }}>
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b text-white/40" style={{ borderColor: BORDER }}>
                    <th className="px-2 py-1.5 font-medium">Type</th>
                    <th className="px-2 py-1.5 font-medium">Name</th>
                    <th className="px-2 py-1.5 font-medium">Value</th>
                    <th className="px-2 py-1.5 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {(status?.records ?? []).map((rec) => (
                    <tr key={`${rec.type}-${rec.name}-${rec.value}`} className="border-b" style={{ borderColor: BORDER }}>
                      <td className="px-2 py-1.5 font-mono text-white/70">{rec.type}</td>
                      <td className="px-2 py-1.5 font-mono text-white/70">{rec.name}</td>
                      <td className="max-w-[140px] truncate px-2 py-1.5 font-mono text-white/70" title={rec.value}>
                        {rec.value}
                      </td>
                      <td className="px-2 py-1.5">
                        <DnsCopyButton value={rec.value} label={rec.type} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <p className="text-[10px] text-white/40">
            Add these records at your DNS provider. Status is checked automatically every 30 seconds.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void checkStatus()}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] text-white/70 transition hover:text-white disabled:opacity-40"
              style={{ borderColor: BORDER }}
            >
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} /> Check status
            </button>
            <button
              type="button"
              onClick={() => void removeDomain()}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] text-rose-300/80 transition hover:text-rose-200 disabled:opacity-40"
              style={{ borderColor: "rgba(244,63,94,0.25)" }}
            >
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          </div>
        </div>
      )}

      {loading && customDomain && status ? (
        <p className="text-center text-[10px] text-white/35">
          <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
          Updating…
        </p>
      ) : null}
    </div>
  );
}

function EditorPanel({
  page,
  pageId,
  models,
  expandedSections,
  onToggleSection,
  onPatchTextField,
  onPatchImmediateField,
  onFieldBlur,
  slugError,
  onDomainUpdated,
  onAddBlock,
  onUpdateBlock,
  onRemoveBlock,
  onMoveBlock,
  onUpload,
  patchBlock,
  dragIndex,
  setDragIndex,
  onReorder,
}: {
  page: LinkPageWithBlocks;
  pageId: string;
  models: ModelRecord[];
  expandedSections: Set<string>;
  onToggleSection: (id: string) => void;
  onPatchTextField: (patch: Partial<SaveablePageFields>) => void;
  onPatchImmediateField: (patch: Partial<SaveablePageFields>) => void;
  onFieldBlur: () => void;
  slugError: string | null;
  onDomainUpdated: (domain: string) => void;
  onAddBlock: (t: LinkPageBlockType) => void;
  onUpdateBlock: (b: LinkPageBlockRecord) => Promise<void>;
  onRemoveBlock: (id: string) => void;
  onMoveBlock: (i: number, dir: -1 | 1) => void;
  onUpload: (f: File, cb: (url: string) => void) => Promise<void>;
  patchBlock: (id: string, patch: Partial<LinkPageBlockRecord>) => void;
  dragIndex: number | null;
  setDragIndex: (i: number | null) => void;
  onReorder: (blocks: LinkPageBlockRecord[]) => void;
}) {
  const sorted = [...page.blocks].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div>
      <AccordionSection
        id="identity"
        title="Identity"
        expanded={expandedSections.has("identity")}
        onToggle={onToggleSection}
      >
        <Field label="Title">
          <FormInput
            value={page.title}
            onChange={(e) => onPatchTextField({ title: e.target.value })}
            onBlur={onFieldBlur}
          />
        </Field>
        <Field label="Slug">
          <FormInput
            value={page.slug}
            onChange={(e) => onPatchTextField({ slug: slugify(e.target.value) })}
            onBlur={onFieldBlur}
            error={slugError ?? undefined}
          />
        </Field>
        <Field label="Model">
          <select
            value={page.model_id}
            onChange={(e) => onPatchImmediateField({ model_id: e.target.value })}
            className="w-full rounded-lg border px-3 py-2 text-sm text-white"
            style={{ background: BG, borderColor: BORDER }}
          >
            <option value="">— None —</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.model_name || m.id}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Custom domain">
          <LinkPageDomainManager
            pageId={pageId}
            customDomain={page.custom_domain}
            onDomainUpdated={onDomainUpdated}
          />
        </Field>
        <Field label="Meta description">
          <Textarea
            value={page.meta_description}
            onChange={(e) => onPatchTextField({ meta_description: e.target.value })}
            onBlur={onFieldBlur}
            rows={2}
          />
        </Field>
        <label className="flex items-center gap-2 text-xs text-white/60">
          <input
            type="checkbox"
            checked={page.show_powered_by}
            onChange={(e) => onPatchImmediateField({ show_powered_by: e.target.checked })}
            className="rounded border-white/20"
          />
          Show powered-by badge
        </label>
      </AccordionSection>

      <AccordionSection
        id="profile"
        title="Profile"
        expanded={expandedSections.has("profile")}
        onToggle={onToggleSection}
      >
        <Field label="Bio">
          <Textarea
            value={page.bio}
            onChange={(e) => onPatchTextField({ bio: e.target.value })}
            onBlur={onFieldBlur}
            rows={3}
          />
        </Field>
        <Field label="Profile photo URL">
          <div className="flex gap-2">
            <FormInput
              value={page.profile_photo_url}
              onChange={(e) => onPatchTextField({ profile_photo_url: e.target.value })}
              onBlur={onFieldBlur}
            />
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border px-3 py-2 text-xs text-white/60 hover:bg-white/5" style={{ borderColor: BORDER }}>
              <Upload className="h-3.5 w-3.5" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onUpload(f, (url) => onPatchImmediateField({ profile_photo_url: url }));
                }}
              />
            </label>
          </div>
        </Field>
        <label className="flex items-center gap-2 text-xs text-white/60">
          <input
            type="checkbox"
            checked={page.verified}
            onChange={(e) => onPatchImmediateField({ verified: e.target.checked })}
            className="rounded border-white/20"
          />
          Verified badge
        </label>
      </AccordionSection>

      <AccordionSection
        id="appearance"
        title="Appearance"
        expanded={expandedSections.has("appearance")}
        onToggle={onToggleSection}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Theme">
            <select
              value={page.theme}
              onChange={(e) => onPatchImmediateField({ theme: e.target.value as LinkPageRecord["theme"] })}
              className="w-full rounded-lg border px-3 py-2 text-sm text-white"
              style={{ background: BG, borderColor: BORDER }}
            >
              {(["dark", "light", "minimal", "neon", "gold"] as const).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Font">
            <select
              value={page.font}
              onChange={(e) => onPatchImmediateField({ font: e.target.value as LinkPageRecord["font"] })}
              className="w-full rounded-lg border px-3 py-2 text-sm text-white"
              style={{ background: BG, borderColor: BORDER }}
            >
              {(["modern", "elegant", "bold", "minimal"] as const).map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Background type">
          <select
            value={page.background_type}
            onChange={(e) =>
              onPatchImmediateField({ background_type: e.target.value as LinkPageRecord["background_type"] })
            }
            className="w-full rounded-lg border px-3 py-2 text-sm text-white"
            style={{ background: BG, borderColor: BORDER }}
          >
            <option value="color">Color</option>
            <option value="gradient">Gradient</option>
            <option value="image">Image URL</option>
          </select>
        </Field>
        <Field label="Background value">
          {page.background_type === "color" ? (
            <NativeColorSwatch
              value={page.background_value}
              fallback="#0a0a0a"
              onChange={(v) => onPatchImmediateField({ background_value: v })}
            />
          ) : (
            <FormInput
              value={page.background_value}
              onChange={(e) => onPatchTextField({ background_value: e.target.value })}
              onBlur={onFieldBlur}
              placeholder={page.background_type === "gradient" ? "linear-gradient(...)" : "Image URL"}
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Primary color">
            <NativeColorSwatch
              value={page.primary_color}
              fallback={ACCENT}
              onChange={(v) => onPatchImmediateField({ primary_color: v })}
            />
          </Field>
          <Field label="Accent color">
            <NativeColorSwatch
              value={page.accent_color}
              fallback="#a855f7"
              onChange={(v) => onPatchImmediateField({ accent_color: v })}
            />
          </Field>
        </div>
      </AccordionSection>

      <AccordionSection
        id="blocks"
        title="Blocks"
        expanded={expandedSections.has("blocks")}
        onToggle={onToggleSection}
      >
        {/* Add block grid */}
        <div className="mb-4 grid grid-cols-4 gap-1.5">
          {BLOCK_TYPES.map((bt) => (
            <button
              key={bt.value}
              type="button"
              onClick={() => onAddBlock(bt.value)}
              className="flex flex-col items-center gap-1 rounded-lg border py-2 text-[10px] text-white/50 transition-colors hover:border-pink-500/30 hover:text-pink-200"
              style={{ borderColor: BORDER, background: BG }}
            >
              <span className="text-base leading-none">{bt.icon}</span>
              {bt.label}
            </button>
          ))}
        </div>

        {/* Platform presets */}
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-white/30">Quick presets</p>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {PLATFORM_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onAddBlock("link")}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] text-white/55 transition-colors hover:border-pink-500/30 hover:text-pink-200"
              style={{ borderColor: BORDER }}
              title={`Add ${p.label} link`}
            >
              <span>{p.icon}</span> {p.label}
            </button>
          ))}
        </div>

        {/* Draggable blocks */}
        <div className="space-y-2">
          {sorted.map((block, index) => (
            <div
              key={block.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex === null || dragIndex === index) return;
                const next = [...sorted];
                const [moved] = next.splice(dragIndex, 1);
                next.splice(index, 0, moved);
                setDragIndex(null);
                onReorder(next);
              }}
              className={cn(
                "rounded-xl border p-3 transition-colors",
                dragIndex === index ? "border-pink-500/40 bg-pink-500/[0.05]" : ""
              )}
              style={{ borderColor: dragIndex === index ? undefined : BORDER, background: BG }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-white/40">
                  <GripVertical className="h-4 w-4 cursor-grab text-white/25" />
                  <span className="font-semibold">{block.block_type.replace("_", " ")}</span>
                  {!block.is_visible ? <EyeOff className="h-3 w-3 text-white/25" /> : <Eye className="h-3 w-3 text-white/20" />}
                </div>
                <div className="flex items-center gap-0.5">
                  <button type="button" onClick={() => onMoveBlock(index, -1)} className="p-1 text-white/30 hover:text-white/70">
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => onMoveBlock(index, 1)} className="p-1 text-white/30 hover:text-white/70">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => onRemoveBlock(block.id)} className="p-1 text-rose-400/50 hover:text-rose-300">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <BlockEditor
                block={block}
                pagePrimaryColor={page.primary_color}
                onChange={(patch) => patchBlock(block.id, patch)}
                onSave={(b) => void onUpdateBlock(b)}
                onUpload={onUpload}
              />
            </div>
          ))}
          {sorted.length === 0 ? (
            <p className="py-8 text-center text-xs text-white/25">No blocks yet — add one above</p>
          ) : null}
        </div>
      </AccordionSection>
    </div>
  );
}

function BlockEditor({
  block,
  pagePrimaryColor,
  onChange,
  onSave,
  onUpload,
}: {
  block: LinkPageBlockRecord;
  pagePrimaryColor: string;
  onChange: (patch: Partial<LinkPageBlockRecord>) => void;
  onSave: (block: LinkPageBlockRecord) => void;
  onUpload: (f: File, cb: (url: string) => void) => Promise<void>;
}) {
  if (block.block_type === "spacer") {
    return <p className="text-[11px] text-white/30">Vertical spacer — drag to reposition</p>;
  }

  const selectedPlatform = blockPlatform(block);
  const isCustomPlatform = selectedPlatform === "custom";

  return (
    <div
      className="space-y-2"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          onSave(block);
        }
      }}
    >
      {(block.block_type === "link" || block.block_type === "social_bar") && (
        <>
          <FormInput value={block.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="Label" />
          <FormInput value={block.url} onChange={(e) => onChange({ url: e.target.value })} placeholder="https://…" />
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">Platform</p>
            <div className="flex flex-wrap gap-1.5">
              {LINK_PAGE_PLATFORMS.map((p) => {
                const branding = PLATFORM_BRANDING[p.id];
                const selected = selectedPlatform === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    title={p.label}
                    onClick={() => {
                      const patch: Partial<LinkPageBlockRecord> = {
                        platform: p.id,
                        icon: p.id === "custom" ? block.icon || "🔗" : p.icon,
                      };
                      if (p.id !== "custom" && p.urlPrefix && !block.url) {
                        patch.label = block.label || p.label;
                        patch.url = p.urlPrefix;
                      }
                      onChange(patch);
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors",
                      selected ? "text-white" : "text-white/55 hover:text-white/80"
                    )}
                    style={
                      selected
                        ? {
                            background: branding.pillColor,
                            borderColor: branding.pillColor,
                            color: p.id === "snapchat" ? "#000" : "#fff",
                          }
                        : { borderColor: BORDER, background: "rgba(255,255,255,0.03)" }
                    }
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: branding.pillColor }}
                      aria-hidden="true"
                    />
                    <span>{p.icon}</span>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
          {isCustomPlatform ? (
            <>
              <Field label="Button color">
                <NativeColorSwatch
                  value={block.custom_button_color || pagePrimaryColor}
                  fallback={pagePrimaryColor || ACCENT}
                  onChange={(v) => onChange({ custom_button_color: v })}
                />
              </Field>
              <FormInput
                value={block.icon && block.icon !== "custom" ? block.icon : "🔗"}
                onChange={(e) => onChange({ icon: e.target.value || "🔗" })}
                placeholder="Icon emoji"
              />
            </>
          ) : null}
          {block.block_type === "link" ? (
            <FormInput value={block.sublabel} onChange={(e) => onChange({ sublabel: e.target.value })} placeholder="Sublabel (optional)" />
          ) : null}
        </>
      )}
      {block.block_type === "heading" && (
        <FormInput
          value={block.heading_text || block.label}
          onChange={(e) => onChange({ heading_text: e.target.value, label: e.target.value })}
          placeholder="Heading text"
        />
      )}
      {block.block_type === "bio_text" && (
        <Textarea value={block.label} onChange={(e) => onChange({ label: e.target.value })} rows={2} placeholder="Bio text" />
      )}
      {block.block_type === "countdown" && (
        <>
          <FormInput value={block.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="Countdown label" />
          <FormInput
            type="datetime-local"
            value={block.countdown_target?.slice(0, 16) ?? ""}
            onChange={(e) =>
              onChange({ countdown_target: e.target.value ? new Date(e.target.value).toISOString() : null })
            }
          />
        </>
      )}
      {block.block_type === "photo_grid" && (
        <div className="space-y-2">
          <Textarea
            value={block.photo_urls.join("\n")}
            onChange={(e) =>
              onChange({
                photo_urls: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
              })
            }
            rows={3}
            placeholder="Image URLs (one per line)"
          />
          <label className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-white/50">
            <Upload className="h-3.5 w-3.5" /> Upload
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUpload(f, (url) => onChange({ photo_urls: [...block.photo_urls, url] }));
              }}
            />
          </label>
        </div>
      )}
      {block.block_type === "link" && (
        <select
          value={block.style}
          onChange={(e) => onChange({ style: e.target.value as LinkPageBlockRecord["style"] })}
          className="w-full rounded-lg border px-3 py-1.5 text-xs text-white"
          style={{ background: BG, borderColor: BORDER }}
        >
          {(["default", "prominent", "subtle", "pill", "card"] as const).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      )}
      <label className="flex items-center gap-2 text-[11px] text-white/45">
        <input type="checkbox" checked={block.is_visible} onChange={(e) => onChange({ is_visible: e.target.checked })} />
        Visible
      </label>
    </div>
  );
}

function AnalyticsPanel({
  summary,
  realtime,
  pageTitle,
}: {
  summary: AnalyticsSummary | null;
  realtime: number;
  pageTitle?: string;
}) {
  if (!summary) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-white/35">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" style={{ color: ACCENT }} /> Loading analytics…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {pageTitle ? (
        <h2 className="text-lg font-bold text-white">{pageTitle}</h2>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <LuxuryStatCard label="Page views" value={summary.pageViews} />
        <LuxuryStatCard label="Link clicks" value={summary.linkClicks} />
        <LuxuryStatCard label="Unique visitors" value={summary.uniqueVisitors} />
        <LuxuryStatCard label="Live (5 min)" value={realtime} accent pulse />
      </div>

      {summary.viewsByDay.length > 0 ? (
        <ChartCard title="Views & clicks">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={summary.viewsByDay}>
                <defs>
                  <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#111", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="views" stroke={ACCENT} fill="url(#viewsGrad)" name="Views" strokeWidth={2} />
                <Area type="monotone" dataKey="clicks" stroke="#a855f7" fill="#a855f722" name="Clicks" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {summary.deviceBreakdown.length > 0 ? (
          <ChartCard title="Devices">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={summary.deviceBreakdown} dataKey="count" nameKey="device" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
                    {summary.deviceBreakdown.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#111", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        ) : null}

        {summary.topLinks.length > 0 ? (
          <ChartCard title="Top links">
            <ul className="space-y-2">
              {summary.topLinks.map((l) => (
                <li key={l.block_id} className="flex items-center justify-between text-sm">
                  <span className="truncate text-white/65">{l.label || l.block_id}</span>
                  <span className="tabular-nums font-semibold" style={{ color: ACCENT }}>{l.clicks}</span>
                </li>
              ))}
            </ul>
          </ChartCard>
        ) : null}
      </div>

      {summary.countryBreakdown.length > 0 ? (
        <ChartCard title="Top countries">
          <ul className="grid gap-2 sm:grid-cols-2">
            {summary.countryBreakdown.map((c) => (
              <li key={c.country} className="flex justify-between text-sm text-white/60">
                <span>{c.country}</span>
                <span className="tabular-nums text-white/35">{c.count}</span>
              </li>
            ))}
          </ul>
        </ChartCard>
      ) : null}
    </div>
  );
}

function GlobalAnalyticsPanel({
  summary,
  loading,
  pages,
  onSelectPage,
  onRefresh,
}: {
  summary: GlobalAnalyticsSummary | null;
  loading: boolean;
  pages: LinkPageRecord[];
  onSelectPage: (id: string) => void;
  onRefresh: () => void;
}) {
  const pageIdToRecordId = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of pages) map.set(p.page_id, p.id);
    return map;
  }, [pages]);

  const pageColors = React.useMemo(() => {
    const ids = summary?.leaderboard.map((l) => l.page_id) ?? [];
    const map: Record<string, string> = {};
    ids.forEach((id, i) => {
      map[id] = PIE_COLORS[i % PIE_COLORS.length];
    });
    return map;
  }, [summary]);

  const stackedData = React.useMemo(() => {
    if (!summary) return [];
    return summary.viewsByDayByPage.map((row) => {
      const entry: Record<string, string | number> = { date: row.date };
      for (const [pid, views] of Object.entries(row.pages)) {
        entry[pid] = views;
      }
      return entry;
    });
  }, [summary]);

  if (loading && !summary) {
    return <LoadingState />;
  }

  if (!summary) {
    return <EmptyState message="No analytics data yet" />;
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b px-6 py-4" style={{ borderColor: BORDER }}>
        <div>
          <h2 className="text-lg font-bold text-white">All Pages Analytics</h2>
          <p className="text-xs text-white/40">Last 30 days · combined performance</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="rounded-lg border px-3 py-1.5 text-xs text-white/60 transition-colors hover:text-white/90 disabled:opacity-50"
          style={{ borderColor: BORDER }}
        >
          {loading ? <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> : "Refresh"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <LuxuryStatCard label="Total page views" value={summary.totalPageViews} />
            <LuxuryStatCard label="Total link clicks" value={summary.totalLinkClicks} />
            <LuxuryStatCard label="Unique visitors" value={summary.totalUniqueVisitors} />
          </div>

          {stackedData.length > 0 ? (
            <ChartCard title="Views by page (daily)">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stackedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "#111", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
                    {summary.leaderboard.slice(0, 6).map((p) => (
                      <Line
                        key={p.page_id}
                        type="monotone"
                        dataKey={p.page_id}
                        name={p.title}
                        stroke={pageColors[p.page_id]}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Leaderboard */}
            <ChartCard title="Leaderboard">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-[10px] uppercase tracking-wider text-white/30" style={{ borderColor: BORDER }}>
                      <th className="pb-2 pr-4">Page</th>
                      <th className="pb-2 pr-4 text-right">Views</th>
                      <th className="pb-2 text-right">Clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.leaderboard.map((row, i) => {
                      const recordId = pageIdToRecordId.get(row.page_id);
                      return (
                        <tr
                          key={row.page_id}
                          className={cn("border-b transition-colors", recordId ? "cursor-pointer hover:bg-white/[0.03]" : "")}
                          style={{ borderColor: BORDER }}
                          onClick={() => recordId && onSelectPage(recordId)}
                        >
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] tabular-nums text-white/25">#{i + 1}</span>
                              <div>
                                <p className="font-medium text-white/80">{row.title}</p>
                                <p className="text-[10px] text-white/30">/{row.slug}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 pr-4 text-right tabular-nums text-white/70">{row.views.toLocaleString()}</td>
                          <td className="py-2.5 text-right tabular-nums" style={{ color: ACCENT }}>{row.clicks.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </ChartCard>

            <div className="space-y-4">
              {summary.pageBreakdown.length > 0 ? (
                <ChartCard title="Views by page">
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={summary.pageBreakdown.slice(0, 8)}
                          dataKey="views"
                          nameKey="title"
                          cx="50%"
                          cy="50%"
                          innerRadius={35}
                          outerRadius={70}
                        >
                          {summary.pageBreakdown.slice(0, 8).map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: "#111", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>
              ) : null}

              {summary.deviceBreakdown.length > 0 ? (
                <ChartCard title="Device breakdown">
                  <ul className="space-y-2">
                    {summary.deviceBreakdown.map((d, i) => {
                      const total = summary.deviceBreakdown.reduce((s, x) => s + x.count, 0);
                      const pct = total ? Math.round((d.count / total) * 100) : 0;
                      return (
                        <li key={d.device}>
                          <div className="mb-1 flex justify-between text-xs">
                            <span className="capitalize text-white/60">{d.device}</span>
                            <span className="tabular-nums text-white/40">{d.count.toLocaleString()} ({pct}%)</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </ChartCard>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LuxuryStatCard({ label, value, accent, pulse }: { label: string; value: number; accent?: boolean; pulse?: boolean }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border p-4"
      style={{ background: PANEL, borderColor: BORDER }}
    >
      {accent ? (
        <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at top right, ${ACCENT}, transparent 70%)` }} />
      ) : null}
      <p className="text-[10px] font-medium uppercase tracking-wider text-white/35">{label}</p>
      <p
        className={cn("mt-1.5 text-2xl font-bold tabular-nums", pulse && "animate-pulse")}
        style={{ color: accent ? ACCENT : "#fff" }}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4" style={{ background: PANEL, borderColor: BORDER }}>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-[11px] text-white/40">{label}</Label>
      {children}
    </div>
  );
}
