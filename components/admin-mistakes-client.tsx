"use client";

import * as React from "react";
import { Check, Copy, ImageIcon, Search, X } from "lucide-react";
import { useToast } from "@/contexts/toast-context";
import type { AppNotification } from "@/types";
import { formatDateTimeAthens, formatDateTimeEuropean, formatRelativeTime } from "@/lib/format";
import { usePagination } from "@/lib/use-pagination";
import { PaginationControls } from "@/components/ui/pagination-controls";
import type { MistakeReasonCategory, MistakeReasonRecord, MistakeRecord } from "@/services/chatter-mistakes";
import { FormInput } from "@/components/ui/form-input";

type DatePreset = "week" | "month" | "all";

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getDateRange(preset: DatePreset): { from?: string; to?: string } {
  const now = new Date();
  const today = toDateStr(now);
  if (preset === "all") return {};
  if (preset === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toDateStr(start), to: today };
  }
  const start = new Date(now);
  const day = start.getDay();
  const diff = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - diff);
  return { from: toDateStr(start), to: today };
}

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

function categoryBadgeClass(cat: MistakeReasonCategory): string {
  if (cat === "High") return "border-red-500/25 bg-red-500/10 text-red-400";
  if (cat === "Medium") return "border-yellow-500/25 bg-yellow-500/10 text-yellow-400";
  return "border-blue-500/25 bg-blue-500/10 text-blue-400";
}

function statusBadgeClass(st: string): string {
  if (st === "approved") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-400";
  if (st === "rejected") return "border-red-500/25 bg-red-500/10 text-red-400";
  return "border-yellow-500/25 bg-yellow-500/10 text-yellow-400";
}

function StatusDotBadge({ status }: { status: string }) {
  const label = status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Pending";
  const dotClass =
    status === "approved" ? "bg-emerald-400" : status === "rejected" ? "bg-red-400" : "bg-yellow-400";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(status)}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} aria-hidden />
      {label}
    </span>
  );
}

function ScreenshotThumb({ url }: { url?: string }) {
  if (!url) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5">
        <ImageIcon className="h-4 w-4 text-white/25" aria-hidden />
      </div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="block shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10 transition hover:ring-pink-500/40"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Screenshot" className="h-10 w-10 object-cover" />
    </a>
  );
}

function RelativeDate({ iso }: { iso: string }) {
  const full = formatDateTimeEuropean(iso);
  return (
    <span className="text-xs text-white/40" title={full !== "—" ? full : undefined}>
      {formatRelativeTime(iso)}
    </span>
  );
}

/** Convert any image blob to PNG for `ClipboardItem` (expects `image/png`). */
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

type Props = {
  initialMistakes: MistakeRecord[];
  reasons: MistakeReasonRecord[];
  chatterOptions: { id: string; name: string }[];
  modelOptions: { id: string; name: string }[];
};

