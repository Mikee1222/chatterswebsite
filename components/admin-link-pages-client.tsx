"use client";

import * as React from "react";
import {
  Archive,
  BarChart3,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  GripVertical,
  Link2,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useToast } from "@/contexts/toast-context";
import { FormInput } from "@/components/ui/form-input";
import { Label, Textarea } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { AppNotification, AnalyticsSummary, LinkPageBlockRecord, LinkPageBlockType, LinkPageRecord, LinkPageWithBlocks, ModelRecord } from "@/types";

const cardClass = cn(
  "rounded-xl border border-white/[0.08] bg-zinc-950/80",
  "shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]"
);

const ACCENT = "#ec4899";
const PIE_COLORS = ["#ec4899", "#a855f7", "#38bdf8", "#34d399", "#fbbf24"];

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

const PLATFORM_PRESETS: Array<{ icon: string; label: string; urlPrefix: string }> = [
  { icon: "📸", label: "Instagram", urlPrefix: "https://instagram.com/" },
  { icon: "🎵", label: "TikTok", urlPrefix: "https://tiktok.com/@" },
  { icon: "🔞", label: "OnlyFans", urlPrefix: "https://onlyfans.com/" },
  { icon: "𝕏", label: "X / Twitter", urlPrefix: "https://x.com/" },
  { icon: "▶", label: "YouTube", urlPrefix: "https://youtube.com/" },
  { icon: "💬", label: "Telegram", urlPrefix: "https://t.me/" },
];

