"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Copy,
  Filter,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
} from "lucide-react";
import { useToast } from "@/contexts/toast-context";
import type { AppNotification } from "@/types";
import { formatDateTimeAthens, formatDateTimeEuropean } from "@/lib/format";
import { usePagination } from "@/lib/use-pagination";
import { PaginationControls } from "@/components/ui/pagination-controls";
import type {
  MistakeReasonCategory,
  MistakeReasonRecord,
  MistakeRecord,
  MistakeStatus,
} from "@/services/chatter-mistakes";
import {
  EmptyState,
  FilterChip,
  MistakePoints,
  MistakeSeverityBadge,
  MistakeStatusBadge,
  RelativeDate,
  ScreenshotGallery,
  daysAgoFromIso,
  getMistakeDateRange,
  MISTAKE_DATE_PRESET_LABELS,
  severityDotClass,
  type MistakeDatePreset,
} from "@/components/mistakes";
import { ScreenshotAnnotator } from "@/components/mistakes/screenshot-annotator";

type StatusTab = "pending" | "approved" | "rejected" | "all";
type SortKey = "oldest" | "newest" | "points" | "chatter" | "model";

const PAGE_SIZE = 25;
const DEBOUNCE_MS = 280;

const SORT_LABELS: Record<SortKey, string> = {
  oldest: "Oldest first",
  newest: "Newest first",
  points: "Highest points",
  chatter: "Chatter A–Z",
  model: "Model A–Z",
};

function localToast(id: string, title: string, body: string, priority: "normal" | "high"): AppNotification {
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

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return Boolean(el.closest("[contenteditable='true']"));
}

async function convertToPng(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("no canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (pngBlob) => {
          URL.revokeObjectURL(url);
          if (pngBlob) resolve(pngBlob);
          else reject(new Error("canvas toBlob failed"));
        },
        "image/png"
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("img load failed"));
    };
    img.src = url;
  });
}