export function AdminMistakesClient({ initialMistakes, reasons, modelOptions }: Props) {
  const { addToast } = useToast();
  const [rows, setRows] = React.useState(initialMistakes);
  const [selectedId, setSelectedId] = React.useState<string | null>(initialMistakes[0]?.id ?? null);
  const [search, setSearch] = React.useState("");
  const [modelFilter, setModelFilter] = React.useState("all");
  const [categoryFilter, setCategoryFilter] = React.useState<"all" | MistakeReasonCategory>("all");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "pending" | "approved" | "rejected">("all");
  const [datePreset, setDatePreset] = React.useState<DatePreset>("all");
  const [adminNotes, setAdminNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [copySuccess, setCopySuccess] = React.useState<string | null>(null);
  const copySuccessTimeoutRef = React.useRef<number | null>(null);

  const reasonPointsByReasonId = React.useMemo(() => {
    const m = new Map<string, number>();
    reasons.forEach((r) => m.set(r.reason_id, r.points_deduction));
    return m;
  }, [reasons]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  React.useEffect(() => {
    setAdminNotes(selected?.admin_notes ?? "");
  }, [selectedId, selected?.admin_notes]);

  const dateRange = React.useMemo(() => getDateRange(datePreset), [datePreset]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (modelFilter !== "all" && r.model_id !== modelFilter) return false;
      if (categoryFilter !== "all" && r.reason_category !== categoryFilter) return false;
      const d = (r.mistake_date || r.created_at || "").slice(0, 10);
      if (dateRange.from && (!d || d < dateRange.from)) return false;
      if (dateRange.to && (!d || d > dateRange.to)) return false;
      if (!q) return true;
      return (r.chatter_name ?? "").toLowerCase().includes(q);
    });
  }, [rows, search, modelFilter, categoryFilter, statusFilter, dateRange]);

  const { page, setPage, totalPages, paginated, reset: resetPage } = usePagination(filtered, 20);

  React.useEffect(() => {
    resetPage();
  }, [search, modelFilter, categoryFilter, statusFilter, datePreset, resetPage]);

  const stats = React.useMemo(() => {
    const pending = rows.filter((r) => r.status === "pending").length;
    const approved = rows.filter((r) => r.status === "approved").length;
    const rejected = rows.filter((r) => r.status === "rejected").length;
    return { total: rows.length, pending, approved, rejected };
  }, [rows]);

  const pointsForSelected = selected
    ? selected.status === "pending"
      ? reasonPointsByReasonId.get(selected.reason_id) ?? selected.points_deducted
      : selected.points_deducted
    : 0;

  const pointsDisplayed = selected
    ? selected.status === "pending"
      ? pointsForSelected
      : selected.points_deducted
    : 0;

  React.useEffect(() => {
    return () => {
      if (copySuccessTimeoutRef.current !== null) {
        window.clearTimeout(copySuccessTimeoutRef.current);
      }
    };
  }, []);

  function markCopySuccess(id: string) {
    if (copySuccessTimeoutRef.current !== null) {
      window.clearTimeout(copySuccessTimeoutRef.current);
    }

    setCopySuccess(id);
    copySuccessTimeoutRef.current = window.setTimeout(() => {
      copySuccessTimeoutRef.current = null;
      setCopySuccess(null);
    }, 2000);
  }

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

    const imageUrl = m.screenshot?.[0]?.url;

    try {
      if (imageUrl && navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        const proxyImageUrl = `/api/admin/proxy-image?url=${encodeURIComponent(imageUrl)}`;
        const imgResponse = await fetch(proxyImageUrl);
        if (!imgResponse.ok) throw new Error(`image fetch ${imgResponse.status}`);
        const imgBlob = await imgResponse.blob();

        let pngBlob = imgBlob;
        if (imgBlob.type.toLowerCase() !== "image/png") {
          pngBlob = await convertToPng(imgBlob);
        }

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
      console.error("[easy-copy] clipboard fallback failed");
      addToast(localToast("mist-copy-fail", "Copy failed", "Clipboard unavailable.", "high"));
    }
  }

  async function handleApprove(id: string) {
    const row = rows.find((r) => r.id === id);
    const pts = row ? reasonPointsByReasonId.get(row.reason_id) ?? row.points_deducted : 0;
    setSaving(true);
    const prev = rows;
    setRows((p) => p.map((r) => (r.id === id ? { ...r, status: "approved" as const, points_deducted: pts } : r)));
    try {
      const res = await fetch(`/api/admin/mistakes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", admin_notes: adminNotes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "fail");
      const mist = data.mistake as MistakeRecord | undefined;
      if (mist) setRows((p) => p.map((r) => (r.id === id ? mist : r)));
      addToast(localToast("mist-appr", "Approved", "Mistake approved and points deducted.", "normal"));
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
    setRows((p) => p.map((r) => (r.id === id ? { ...r, status: "rejected" as const, admin_notes: adminNotes } : r)));
    try {
      const res = await fetch(`/api/admin/mistakes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", admin_notes: adminNotes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "fail");
      const mist = data.mistake as MistakeRecord | undefined;
      if (mist) setRows((p) => p.map((r) => (r.id === id ? mist : r)));
      addToast(localToast("mist-rej", "Rejected", "Mistake rejected.", "normal"));
    } catch {
      setRows(prev);
      addToast(localToast("mist-rej-e", "Reject failed", "Could not reject.", "high"));
    } finally {
      setSaving(false);
    }
  }

  function selectRow(id: string) {
    setSelectedId(id);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Mistakes</h1>
        <p className="mt-1 text-sm text-white/50">Review VA-submitted chatter mistakes.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", v: stats.total },
          { label: "Pending", v: stats.pending },
          { label: "Approved", v: stats.approved },
          { label: "Rejected", v: stats.rejected },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{s.label}</p>
            <p className="mt-1 text-2xl font-bold text-white">{s.v}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-6 lg:grid-cols-12">
          <div className="relative md:col-span-3 lg:col-span-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <FormInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chatter name…"
              className="!pl-9"
            />
          </div>
          <select
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            className="min-h-10 rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white md:col-span-2 lg:col-span-2"
            aria-label="Filter by model"
          >
            <option value="all">All models</option>
            {modelOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
            className="min-h-10 rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white md:col-span-2 lg:col-span-2"
            aria-label="Filter by severity"
          >
            <option value="all">All severity</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="min-h-10 rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white md:col-span-2 lg:col-span-2"
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: "week", label: "This week" },
              { key: "month", label: "This month" },
              { key: "all", label: "All time" },
            ] as const
          ).map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setDatePreset(p.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                datePreset === p.key
                  ? "border-pink-500/30 bg-pink-500/20 text-pink-300"
                  : "border-white/10 text-white/50 hover:border-white/20 hover:text-white"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <p className="text-sm text-white/50">
        Results: {filtered.length} of {rows.length} total mistakes
      </p>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          {filtered.length === 0 ? (
            <p className="glass-card border-dashed py-12 text-center text-sm text-white/45">No mistakes match filters.</p>
          ) : (
            <>
              <ul className="space-y-3 md:hidden">
                {paginated.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => selectRow(m.id)}
                      className={`glass-card w-full space-y-3 p-4 text-left transition hover:bg-white/[0.07] ${
                        selectedId === m.id ? "ring-1 ring-pink-500/40" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <ScreenshotThumb url={m.screenshot?.[0]?.url} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${categoryBadgeClass(m.reason_category)}`}>
                              {m.reason_category}
                            </span>
                            <RelativeDate iso={m.mistake_date || m.created_at} />
                          </div>
                          <p className="mt-2 font-medium text-white">{m.chatter_name}</p>
                          <p className="text-sm text-white/55">{m.model_name}</p>
                          <p className="mt-1 truncate text-sm text-white/70" title={m.reason_label}>
                            {m.reason_label}
                          </p>
                          <div className="mt-2">
                            <StatusDotBadge status={m.status} />
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="glass-card hidden overflow-x-auto md:block">
                <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-white/10 bg-zinc-950/95 backdrop-blur-md">
                    <tr className="text-xs uppercase tracking-wider text-white/45">
                      <th className="w-14 px-4 py-3.5 font-semibold">Shot</th>
                      <th className="px-4 py-3.5 font-semibold">Chatter</th>
                      <th className="px-4 py-3.5 font-semibold">Model</th>
                      <th className="px-4 py-3.5 font-semibold">Reason</th>
                      <th className="px-4 py-3.5 font-semibold">Severity</th>
                      <th className="px-4 py-3.5 font-semibold">Status</th>
                      <th className="px-4 py-3.5 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((m, idx) => (
                      <tr
                        key={m.id}
                        onClick={() => selectRow(m.id)}
                        className={`cursor-pointer border-b border-white/[0.06] transition-colors last:border-0 hover:bg-white/[0.04] ${
                          idx % 2 === 1 ? "bg-white/[0.02]" : ""
                        } ${selectedId === m.id ? "bg-pink-500/10 hover:bg-pink-500/10" : ""}`}
                      >
                        <td className="px-4 py-3 align-middle">
                          <ScreenshotThumb url={m.screenshot?.[0]?.url} />
                        </td>
                        <td className="px-4 py-3 align-middle font-medium text-white">{m.chatter_name}</td>
                        <td className="px-4 py-3 align-middle text-white/70">{m.model_name}</td>
                        <td className="max-w-[200px] px-4 py-3 align-middle">
                          <span className="block truncate text-white/80" title={m.reason_label}>
                            {m.reason_label}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${categoryBadgeClass(m.reason_category)}`}>
                            {m.reason_category}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <StatusDotBadge status={m.status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle">
                          <RelativeDate iso={m.mistake_date || m.created_at} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <PaginationControls
                page={page}
                totalPages={totalPages}
                onPage={setPage}
                totalItems={filtered.length}
              />
            </>
          )}
        </div>

        {selected ? (
          <div className="w-full shrink-0 rounded-2xl border border-white/10 bg-white/5 p-5 lg:sticky lg:top-4 lg:w-80">
            <div className="mb-4 flex items-start justify-between">
              <div className="space-y-1">
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${categoryBadgeClass(selected.reason_category)}`}>
                  {selected.reason_category}
                </span>
                <h2 className="font-bold text-white">{selected.reason_label}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-lg p-1 text-white/30 hover:bg-white/10 hover:text-white/60"
                aria-label="Close detail"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-white/40">Chatter:</span>
                <span className="text-white">{selected.chatter_name}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-white/40">Model:</span>
                <span className="text-white">{selected.model_name}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-white/40">Sub:</span>
                <span className="text-white">@{selected.sub_username}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-white/40">Date:</span>
                <span className="text-white">{formatDateTimeAthens(selected.mistake_date)}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-white/40">Points:</span>
                <span className="text-red-400">-{pointsDisplayed}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-white/40">VA:</span>
                <span className="text-white">{selected.va_name}</span>
              </div>
            </div>

            <div className="mb-3 rounded-xl border border-white/8 bg-white/[0.03] p-3">
              <p className="mb-1 text-xs uppercase tracking-widest text-white/40">Explanation</p>
              <p className="text-sm text-white/70">{selected.explanation}</p>
            </div>

            {selected.screenshot?.[0]?.url ? (
              <div className="mb-3">
                <p className="mb-2 text-xs uppercase tracking-widest text-white/40">Screenshot</p>
                <a href={selected.screenshot[0].url} target="_blank" rel="noreferrer">
                  <img
                    src={selected.screenshot[0].url}
                    alt=""
                    className="w-full rounded-xl border border-white/10 transition-opacity hover:opacity-80"
                  />
                </a>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void handleEasyCopy(selected)}
              className={`mb-3 flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-all ${
                copySuccess === selected.id
                  ? "border-green-500/30 bg-green-500/20 text-green-400"
                  : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              {copySuccess === selected.id ? (
                <>
                  <Check className="h-4 w-4" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Easy copy (text + image)
                </>
              )}
            </button>

            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add note for chatter/VA..."
              rows={3}
              className="mb-3 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-pink-500/50 focus:outline-none"
            />

            {selected.status === "pending" ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleApprove(selected.id)}
                  className="w-full rounded-xl border border-green-500/30 bg-green-500/20 py-2.5 font-semibold text-green-400 hover:bg-green-500/30 disabled:opacity-50"
                >
                  Approve & deduct {pointsForSelected} pts
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleReject(selected.id)}
                  className="w-full rounded-xl border border-red-500/30 bg-red-500/20 py-2.5 font-semibold text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