const BLOCK_TYPES: Array<{ value: LinkPageBlockType; label: string }> = [
  { value: "link", label: "Link" },
  { value: "heading", label: "Heading" },
  { value: "bio_text", label: "Bio text" },
  { value: "photo_grid", label: "Photo grid" },
  { value: "countdown", label: "Countdown" },
  { value: "social_bar", label: "Social bar" },
  { value: "spacer", label: "Spacer" },
];

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
        addToast(localToast("Page created", data.page.title, "normal"));
      }
    } catch (err) {
      addToast(localToast("Create failed", err instanceof Error ? err.message : "Error", "high"));
    } finally {
      setSaving(false);
    }
  }

  async function savePage(patch: Partial<LinkPageRecord>) {
    if (!selectedId || !selectedPage) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/link-pages/${encodeURIComponent(selectedId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as { page?: LinkPageRecord; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      if (data.page) {
        setPages((prev) => prev.map((p) => (p.id === data.page!.id ? { ...p, ...data.page } : p)));
        setSelectedPage((prev) => (prev ? { ...prev, ...data.page! } : prev));
      }
    } catch (err) {
      addToast(localToast("Save failed", err instanceof Error ? err.message : "Error", "high"));
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

  const publicUrl = selectedPage?.slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${ROUTES.linkPage(selectedPage.slug)}`
    : "";

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Link pages</h1>
          <p className="mt-1 text-sm text-white/50">Build link-in-bio pages for models</p>
        </div>
        <button
          type="button"
          onClick={() => void createPage()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-pink-500 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-400 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          New page
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Left: pages list */}
        <div className={cn(cardClass, "flex flex-col p-4")}>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pages…"
              className="w-full rounded-lg border border-white/10 bg-black/40 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/35"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="mb-3 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
            {filteredPages.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "rounded-lg border px-3 py-3 text-left transition-colors",
                  selectedId === p.id
                    ? "border-pink-500/40 bg-pink-500/10"
                    : "border-white/8 bg-white/[0.02] hover:bg-white/[0.05]"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-white">{p.title || "Untitled"}</span>
                  <StatusPill status={p.status} />
                </div>
                <p className="mt-1 text-xs text-white/45">/{p.slug}</p>
                {p.model_id ? (
                  <p className="mt-0.5 text-xs text-white/35">{modelById[p.model_id] ?? "Model"}</p>
                ) : null}
              </button>
            ))}
            {filteredPages.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/40">No pages found</p>
            ) : null}
          </div>
        </div>

        {/* Right: editor / analytics */}
        <div className={cn(cardClass, "min-h-[480px] p-4")}>
          {!selectedPage && !loading ? (
            <div className="flex h-full min-h-[400px] items-center justify-center text-white/40">
              Select or create a page
            </div>
          ) : loading ? (
            <div className="flex h-full min-h-[400px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-pink-400" />
            </div>
          ) : selectedPage ? (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/8 pb-4">
                <div className="flex gap-2">
                  <TabBtn active={tab === "editor"} onClick={() => setTab("editor")}>
                    Editor
                  </TabBtn>
                  <TabBtn active={tab === "analytics"} onClick={() => setTab("analytics")}>
                    <BarChart3 className="mr-1 inline h-4 w-4" />
                    Analytics
                  </TabBtn>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedPage.status === "published" ? (
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> View live
                    </a>
                  ) : null}
                  {selectedPage.status !== "published" ? (
                    <button
                      type="button"
                      onClick={() => void publish("publish")}
                      className="rounded-lg bg-emerald-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
                    >
                      Publish
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void publish("unpublish")}
                      className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70"
                    >
                      Unpublish
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void publish("archive")}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/60"
                  >
                    <Archive className="h-3.5 w-3.5" /> Archive
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {tab === "editor" ? (
                <EditorPanel
                  page={selectedPage}
                  models={models}
                  saving={saving}
                  onSave={(patch) => void savePage(patch)}
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
                <AnalyticsPanel summary={analytics} realtime={realtime} />
              )}
            </>
          ) : null}
        </div>
      </div>

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

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "published"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : status === "archived"
        ? "bg-white/10 text-white/45 border-white/15"
        : "bg-amber-500/15 text-amber-300 border-amber-500/30";
  return (
    <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase", cls)}>
      {status}
    </span>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-pink-500/15 text-pink-200" : "text-white/50 hover:text-white/80"
      )}
    >
      {children}
    </button>
  );
}

function EditorPanel({
  page,
  models,
  saving,
  onSave,
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
  models: ModelRecord[];
  saving: boolean;
  onSave: (patch: Partial<LinkPageRecord>) => void;
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
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="space-y-4">
        <Section title="Settings">
          <Field label="Title">
            <FormInput
              value={page.title}
              onChange={(e) => onSave({ title: e.target.value })}
              disabled={saving}
            />
          </Field>
          <Field label="Slug">
            <FormInput
              value={page.slug}
              onChange={(e) => onSave({ slug: e.target.value })}
              disabled={saving}
            />
          </Field>
          <Field label="Model">
            <select
              value={page.model_id}
              onChange={(e) => onSave({ model_id: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
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
            <FormInput
              value={page.custom_domain}
              onChange={(e) => onSave({ custom_domain: e.target.value })}
              placeholder="links.example.com"
              disabled={saving}
            />
          </Field>
          <Field label="Meta description">
            <Textarea
              value={page.meta_description}
              onChange={(e) => onSave({ meta_description: e.target.value })}
              rows={2}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={page.show_powered_by}
              onChange={(e) => onSave({ show_powered_by: e.target.checked })}
              className="rounded border-white/20"
            />
            Show powered-by badge
          </label>
        </Section>

        <Section title="Profile">
          <Field label="Bio">
            <Textarea value={page.bio} onChange={(e) => onSave({ bio: e.target.value })} rows={3} />
          </Field>
          <Field label="Profile photo URL">
            <div className="flex gap-2">
              <FormInput
                value={page.profile_photo_url}
                onChange={(e) => onSave({ profile_photo_url: e.target.value })}
              />
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/70 hover:bg-white/5">
                <Upload className="h-3.5 w-3.5" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onUpload(f, (url) => onSave({ profile_photo_url: url }));
                  }}
                />
              </label>
            </div>
          </Field>
        </Section>

        <Section title="Appearance">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Theme">
              <select
                value={page.theme}
                onChange={(e) => onSave({ theme: e.target.value as LinkPageRecord["theme"] })}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              >
                {(["dark", "light", "minimal", "neon", "gold"] as const).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Font">
              <select
                value={page.font}
                onChange={(e) => onSave({ font: e.target.value as LinkPageRecord["font"] })}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              >
                {(["modern", "elegant", "bold", "minimal"] as const).map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Background type">
            <select
              value={page.background_type}
              onChange={(e) =>
                onSave({ background_type: e.target.value as LinkPageRecord["background_type"] })
              }
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            >
              <option value="color">Color</option>
              <option value="gradient">Gradient</option>
              <option value="image">Image URL</option>
            </select>
          </Field>
          <Field label="Background value">
            <FormInput
              value={page.background_value}
              onChange={(e) => onSave({ background_value: e.target.value })}
              placeholder="#0a0a0a or linear-gradient(...) or image URL"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Primary color">
              <FormInput
                value={page.primary_color}
                onChange={(e) => onSave({ primary_color: e.target.value })}
              />
            </Field>
            <Field label="Accent color">
              <FormInput
                value={page.accent_color}
                onChange={(e) => onSave({ accent_color: e.target.value })}
              />
            </Field>
          </div>
        </Section>
      </div>

      <div className="space-y-4">
        <Section title="Blocks">
          <div className="mb-3 flex flex-wrap gap-2">
            {BLOCK_TYPES.map((bt) => (
              <button
                key={bt.value}
                type="button"
                onClick={() => onAddBlock(bt.value)}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-white/70 hover:border-pink-500/30 hover:text-pink-200"
              >
                + {bt.label}
              </button>
            ))}
          </div>

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
                className="rounded-lg border border-white/10 bg-black/30 p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <GripVertical className="h-4 w-4 cursor-grab" />
                    <span className="font-medium uppercase">{block.block_type.replace("_", " ")}</span>
                    {!block.is_visible ? <Eye className="h-3.5 w-3.5 text-white/30" /> : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => onMoveBlock(index, -1)} className="p-1 text-white/40 hover:text-white">
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => onMoveBlock(index, 1)} className="p-1 text-white/40 hover:text-white">
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveBlock(block.id)}
                      className="p-1 text-rose-400/70 hover:text-rose-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <BlockEditor
                  block={block}
                  onChange={(patch) => patchBlock(block.id, patch)}
                  onSave={(b) => void onUpdateBlock(b)}
                  onUpload={onUpload}
                />
              </div>
            ))}
            {sorted.length === 0 ? (
              <p className="py-6 text-center text-sm text-white/35">No blocks yet — add one above</p>
            ) : null}
          </div>
        </Section>

        <Section title="Quick link presets">
          <div className="flex flex-wrap gap-2">
            {PLATFORM_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => onAddBlock("link")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/65 hover:border-pink-500/30"
                title={`Add ${p.label} link`}
              >
                <span>{p.icon}</span> {p.label}
              </button>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function BlockEditor({
  block,
  onChange,
  onSave,
  onUpload,
}: {
  block: LinkPageBlockRecord;
  onChange: (patch: Partial<LinkPageBlockRecord>) => void;
  onSave: (block: LinkPageBlockRecord) => void;
  onUpload: (f: File, cb: (url: string) => void) => Promise<void>;
}) {
  if (block.block_type === "spacer") {
    return <p className="text-xs text-white/40">Vertical spacer — use move buttons to adjust position</p>;
  }

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
          <FormInput
            value={block.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Label"
          />
          <FormInput
            value={block.url}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://…"
          />
          <FormInput
            value={block.icon}
            onChange={(e) => onChange({ icon: e.target.value })}
            placeholder="Icon (emoji or text)"
          />
          {block.block_type === "link" ? (
            <FormInput
              value={block.sublabel}
              onChange={(e) => onChange({ sublabel: e.target.value })}
              placeholder="Sublabel (optional)"
            />
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
        <Textarea
          value={block.label}
          onChange={(e) => onChange({ label: e.target.value })}
          rows={2}
          placeholder="Bio text"
        />
      )}
      {block.block_type === "countdown" && (
        <>
          <FormInput
            value={block.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Countdown label"
          />
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
                photo_urls: e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            rows={3}
            placeholder="Image URLs (one per line)"
          />
          <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-white/60">
            <Upload className="h-3.5 w-3.5" /> Upload
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f)
                  void onUpload(f, (url) => onChange({ photo_urls: [...block.photo_urls, url] }));
              }}
            />
          </label>
        </div>
      )}
      {block.block_type === "link" && (
        <select
          value={block.style}
          onChange={(e) => onChange({ style: e.target.value as LinkPageBlockRecord["style"] })}
          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white"
        >
          {(["default", "prominent", "subtle", "pill", "card"] as const).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      )}
      <label className="flex items-center gap-2 text-xs text-white/50">
        <input
          type="checkbox"
          checked={block.is_visible}
          onChange={(e) => onChange({ is_visible: e.target.checked })}
        />
        Visible
      </label>
    </div>
  );
}

function AnalyticsPanel({ summary, realtime }: { summary: AnalyticsSummary | null; realtime: number }) {
  if (!summary) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-white/40">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading analytics…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Page views" value={summary.pageViews} />
        <StatCard label="Link clicks" value={summary.linkClicks} />
        <StatCard label="Unique visitors" value={summary.uniqueVisitors} />
        <StatCard label="Live (5 min)" value={realtime} accent />
      </div>

      {summary.viewsByDay.length > 0 ? (
        <div className="rounded-lg border border-white/8 bg-black/30 p-4">
          <h3 className="mb-3 text-sm font-medium text-white/70">Views & clicks</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={summary.viewsByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)" }}
                />
                <Area type="monotone" dataKey="views" stroke={ACCENT} fill={`${ACCENT}33`} name="Views" />
                <Area type="monotone" dataKey="clicks" stroke="#a855f7" fill="#a855f733" name="Clicks" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {summary.deviceBreakdown.length > 0 ? (
          <div className="rounded-lg border border-white/8 bg-black/30 p-4">
            <h3 className="mb-2 text-sm font-medium text-white/70">Devices</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={summary.deviceBreakdown} dataKey="count" nameKey="device" cx="50%" cy="50%" outerRadius={70}>
                    {summary.deviceBreakdown.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        {summary.topLinks.length > 0 ? (
          <div className="rounded-lg border border-white/8 bg-black/30 p-4">
            <h3 className="mb-2 text-sm font-medium text-white/70">Top links</h3>
            <ul className="space-y-2">
              {summary.topLinks.map((l) => (
                <li key={l.block_id} className="flex justify-between text-sm">
                  <span className="truncate text-white/70">{l.label || l.block_id}</span>
                  <span className="tabular-nums text-pink-300">{l.clicks}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {summary.countryBreakdown.length > 0 ? (
        <div className="rounded-lg border border-white/8 bg-black/30 p-4">
          <h3 className="mb-2 text-sm font-medium text-white/70">Top countries</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {summary.countryBreakdown.map((c) => (
              <li key={c.country} className="flex justify-between text-sm text-white/65">
                <span>{c.country}</span>
                <span className="tabular-nums text-white/45">{c.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-white/8 bg-black/30 p-4">
      <p className="text-xs text-white/45">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", accent ? "text-pink-300" : "text-white")}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/8 bg-black/20 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/80">
        <Link2 className="h-4 w-4 text-pink-400" />
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-xs text-white/50">{label}</Label>
      {children}
    </div>
  );
}