function copyTextWithTextarea(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

function parseCsv(param: string | null): string[] {
  if (!param) return [];
  return param
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function csv(ids: string[]): string | null {
  return ids.length ? ids.join(",") : null;
}

function dayKey(m: MistakeRecord): string {
  return (m.mistake_date || m.created_at || "").slice(0, 10) || "unknown";
}

function formatDayHeading(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "Unknown date";
  return formatDateTimeEuropean(`${ymd}T12:00:00`).replace(/\s\d{2}:\d{2}.*$/, "") || ymd;
}

function pointsForRow(m: MistakeRecord, reasonPoints: Map<string, number>): number {
  if (m.status === "pending") return reasonPoints.get(m.reason_id) ?? m.points_deducted;
  return m.points_deducted;
}

type MultiOption = { id: string; name: string; count?: number };

function SearchableMulti({
  label,
  options,
  selected,
  onChange,
  placeholder = "Search…",
}: {
  label: string;
  options: MultiOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((o) => o.name.toLowerCase().includes(needle));
  }, [options, q]);

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  return (
    <div ref={rootRef} className="relative">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">{label}</p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-2.5 text-left text-xs text-white/80 transition hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">
          {selected.length === 0 ? "Any" : `${selected.length} selected`}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-white/35" aria-hidden />
      </button>
      {open ? (
        <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-xl border border-white/10 bg-[#141214] shadow-2xl">
          <div className="border-b border-white/10 p-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={placeholder}
              className="h-8 w-full rounded-lg border border-white/10 bg-black/40 px-2 text-xs text-white placeholder:text-white/30 focus:border-pink-500/40 focus:outline-none"
              aria-label={`Search ${label}`}
            />
          </div>
          <ul role="listbox" aria-multiselectable className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-white/40">No matches</li>
            ) : (
              filtered.map((o) => {
                const on = selected.includes(o.id);
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={on}
                      onClick={() => toggle(o.id)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-white/80 hover:bg-white/[0.06]"
                    >
                      <span
                        className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${
                          on ? "border-pink-500 bg-pink-500 text-white" : "border-white/25"
                        }`}
                        aria-hidden
                      >
                        {on ? <Check className="h-2.5 w-2.5" /> : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{o.name}</span>
                      {typeof o.count === "number" ? (
                        <span className="tabular-nums text-white/35">{o.count}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SkeletonWorkspace() {
  return (
    <div className="space-y-4 animate-pulse" aria-hidden>
      <div className="h-16 rounded-2xl bg-white/[0.04]" />
      <div className="flex gap-4">
        <div className="hidden h-[28rem] w-[260px] shrink-0 rounded-2xl bg-white/[0.04] lg:block" />
        <div className="min-w-0 flex-1 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-white/[0.04]" />
          ))}
        </div>
        <div className="hidden h-[28rem] w-[22rem] shrink-0 rounded-2xl bg-white/[0.04] xl:block" />
      </div>
    </div>
  );
}

type Props = {
  initialMistakes: MistakeRecord[];
  reasons: MistakeReasonRecord[];
  chatterOptions: { id: string; name: string }[];
  modelOptions: { id: string; name: string }[];
  canAnnotate?: boolean;
};

export function AdminMistakesClient({
  initialMistakes,
  reasons,
  chatterOptions,
  modelOptions,
  canAnnotate = false,
}: Props) {
  const { addToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [rows, setRows] = React.useState(initialMistakes);
  const [hydrated, setHydrated] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [checked, setChecked] = React.useState<Set<string>>(() => new Set());
  const [adminNotes, setAdminNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [copySuccess, setCopySuccess] = React.useState<string | null>(null);
  const copySuccessTimeoutRef = React.useRef<number | null>(null);
  const [annotateTarget, setAnnotateTarget] = React.useState<{ mistakeId: string; index: number } | null>(
    null
  );
  const [railCollapsed, setRailCollapsed] = React.useState(false);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = React.useState(false);
  const [bulkConfirm, setBulkConfirm] = React.useState<"approve" | "reject" | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const skipUrlWrite = React.useRef(true);

  // URL-driven filters
  const tab = (searchParams.get("tab") as StatusTab) || "pending";
  const sort = (searchParams.get("sort") as SortKey) || (tab === "pending" ? "oldest" : "newest");
  const qParam = searchParams.get("q") ?? "";
  const chatterIds = React.useMemo(() => parseCsv(searchParams.get("chatter")), [searchParams]);
  const modelIds = React.useMemo(() => parseCsv(searchParams.get("model")), [searchParams]);
  const vaIds = React.useMemo(() => parseCsv(searchParams.get("va")), [searchParams]);
  const reasonIds = React.useMemo(() => parseCsv(searchParams.get("reason")), [searchParams]);
  const severities = React.useMemo(
    () => parseCsv(searchParams.get("severity")) as MistakeReasonCategory[],
    [searchParams]
  );
  const hasShot = searchParams.get("shot"); // "1" | "0" | null
  const datePreset = (searchParams.get("date") as MistakeDatePreset) || "all";
  const dateFrom = searchParams.get("from") ?? "";
  const dateTo = searchParams.get("to") ?? "";

  const [searchDraft, setSearchDraft] = React.useState(qParam);
  React.useEffect(() => setSearchDraft(qParam), [qParam]);

  React.useEffect(() => {
    setHydrated(true);
    skipUrlWrite.current = false;
  }, []);

  const replaceParams = React.useCallback(
    (patch: Record<string, string | null>, opts?: { resetPage?: boolean }) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") next.delete(k);
        else next.set(k, v);
      }
      if (opts?.resetPage !== false) next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  React.useEffect(() => {
    if (skipUrlWrite.current) return;
    const t = window.setTimeout(() => {
      if (searchDraft !== qParam) replaceParams({ q: searchDraft.trim() || null });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [searchDraft, qParam, replaceParams]);

  const reasonPointsByReasonId = React.useMemo(() => {
    const m = new Map<string, number>();
    reasons.forEach((r) => m.set(r.reason_id, r.points_deduction));
    return m;
  }, [reasons]);

  const tabCounts = React.useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const r of rows) {
      if (r.status === "pending") pending += 1;
      else if (r.status === "approved") approved += 1;
      else if (r.status === "rejected") rejected += 1;
    }
    return { pending, approved, rejected, all: rows.length };
  }, [rows]);

  const pendingSummary = React.useMemo(() => {
    const pending = rows.filter((r) => r.status === "pending");
    let oldestDays = 0;
    let pts = 0;
    for (const r of pending) {
      pts += pointsForRow(r, reasonPointsByReasonId);
      const d = daysAgoFromIso(r.mistake_date || r.created_at);
      if (d != null && d > oldestDays) oldestDays = d;
    }
    return { count: pending.length, oldestDays, pts };
  }, [rows, reasonPointsByReasonId]);

  const dateRange = React.useMemo(
    () => getMistakeDateRange(datePreset === "custom" ? "custom" : datePreset, dateFrom, dateTo),
    [datePreset, dateFrom, dateTo]
  );

  const filtered = React.useMemo(() => {
    const q = qParam.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab !== "all" && r.status !== tab) return false;
      if (chatterIds.length && !chatterIds.includes(r.chatter_id)) return false;
      if (modelIds.length && !modelIds.includes(r.model_id)) return false;
      if (vaIds.length && !vaIds.includes(r.va_id)) return false;
      if (reasonIds.length && !reasonIds.includes(r.reason_id)) return false;
      if (severities.length && !severities.includes(r.reason_category)) return false;
      if (hasShot === "1" && !(r.screenshot?.length > 0)) return false;
      if (hasShot === "0" && r.screenshot?.length > 0) return false;
      const d = (r.mistake_date || r.created_at || "").slice(0, 10);
      if (dateRange.from && (!d || d < dateRange.from)) return false;
      if (dateRange.to && (!d || d > dateRange.to)) return false;
      if (!q) return true;
      const hay = [
        r.chatter_name,
        r.va_name,
        r.model_name,
        r.sub_username,
        r.explanation,
        r.reason_label,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [
    rows,
    tab,
    chatterIds,
    modelIds,
    vaIds,
    reasonIds,
    severities,
    hasShot,
    dateRange,
    qParam,
  ]);

  const sorted = React.useMemo(() => {
    const list = [...filtered];
    const pts = (m: MistakeRecord) => pointsForRow(m, reasonPointsByReasonId);
    list.sort((a, b) => {
      if (sort === "oldest") {
        return (a.mistake_date || a.created_at).localeCompare(b.mistake_date || b.created_at);
      }
      if (sort === "newest") {
        return (b.mistake_date || b.created_at).localeCompare(a.mistake_date || a.created_at);
      }
      if (sort === "points") return pts(b) - pts(a);
      if (sort === "chatter") return (a.chatter_name || "").localeCompare(b.chatter_name || "");
      return (a.model_name || "").localeCompare(b.model_name || "");
    });
    return list;
  }, [filtered, sort, reasonPointsByReasonId]);

  const pageFromUrl = Math.max(1, Number(searchParams.get("page") || "1") || 1);
  const { page, setPage, totalPages, paginated, reset: resetPage } = usePagination(sorted, PAGE_SIZE);

  React.useEffect(() => {
    if (pageFromUrl !== page) setPage(pageFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageFromUrl]);

  React.useEffect(() => {
    resetPage();
  }, [
    tab,
    sort,
    qParam,
    chatterIds,
    modelIds,
    vaIds,
    reasonIds,
    severities,
    hasShot,
    datePreset,
    dateFrom,
    dateTo,
    resetPage,
  ]);

  React.useEffect(() => {
    if (page > 1) replaceParams({ page: String(page) }, { resetPage: false });
    else if (searchParams.get("page")) replaceParams({ page: null }, { resetPage: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Clear selection if filtered out
  React.useEffect(() => {
    setChecked((prev) => {
      if (!prev.size) return prev;
      const allowed = new Set(sorted.map((r) => r.id));
      const next = new Set([...prev].filter((id) => allowed.has(id)));
      return next.size === prev.size ? prev : next;
    });
    if (selectedId && !sorted.some((r) => r.id === selectedId)) {
      setSelectedId(null);
      setMobileDetailOpen(false);
    }
  }, [sorted, selectedId]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  React.useEffect(() => {
    setAdminNotes(selected?.admin_notes ?? "");
  }, [selectedId, selected?.admin_notes]);

  const groupedPage = React.useMemo(() => {
    const groups: { day: string; items: MistakeRecord[] }[] = [];
    let cur: { day: string; items: MistakeRecord[] } | null = null;
    for (const m of paginated) {
      const d = dayKey(m);
      if (!cur || cur.day !== d) {
        cur = { day: d, items: [] };
        groups.push(cur);
      }
      cur.items.push(m);
    }
    return groups;
  }, [paginated]);

  const chatterFilterOptions = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.chatter_id, (counts.get(r.chatter_id) ?? 0) + 1);
    const fromRows = [...counts.entries()]
      .map(([id, count]) => {
        const name =
          rows.find((r) => r.chatter_id === id)?.chatter_name ||
          chatterOptions.find((c) => c.id === id)?.name ||
          "Chatter";
        return { id, name, count };
      })
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    const known = new Set(fromRows.map((x) => x.id));
    for (const c of chatterOptions) {
      if (!known.has(c.id)) fromRows.push({ id: c.id, name: c.name, count: 0 });
    }
    return fromRows;
  }, [rows, chatterOptions]);

  const modelFilterOptions = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.model_id, (counts.get(r.model_id) ?? 0) + 1);
    return modelOptions
      .map((m) => ({ id: m.id, name: m.name, count: counts.get(m.id) ?? 0 }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [rows, modelOptions]);

  const vaFilterOptions = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const r of rows) {
      const cur = map.get(r.va_id);
      if (cur) cur.count += 1;
      else map.set(r.va_id, { id: r.va_id, name: r.va_name || "VA", count: 1 });
    }
    return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [rows]);

  const reasonFilterOptions = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.reason_id, (counts.get(r.reason_id) ?? 0) + 1);
    return reasons
      .filter((r) => r.active || counts.has(r.reason_id))
      .map((r) => ({
        id: r.reason_id,
        name: r.label,
        count: counts.get(r.reason_id) ?? 0,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [rows, reasons]);

  const chatterHistory = React.useMemo(() => {
    if (!selected) return null;
    const cutoff = Date.now() - 30 * 86_400_000;
    let n = 0;
    let pts = 0;
    for (const r of rows) {
      if (r.chatter_id !== selected.chatter_id) continue;
      const t = Date.parse(r.mistake_date || r.created_at);
      if (!Number.isFinite(t) || t < cutoff) continue;
      n += 1;
      pts += pointsForRow(r, reasonPointsByReasonId);
    }
    return { n, pts };
  }, [selected, rows, reasonPointsByReasonId]);

  const pageIds = React.useMemo(() => paginated.map((m) => m.id), [paginated]);
  const allPageChecked = pageIds.length > 0 && pageIds.every((id) => checked.has(id));
  const pendingChecked = React.useMemo(() => {
    return [...checked].filter((id) => rows.find((r) => r.id === id)?.status === "pending");
  }, [checked, rows]);

  function selectRow(id: string) {
    setSelectedId(id);
    setMobileDetailOpen(true);
  }

  function selectNextPending(afterId: string) {
    const pending = sorted.filter((r) => r.status === "pending");
    const idx = pending.findIndex((r) => r.id === afterId);
    const next = pending[idx + 1] ?? pending.find((r) => r.id !== afterId) ?? null;
    if (next) {
      setSelectedId(next.id);
      setMobileDetailOpen(true);
    } else {
      setSelectedId(null);
      setMobileDetailOpen(false);
    }
  }

  function navigateList(dir: 1 | -1) {
    if (!sorted.length) return;
    const idx = selectedId ? sorted.findIndex((r) => r.id === selectedId) : -1;
    const nextIdx =
      idx < 0 ? (dir === 1 ? 0 : sorted.length - 1) : Math.min(sorted.length - 1, Math.max(0, idx + dir));
    selectRow(sorted[nextIdx].id);
  }

  function markCopySuccess(id: string) {
    if (copySuccessTimeoutRef.current != null) window.clearTimeout(copySuccessTimeoutRef.current);
    setCopySuccess(id);
    copySuccessTimeoutRef.current = window.setTimeout(() => {
      copySuccessTimeoutRef.current = null;
      setCopySuccess(null);
    }, 2000);
  }

  React.useEffect(() => {
    return () => {
      if (copySuccessTimeoutRef.current != null) window.clearTimeout(copySuccessTimeoutRef.current);
    };
  }, []);

  async function handleEasyCopy(m: MistakeRecord) {
    const text = [
      `MISTAKE REPORT`,
      `Category: ${m.reason_category} | ${m.reason_label}`,
      `Chatter: ${m.chatter_name}`,
      `Model: ${m.model_name}`,
      `Sub: @${m.sub_username}`,
      `Date: ${formatDateTimeAthens(m.mistake_date)}`,
      `Explanation: ${m.explanation}`,
      m.admin_notes ? `Admin note: ${m.admin_notes}` : "",
      `Points deducted: ${m.points_deducted}`,
    ]
      .filter(Boolean)
      .join("\n");

    const imageUrl = m.screenshot?.[0]?.annotated_url || m.screenshot?.[0]?.url;

    try {
      if (imageUrl && navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        const proxyImageUrl = `/api/admin/proxy-image?url=${encodeURIComponent(imageUrl)}`;
        const imgResponse = await fetch(proxyImageUrl);
        if (!imgResponse.ok) throw new Error(`image fetch ${imgResponse.status}`);
        const imgBlob = await imgResponse.blob();
        let pngBlob = imgBlob;
        if (imgBlob.type.toLowerCase() !== "image/png") pngBlob = await convertToPng(imgBlob);
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": Promise.resolve(new Blob([text], { type: "text/plain" })),
            "image/png": Promise.resolve(pngBlob),
          }),
        ]);
        markCopySuccess(m.id);
        addToast(localToast("mist-copy", "Copied", "Text + screenshot copied!", "normal"));
        return;
      }
    } catch (err) {
      console.warn("[easy-copy] image copy failed, falling back to text only:", err);
    }

    let copiedTextOnly = false;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard.writeText unavailable");
      await navigator.clipboard.writeText(text);
      copiedTextOnly = true;
    } catch (err) {
      console.warn("[easy-copy] clipboard writeText failed, falling back to textarea:", err);
      copiedTextOnly = copyTextWithTextarea(text);
    }

    if (copiedTextOnly) {
      markCopySuccess(m.id);
      addToast(localToast("mist-copy", "Copied", "Copied to clipboard (text only).", "normal"));
    } else {
      addToast(localToast("mist-copy-fail", "Copy failed", "Clipboard unavailable.", "high"));
    }
  }

  async function patchMistake(
    id: string,
    action: "approve" | "reject",
    notes: string
  ): Promise<{ ok: boolean; mistake?: MistakeRecord }> {
    const res = await fetch(`/api/admin/mistakes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, admin_notes: notes }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false };
    return { ok: true, mistake: data.mistake as MistakeRecord | undefined };
  }

  async function handleApprove(id: string) {
    const row = rows.find((r) => r.id === id);
    const pts = row ? pointsForRow(row, reasonPointsByReasonId) : 0;
    setSaving(true);
    const prev = rows;
    setRows((p) => p.map((r) => (r.id === id ? { ...r, status: "approved" as const, points_deducted: pts } : r)));
    try {
      const result = await patchMistake(id, "approve", adminNotes);
      if (!result.ok) throw new Error("fail");
      if (result.mistake) setRows((p) => p.map((r) => (r.id === id ? result.mistake! : r)));
      addToast(localToast("mist-appr", "Approved", "Mistake approved and points deducted.", "normal"));
      if (tab === "pending") selectNextPending(id);
    } catch {
      setRows(prev);
      addToast(localToast("mist-appr-e", "Approve failed", "Could not approve.", "high"));
    } finally {
      setSaving(false);
    }
  }

  async function handleReject(id: string) {
    setSaving(true);
    const prev = rows;
    setRows((p) =>
      p.map((r) => (r.id === id ? { ...r, status: "rejected" as const, admin_notes: adminNotes } : r))
    );
    try {
      const result = await patchMistake(id, "reject", adminNotes);
      if (!result.ok) throw new Error("fail");
      if (result.mistake) setRows((p) => p.map((r) => (r.id === id ? result.mistake! : r)));
      addToast(localToast("mist-rej", "Rejected", "Mistake rejected.", "normal"));
      if (tab === "pending") selectNextPending(id);
    } catch {
      setRows(prev);
      addToast(localToast("mist-rej-e", "Reject failed", "Could not reject.", "high"));
    } finally {
      setSaving(false);
    }
  }

  async function runBulk(action: "approve" | "reject") {
    const ids = pendingChecked;
    if (!ids.length) return;
    setBulkBusy(true);
    setBulkConfirm(null);
    const failed = new Set<string>();
    for (const id of ids) {
      const row = rows.find((r) => r.id === id);
      const notes = row?.id === selectedId ? adminNotes : row?.admin_notes ?? "";
      const pts = row ? pointsForRow(row, reasonPointsByReasonId) : 0;
      setRows((p) =>
        p.map((r) =>
          r.id === id
            ? {
                ...r,
                status: (action === "approve" ? "approved" : "rejected") as MistakeStatus,
                points_deducted: action === "approve" ? pts : r.points_deducted,
                admin_notes: action === "reject" ? notes : r.admin_notes,
              }
            : r
        )
      );
      const result = await patchMistake(id, action, notes);
      if (!result.ok) {
        failed.add(id);
        if (row) setRows((p) => p.map((r) => (r.id === id ? row : r)));
      } else if (result.mistake) {
        setRows((p) => p.map((r) => (r.id === id ? result.mistake! : r)));
      }
    }
    setChecked(failed);
    setBulkBusy(false);
    if (failed.size) {
      addToast(
        localToast(
          "mist-bulk-e",
          "Bulk incomplete",
          `${failed.size} of ${ids.length} failed — left selected.`,
          "high"
        )
      );
    } else {
      addToast(
        localToast(
          "mist-bulk",
          action === "approve" ? "Approved" : "Rejected",
          `${ids.length} mistake${ids.length === 1 ? "" : "s"} updated.`,
          "normal"
        )
      );
    }
  }

  function resetFilters() {
    setSearchDraft("");
    replaceParams({
      q: null,
      chatter: null,
      model: null,
      va: null,
      reason: null,
      severity: null,
      shot: null,
      date: null,
      from: null,
      to: null,
    });
  }

  const activeFilterChips: { key: string; label: string; clear: () => void }[] = [];
  if (qParam.trim()) {
    activeFilterChips.push({
      key: "q",
      label: `Search: ${qParam.trim()}`,
      clear: () => {
        setSearchDraft("");
        replaceParams({ q: null });
      },
    });
  }
  for (const id of chatterIds) {
    const name = chatterFilterOptions.find((c) => c.id === id)?.name ?? id;
    activeFilterChips.push({
      key: `c-${id}`,
      label: `Chatter: ${name}`,
      clear: () => replaceParams({ chatter: csv(chatterIds.filter((x) => x !== id)) }),
    });
  }
  for (const id of modelIds) {
    const name = modelFilterOptions.find((c) => c.id === id)?.name ?? id;
    activeFilterChips.push({
      key: `m-${id}`,
      label: `Model: ${name}`,
      clear: () => replaceParams({ model: csv(modelIds.filter((x) => x !== id)) }),
    });
  }
  for (const id of vaIds) {
    const name = vaFilterOptions.find((c) => c.id === id)?.name ?? id;
    activeFilterChips.push({
      key: `v-${id}`,
      label: `VA: ${name}`,
      clear: () => replaceParams({ va: csv(vaIds.filter((x) => x !== id)) }),
    });
  }
  for (const id of reasonIds) {
    const name = reasonFilterOptions.find((c) => c.id === id)?.name ?? id;
    activeFilterChips.push({
      key: `r-${id}`,
      label: `Reason: ${name}`,
      clear: () => replaceParams({ reason: csv(reasonIds.filter((x) => x !== id)) }),
    });
  }
  for (const s of severities) {
    activeFilterChips.push({
      key: `sev-${s}`,
      label: `Severity: ${s}`,
      clear: () => replaceParams({ severity: csv(severities.filter((x) => x !== s)) }),
    });
  }
  if (hasShot === "1") {
    activeFilterChips.push({
      key: "shot",
      label: "Has screenshot",
      clear: () => replaceParams({ shot: null }),
    });
  }
  if (hasShot === "0") {
    activeFilterChips.push({
      key: "shot0",
      label: "No screenshot",
      clear: () => replaceParams({ shot: null }),
    });
  }
  if (datePreset !== "all") {
    const label =
      datePreset === "custom"
        ? `Date: ${dateFrom || "…"} → ${dateTo || "…"}`
        : MISTAKE_DATE_PRESET_LABELS[datePreset as keyof typeof MISTAKE_DATE_PRESET_LABELS] || datePreset;
    activeFilterChips.push({
      key: "date",
      label: typeof label === "string" ? label : "Date",
      clear: () => replaceParams({ date: null, from: null, to: null }),
    });
  }

  // Keyboard shortcuts
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target) || annotateTarget || bulkConfirm) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        if (helpOpen) {
          setHelpOpen(false);
          return;
        }
        if (filtersOpen) {
          setFiltersOpen(false);
          return;
        }
        if (mobileDetailOpen) {
          setMobileDetailOpen(false);
          return;
        }
        setSelectedId(null);
        return;
      }
      if (e.key === "/" ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        setFiltersOpen(true);
        return;
      }
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        setFiltersOpen((v) => !v);
        setRailCollapsed(false);
        return;
      }
      if (e.key === "j" || e.key === "J" || e.key === "ArrowDown") {
        e.preventDefault();
        navigateList(1);
        return;
      }
      if (e.key === "k" || e.key === "K" || e.key === "ArrowUp") {
        e.preventDefault();
        navigateList(-1);
        return;
      }
      if ((e.key === "a" || e.key === "A") && selected?.status === "pending" && !saving) {
        e.preventDefault();
        void handleApprove(selected.id);
        return;
      }
      if ((e.key === "r" || e.key === "R") && selected?.status === "pending" && !saving) {
        e.preventDefault();
        void handleReject(selected.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, saving, annotateTarget, bulkConfirm, helpOpen, filtersOpen, mobileDetailOpen, sorted]);

  function patchScreenshotAnnotated(mistakeId: string, index: number, annotatedUrl: string | undefined) {
    setRows((prev) =>
      prev.map((m) => {
        if (m.id !== mistakeId) return m;
        const screenshot = m.screenshot.map((s, i) => {
          if (i !== index) return s;
          if (!annotatedUrl) {
            const { annotated_url: _drop, ...rest } = s;
            return rest;
          }
          return { ...s, annotated_url: annotatedUrl };
        });
        return { ...m, screenshot };
      })
    );
  }

  const pointsDisplayed = selected ? pointsForRow(selected, reasonPointsByReasonId) : 0;

  const filterPanel = (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/40" htmlFor="mistakes-search">
          Search
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
          <input
            id="mistakes-search"
            ref={searchInputRef}
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Chatter, VA, model, sub, explanation…"
            className="h-9 w-full rounded-lg border border-white/10 bg-black/30 py-2 pl-8 pr-2 text-xs text-white placeholder:text-white/30 focus:border-pink-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60"
          />
        </div>
      </div>

      <SearchableMulti
        label="Chatter"
        options={chatterFilterOptions}
        selected={chatterIds}
        onChange={(ids) => replaceParams({ chatter: csv(ids) })}
        placeholder="Search chatters…"
      />
      <SearchableMulti
        label="Model"
        options={modelFilterOptions}
        selected={modelIds}
        onChange={(ids) => replaceParams({ model: csv(ids) })}
        placeholder="Search models…"
      />
      <SearchableMulti
        label="Submitted by"
        options={vaFilterOptions}
        selected={vaIds}
        onChange={(ids) => replaceParams({ va: csv(ids) })}
        placeholder="Search VAs…"
      />
      <SearchableMulti
        label="Reason"
        options={reasonFilterOptions}
        selected={reasonIds}
        onChange={(ids) => replaceParams({ reason: csv(ids) })}
        placeholder="Search reasons…"
      />

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">Severity</p>
        <div className="flex flex-wrap gap-1.5">
          {(["Low", "Medium", "High"] as MistakeReasonCategory[]).map((s) => (
            <FilterChip
              key={s}
              label={s}
              active={severities.includes(s)}
              onClick={() =>
                replaceParams({
                  severity: csv(
                    severities.includes(s) ? severities.filter((x) => x !== s) : [...severities, s]
                  ),
                })
              }
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">Screenshot</p>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            label="Has screenshot"
            active={hasShot === "1"}
            onClick={() => replaceParams({ shot: hasShot === "1" ? null : "1" })}
          />
          <FilterChip
            label="No screenshot"
            active={hasShot === "0"}
            onClick={() => replaceParams({ shot: hasShot === "0" ? null : "0" })}
          />
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">Date</p>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(MISTAKE_DATE_PRESET_LABELS) as Array<keyof typeof MISTAKE_DATE_PRESET_LABELS>).map(
            (key) => (
              <FilterChip
                key={key}
                label={MISTAKE_DATE_PRESET_LABELS[key]}
                active={datePreset === key}
                onClick={() =>
                  replaceParams({
                    date: datePreset === key ? null : key,
                    from: null,
                    to: null,
                  })
                }
              />
            )
          )}
          <FilterChip
            label="Custom"
            active={datePreset === "custom"}
            onClick={() => replaceParams({ date: "custom" })}
          />
        </div>
        {datePreset === "custom" ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-[10px] text-white/40">
              From
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => replaceParams({ date: "custom", from: e.target.value || null })}
                className="mt-1 h-8 w-full rounded-lg border border-white/10 bg-black/30 px-2 text-xs text-white focus:border-pink-500/40 focus:outline-none"
              />
            </label>
            <label className="text-[10px] text-white/40">
              To
              <input
                type="date"
                value={dateTo}
                onChange={(e) => replaceParams({ date: "custom", to: e.target.value || null })}
                className="mt-1 h-8 w-full rounded-lg border border-white/10 bg-black/30 px-2 text-xs text-white focus:border-pink-500/40 focus:outline-none"
              />
            </label>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={resetFilters}
        className="w-full rounded-lg border border-white/10 py-2 text-xs font-medium text-white/55 transition hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60"
      >
        Reset filters
      </button>
    </div>
  );

  const detailBody = selected ? (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] pb-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <MistakeSeverityBadge severity={selected.reason_category} withDot />
            <MistakeStatusBadge status={selected.status} />
          </div>
          <h2 className="text-base font-semibold leading-snug text-white">
            {selected.chatter_name}
            <span className="font-normal text-white/40"> · </span>
            <span className="font-normal text-white/70">{selected.model_name}</span>
          </h2>
          <p className="text-xs text-white/45">
            {formatDateTimeAthens(selected.mistake_date)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => navigateList(-1)}
            className="rounded-lg border border-white/10 p-1.5 text-white/45 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60"
            aria-label="Previous mistake"
            title="Previous (K / ↑)"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => navigateList(1)}
            className="rounded-lg border border-white/10 p-1.5 text-white/45 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60"
            aria-label="Next mistake"
            title="Next (J / ↓)"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedId(null);
              setMobileDetailOpen(false);
            }}
            className="rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60 xl:hidden"
            aria-label="Close detail"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {chatterHistory ? (
        <p className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[11px] text-white/50">
          This chatter:{" "}
          <span className="font-medium text-white/75">
            {chatterHistory.n} mistake{chatterHistory.n === 1 ? "" : "s"}
          </span>{" "}
          in 30d, <MistakePoints points={chatterHistory.pts} className="text-[11px]" />
        </p>
      ) : null}

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <dt className="text-white/35">Submitted by</dt>
          <dd className="text-white/85">{selected.va_name || "—"}</dd>
        </div>
        <div>
          <dt className="text-white/35">Sub username</dt>
          <dd className="text-white/85">@{selected.sub_username || "—"}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-white/35">Reason</dt>
          <dd className="text-white/85">{selected.reason_label}</dd>
        </div>
        <div>
          <dt className="text-white/35">Points</dt>
          <dd>
            <MistakePoints points={pointsDisplayed} />
          </dd>
        </div>
        <div>
          <dt className="text-white/35">Mistake date</dt>
          <dd className="text-white/85">{formatDateTimeAthens(selected.mistake_date)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-white/35">Created</dt>
          <dd className="text-white/85">{formatDateTimeEuropean(selected.created_at)}</dd>
        </div>
      </dl>

      <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/35">Explanation</p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/75">{selected.explanation}</p>
      </div>

      {selected.screenshot?.length ? (
        <div className="mt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/35">Screenshots</p>
          <ScreenshotGallery
            shots={selected.screenshot}
            canAnnotate={canAnnotate}
            onAnnotate={(index) => setAnnotateTarget({ mistakeId: selected.id, index })}
            preferAnnotatedThumbs
            allowOriginalToggle
            size="lg"
          />
        </div>
      ) : null}

      <div className="mt-4">
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/35" htmlFor="admin-note">
          Admin note
        </label>
        <textarea
          id="admin-note"
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          placeholder="Add note for chatter/VA…"
          rows={3}
          className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-pink-500/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60"
        />
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => void handleEasyCopy(selected)}
          className={`flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60 ${
            copySuccess === selected.id
              ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
              : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
          }`}
        >
          {copySuccess === selected.id ? (
            <>
              <Check className="h-4 w-4" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" /> Copy text + screenshot
            </>
          )}
        </button>

        {selected.status === "pending" ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={saving || bulkBusy}
              onClick={() => void handleApprove(selected.id)}
              className="flex-1 rounded-xl border border-emerald-500/30 bg-emerald-500/20 py-2.5 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
            >
              Approve (−{pointsDisplayed} pts)
            </button>
            <button
              type="button"
              disabled={saving || bulkBusy}
              onClick={() => void handleReject(selected.id)}
              className="flex-1 rounded-xl border border-red-500/30 bg-red-500/20 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/30 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
            >
              Reject
            </button>
          </div>
        ) : null}
      </div>
    </div>
  ) : (
    <div className="flex h-full min-h-[12rem] items-center justify-center text-sm text-white/35">
      Select a mistake to review
    </div>
  );

  if (!hydrated) return <SkeletonWorkspace />;

  const emptyPending = tab === "pending" && !activeFilterChips.length && sorted.length === 0;
  const emptyFiltered = sorted.length === 0 && !emptyPending;

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Mistakes</h1>
            <p className="mt-0.5 text-sm text-white/45">Review VA-submitted chatter mistakes</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHelpOpen((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/45 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60"
              aria-label="Keyboard shortcuts"
              title="Shortcuts (?)"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-medium text-white/60 hover:bg-white/5 lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60"
              onClick={() => setFiltersOpen(true)}
            >
              <Filter className="h-3.5 w-3.5" />
              Filters
              {activeFilterChips.length ? (
                <span className="rounded-full bg-pink-500/25 px-1.5 py-0.5 text-[10px] text-pink-200">
                  {activeFilterChips.length}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Mistake status"
          className="inline-flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1"
        >
          {(
            [
              { key: "pending" as const, label: "Pending", n: tabCounts.pending },
              { key: "approved" as const, label: "Approved", n: tabCounts.approved },
              { key: "rejected" as const, label: "Rejected", n: tabCounts.rejected },
              { key: "all" as const, label: "All", n: tabCounts.all },
            ] as const
          ).map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() =>
                  replaceParams({
                    tab: t.key === "pending" ? null : t.key,
                    sort: t.key === "pending" ? "oldest" : sort === "oldest" ? "newest" : sort,
                  })
                }
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60 ${
                  active
                    ? "bg-pink-500/20 text-pink-200 shadow-sm"
                    : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
                }`}
              >
                {t.label}
                <span className={`ml-1.5 tabular-nums ${active ? "text-pink-300/80" : "text-white/30"}`}>
                  {t.n}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-white/40">
          {pendingSummary.count} pending
          {pendingSummary.count > 0 ? (
            <>
              {" "}
              · oldest {pendingSummary.oldestDays} day{pendingSummary.oldestDays === 1 ? "" : "s"} ago · Σ{" "}
              {pendingSummary.pts} pts waiting
            </>
          ) : null}
        </p>
      </header>

      {helpOpen ? (
        <div
          className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-white/60"
          role="region"
          aria-label="Keyboard shortcuts"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold text-white/80">Keyboard shortcuts</p>
            <button type="button" onClick={() => setHelpOpen(false)} aria-label="Close help" className="p-1 text-white/40 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <ul className="grid gap-1 sm:grid-cols-2">
            <li>
              <kbd className="rounded border border-white/15 px-1">J</kbd> / <kbd className="rounded border border-white/15 px-1">↓</kbd> next
            </li>
            <li>
              <kbd className="rounded border border-white/15 px-1">K</kbd> / <kbd className="rounded border border-white/15 px-1">↑</kbd> previous
            </li>
            <li>
              <kbd className="rounded border border-white/15 px-1">A</kbd> approve
            </li>
            <li>
              <kbd className="rounded border border-white/15 px-1">R</kbd> reject
            </li>
            <li>
              <kbd className="rounded border border-white/15 px-1">/</kbd> focus search
            </li>
            <li>
              <kbd className="rounded border border-white/15 px-1">F</kbd> filters
            </li>
            <li>
              <kbd className="rounded border border-white/15 px-1">Esc</kbd> deselect / close
            </li>
            <li>
              <kbd className="rounded border border-white/15 px-1">?</kbd> this help
            </li>
          </ul>
        </div>
      ) : null}

      {/* Active chips */}
      <div className="flex min-h-[1.75rem] flex-wrap items-center gap-2">
        {activeFilterChips.map((c) => (
          <FilterChip key={c.key} label={c.label} onRemove={c.clear} />
        ))}
        {activeFilterChips.length ? (
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
          >
            Clear all
          </button>
        ) : null}
        <span className="ml-auto text-xs tabular-nums text-white/35">
          Showing {sorted.length} of {rows.length}
        </span>
      </div>

      {/* 3-zone workspace */}
      <div className="flex gap-4 lg:items-start">
        {/* Left rail */}
        <aside
          className={`hidden shrink-0 lg:block ${railCollapsed ? "w-10" : "w-[260px]"}`}
          aria-label="Filters"
        >
          {railCollapsed ? (
            <button
              type="button"
              onClick={() => setRailCollapsed(false)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60"
              aria-label="Expand filters"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          ) : (
            <div className="sticky top-4 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 backdrop-blur-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Filters</p>
                <button
                  type="button"
                  onClick={() => setRailCollapsed(true)}
                  className="rounded-lg p-1 text-white/35 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60"
                  aria-label="Collapse filters"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </div>
              {filterPanel}
            </div>
          )}
        </aside>

        {/* List */}
        <section className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs text-white/50">
              <span className="sr-only">Sort</span>
              <select
                value={sort}
                onChange={(e) => replaceParams({ sort: e.target.value })}
                className="h-8 rounded-lg border border-white/10 bg-black/30 px-2 text-xs text-white focus:border-pink-500/40 focus:outline-none"
                aria-label="Sort mistakes"
              >
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <option key={k} value={k}>
                    {SORT_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            {paginated.length > 0 ? (
              <label className="flex items-center gap-2 text-xs text-white/50">
                <input
                  type="checkbox"
                  checked={allPageChecked}
                  onChange={() => {
                    setChecked((prev) => {
                      const next = new Set(prev);
                      if (allPageChecked) pageIds.forEach((id) => next.delete(id));
                      else pageIds.forEach((id) => next.add(id));
                      return next;
                    });
                  }}
                  className="rounded border-white/20"
                />
                Select page
              </label>
            ) : null}
          </div>

          {emptyPending ? (
            <EmptyState title="No pending — all caught up" description="New VA submissions will show up here." />
          ) : emptyFiltered ? (
            <EmptyState
              title="No results"
              description="Try adjusting filters or clearing the search."
              action={
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
                >
                  Reset filters
                </button>
              }
            />
          ) : (
            <>
              <div className="space-y-4">
                {groupedPage.map((group) => (
                  <div key={group.day}>
                    <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-white/35">
                      {formatDayHeading(group.day)}
                    </p>
                    <ul className="space-y-1">
                      {group.items.map((m) => {
                        const selectedRow = selectedId === m.id;
                        const pts = pointsForRow(m, reasonPointsByReasonId);
                        const shotCount = m.screenshot?.filter((s) => s.url).length ?? 0;
                        return (
                          <li key={m.id}>
                            <div
                              role="option"
                              aria-selected={selectedRow}
                              tabIndex={0}
                              onClick={() => selectRow(m.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  selectRow(m.id);
                                }
                              }}
                              className={`group relative flex cursor-pointer items-start gap-2.5 rounded-xl border px-2.5 py-2.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60 ${
                                selectedRow
                                  ? "border-pink-500/30 bg-pink-500/[0.08]"
                                  : "border-transparent bg-white/[0.025] hover:bg-white/[0.05]"
                              }`}
                            >
                              {selectedRow ? (
                                <span
                                  className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-pink-500"
                                  aria-hidden
                                />
                              ) : null}
                              <input
                                type="checkbox"
                                checked={checked.has(m.id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setChecked((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(m.id)) next.delete(m.id);
                                    else next.add(m.id);
                                    return next;
                                  });
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-1 rounded border-white/20"
                                aria-label={`Select mistake for ${m.chatter_name}`}
                              />
                              <span
                                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${severityDotClass(m.reason_category)}`}
                                title={m.reason_category}
                                aria-hidden
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                  <span className="text-sm font-medium text-white">{m.chatter_name}</span>
                                  <span className="text-white/25">·</span>
                                  <span className="text-sm text-white/55">{m.model_name}</span>
                                </div>
                                <p className="mt-0.5 truncate text-xs text-white/55" title={m.reason_label}>
                                  {m.reason_label}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-white/35" title={m.explanation}>
                                  {m.explanation}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/35">
                                  <span>{m.va_name}</span>
                                  <RelativeDate iso={m.mistake_date || m.created_at} />
                                  {m.status !== "pending" ? <MistakeStatusBadge status={m.status} /> : null}
                                </div>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-1.5">
                                <MistakePoints points={pts} className="text-xs" />
                                {shotCount > 0 ? (
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <ScreenshotGallery
                                      shots={m.screenshot}
                                      compact
                                      size="sm"
                                      preferAnnotatedThumbs
                                      canAnnotate={false}
                                    />
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
              <PaginationControls
                page={page}
                totalPages={totalPages}
                onPage={setPage}
                totalItems={sorted.length}
                pageSize={PAGE_SIZE}
              />
            </>
          )}
        </section>

        {/* Detail — desktop sticky */}
        <aside className="hidden w-[22rem] shrink-0 xl:block" aria-label="Mistake detail">
          <div className="sticky top-4 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
            {detailBody}
          </div>
        </aside>
      </div>

      {/* Mobile / tablet detail sheet */}
      {selected && mobileDetailOpen ? (
        <div className="fixed inset-0 z-[200] xl:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Close detail"
            onClick={() => setMobileDetailOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Mistake detail"
            className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0f0d0f] p-5 pb-10 shadow-2xl"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" aria-hidden />
            {detailBody}
          </div>
        </div>
      ) : null}

      {/* Mobile filters sheet */}
      {filtersOpen ? (
        <div className="fixed inset-0 z-[210] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Close filters"
            onClick={() => setFiltersOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0f0d0f] p-5 pb-8 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Filters</p>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {filterPanel}
            <button
              type="button"
              className="mt-5 w-full rounded-xl border border-pink-500/30 bg-pink-500/20 py-3 text-sm font-semibold text-pink-200"
              onClick={() => setFiltersOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      ) : null}

      {/* Bulk bar */}
      {pendingChecked.length > 0 ? (
        <div className="fixed bottom-6 left-1/2 z-[180] flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-white/15 bg-[#161316]/95 px-4 py-2.5 shadow-2xl backdrop-blur-md">
          <span className="text-xs text-white/60">
            <span className="font-semibold text-white">{pendingChecked.length}</span> pending selected
          </span>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => setBulkConfirm("approve")}
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-400 disabled:opacity-50"
          >
            Approve {pendingChecked.length}
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => setBulkConfirm("reject")}
            className="rounded-lg border border-red-500/30 bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-400 disabled:opacity-50"
          >
            Reject {pendingChecked.length}
          </button>
          <button
            type="button"
            onClick={() => setChecked(new Set())}
            className="rounded-lg px-2 py-1.5 text-xs text-white/40 hover:text-white"
          >
            Clear
          </button>
        </div>
      ) : null}

      {bulkConfirm ? (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-confirm-title"
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#141214] p-5 shadow-2xl"
          >
            <h3 id="bulk-confirm-title" className="text-base font-semibold text-white">
              {bulkConfirm === "approve" ? "Approve" : "Reject"} {pendingChecked.length} mistake
              {pendingChecked.length === 1 ? "" : "s"}?
            </h3>
            <p className="mt-2 text-sm text-white/50">
              {bulkConfirm === "approve"
                ? "Points will be deducted for each approved mistake."
                : "Rejected mistakes will not deduct points."}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setBulkConfirm(null)}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void runBulk(bulkConfirm)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${
                  bulkConfirm === "approve"
                    ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
                    : "border border-red-500/30 bg-red-500/20 text-red-400"
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {annotateTarget ? (
        <ScreenshotAnnotator
          mistakeId={annotateTarget.mistakeId}
          index={annotateTarget.index}
          hasAnnotated={Boolean(
            rows.find((r) => r.id === annotateTarget.mistakeId)?.screenshot?.[annotateTarget.index]
              ?.annotated_url
          )}
          annotatedUrl={
            rows.find((r) => r.id === annotateTarget.mistakeId)?.screenshot?.[annotateTarget.index]
              ?.annotated_url
          }
          onClose={() => setAnnotateTarget(null)}
          onSaved={(annotatedUrl) => {
            patchScreenshotAnnotated(annotateTarget.mistakeId, annotateTarget.index, annotatedUrl);
            setAnnotateTarget(null);
            addToast(localToast("mist-ann", "Saved", "Annotations saved.", "normal"));
          }}
          onRemoved={() => {
            patchScreenshotAnnotated(annotateTarget.mistakeId, annotateTarget.index, undefined);
            setAnnotateTarget(null);
            addToast(localToast("mist-ann-rm", "Removed", "Annotations removed.", "normal"));
          }}
        />
      ) : null}
    </div>
  );
}
