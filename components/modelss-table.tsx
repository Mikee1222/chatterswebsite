"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle, Pencil, Power, Search, Trash2, UserRound } from "lucide-react";
import type { ModelRecord } from "@/types";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { formatDateEuropean } from "@/lib/format";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdminRowAvatar, AdminStatCard, IntegrationLinkBadge, RecordStatusBadge } from "@/components/admin-list-primitives";
import { ListPagination, useClientPagination } from "@/components/earnings-filter-list";
import { toggleModelStatus, deleteModelAction } from "@/app/actions/modelss";

const PRIORITY_OPTIONS = ["low", "medium", "high"] as const;
const PLATFORM_OPTIONS = ["onlyfans", "fanvue", "other"] as const;

const PRIORITY_SCORE: Record<string, number> = { low: 1, medium: 2, high: 3 };

type StatusTab = "all" | "free" | "occupied";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function teamBadgeClass(team: ModelRecord["team"]): string {
  return team === "chatting_agency"
    ? "border-sky-500/35 bg-sky-500/15 text-sky-200"
    : "border-pink-500/35 bg-pink-500/15 text-pink-200";
}

function teamLabel(team: ModelRecord["team"]): string {
  return team === "chatting_agency" ? "Agency" : "Gunzo";
}

function priorityBadgeClass(priority: string): string {
  const p = priority.toLowerCase();
  if (p === "high") return "border-red-500/30 bg-red-500/12 text-red-200";
  if (p === "low") return "border-white/12 bg-white/[0.05] text-white/60";
  return "border-amber-500/30 bg-amber-500/12 text-amber-200";
}

function isInactiveStatus(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s === "inactive" || s === "suspended" || s === "disabled" || s === "paused";
}

function paymentPill(m: ModelRecord): { label: string; className: string } | null {
  const hasPaypal = Boolean(m.paypal_email?.trim() || m.paypal_link?.trim());
  const hasRevolut = Boolean(m.revolut_tag?.trim());
  if (hasPaypal) {
    return {
      label: "PayPal",
      className: "border-blue-500/30 bg-blue-500/12 text-blue-200",
    };
  }
  if (hasRevolut) {
    return {
      label: "Revolut",
      className: "border-violet-500/30 bg-violet-500/12 text-violet-200",
    };
  }
  return null;
}

function avgPriorityLabel(models: ModelRecord[]): string {
  const scores = models
    .map((m) => PRIORITY_SCORE[(m.priority || "medium").toLowerCase()] ?? 2)
    .filter((n) => Number.isFinite(n));
  if (scores.length === 0) return "—";
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (avg < 1.67) return "Low";
  if (avg > 2.33) return "High";
  return "Medium";
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return <AdminStatCard label={label} value={value} />;
}

export function ModelssTable({ modelss }: { modelss: ModelRecord[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; name: string } | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const statusParam = searchParams.get("mstatus") ?? "all";
  const activeStatus: StatusTab =
    statusParam === "free" || statusParam === "occupied" ? statusParam : "all";
  const platformFilter = searchParams.get("mplatform") ?? "";
  const priorityFilter = searchParams.get("mpriority") ?? "";

  const platformOptions = React.useMemo(() => {
    const fromData = new Set(modelss.map((m) => m.platform).filter(Boolean));
    for (const p of PLATFORM_OPTIONS) fromData.add(p);
    return Array.from(fromData).sort();
  }, [modelss]);

  const priorityOptions = React.useMemo(() => {
    const fromData = new Set(
      modelss.map((m) => (m.priority || "medium").toLowerCase()).filter(Boolean)
    );
    for (const p of PRIORITY_OPTIONS) fromData.add(p);
    return Array.from(fromData).sort();
  }, [modelss]);

  const statusCounts = React.useMemo(
    () => ({
      all: modelss.length,
      free: modelss.filter((m) => m.current_status === "free").length,
      occupied: modelss.filter((m) => m.current_status === "occupied").length,
    }),
    [modelss]
  );

  function pushFilters(updates: { mstatus?: string | null; mplatform?: string | null; mpriority?: string | null }) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", "modelss");
    if (updates.mstatus !== undefined) {
      if (!updates.mstatus || updates.mstatus === "all") params.delete("mstatus");
      else params.set("mstatus", updates.mstatus);
    }
    if (updates.mplatform !== undefined) {
      if (!updates.mplatform) params.delete("mplatform");
      else params.set("mplatform", updates.mplatform);
    }
    if (updates.mpriority !== undefined) {
      if (!updates.mpriority) params.delete("mpriority");
      else params.set("mpriority", updates.mpriority);
    }
    const q = params.toString();
    router.push(`${ROUTES.admin.accounts}${q ? `?${q}` : ""}`);
  }

  function clearFilters() {
    setSearch("");
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", "modelss");
    params.delete("mstatus");
    params.delete("mplatform");
    params.delete("mpriority");
    const q = params.toString();
    router.push(`${ROUTES.admin.accounts}${q ? `?${q}` : ""}`);
  }

  const filtered = React.useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return modelss.filter((m) => {
      if (activeStatus !== "all" && m.current_status !== activeStatus) return false;
      if (platformFilter && m.platform !== platformFilter) return false;
      if (priorityFilter && (m.priority || "medium").toLowerCase() !== priorityFilter) return false;
      if (!q) return true;
      return (m.model_name || "").toLowerCase().includes(q);
    });
  }, [modelss, activeStatus, platformFilter, priorityFilter, debouncedSearch]);

  const { page, setPage, totalPages, pageItems, reset, total } = useClientPagination(filtered, 12);

  React.useEffect(() => {
    reset();
  }, [activeStatus, platformFilter, priorityFilter, debouncedSearch, reset]);

  const hasActiveFilters =
    activeStatus !== "all" || Boolean(platformFilter) || Boolean(priorityFilter) || search.trim().length > 0;

  async function handleToggle(e: React.FormEvent<HTMLFormElement>, recordId: string) {
    e.preventDefault();
    if (!recordId) return;
    setTogglingId(recordId);
    try {
      await toggleModelStatus(recordId);
      router.refresh();
    } finally {
      setTogglingId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      await deleteModelAction(deleteTarget.id);
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  }

  const statusTabs: { id: StatusTab; label: string; count: number }[] = [
    { id: "all", label: "All", count: statusCounts.all },
    { id: "free", label: "Free", count: statusCounts.free },
    { id: "occupied", label: "Occupied", count: statusCounts.occupied },
  ];

  return (
    <>
      <ConfirmDialog
        open={deleteTarget != null}
        onClose={() => deletingId == null && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete model?"
        description={`This will permanently delete "${deleteTarget?.name ?? ""}" and all linked data. This cannot be undone.`}
        confirmLabel="Delete permanently"
        confirmVariant="danger"
        loading={deletingId !== null}
        requireNameConfirmation
        nameToConfirm={deleteTarget?.name ?? ""}
      />

      <div className="relative mb-4">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by model name…"
          className="w-full rounded-xl border border-white/10 bg-black/25 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/35 focus:border-pink-500/40 focus:outline-none focus:ring-1 focus:ring-pink-500/25"
          aria-label="Search models"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-white/[0.06] pb-4">
        {statusTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => pushFilters({ mstatus: tab.id })}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
              activeStatus === tab.id
                ? "border-pink-500/40 bg-pink-500/15 text-pink-100 shadow-[0_0_20px_-8px_rgba(236,72,153,0.35)]"
                : "border-white/10 bg-white/[0.03] text-white/65 hover:border-white/20 hover:bg-white/[0.06] hover:text-white/90"
            )}
          >
            {tab.label}
            <span className="rounded-md bg-black/30 px-1.5 py-0.5 text-[11px] font-semibold text-white/70">
              {tab.count}
            </span>
          </button>
        ))}

        <select
          value={platformFilter}
          onChange={(e) => pushFilters({ mplatform: e.target.value || null })}
          className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white focus:border-pink-500/40 focus:outline-none focus:ring-1 focus:ring-pink-500/25"
          aria-label="Filter by platform"
        >
          <option value="" className="bg-zinc-900">
            All platforms
          </option>
          {platformOptions.map((p) => (
            <option key={p} value={p} className="bg-zinc-900 capitalize">
              {p}
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => pushFilters({ mpriority: e.target.value || null })}
          className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white focus:border-pink-500/40 focus:outline-none focus:ring-1 focus:ring-pink-500/25"
          aria-label="Filter by priority"
        >
          <option value="" className="bg-zinc-900">
            All priorities
          </option>
          {priorityOptions.map((p) => (
            <option key={p} value={p} className="bg-zinc-900 capitalize">
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatPill label="Total" value={modelss.length} />
        <StatPill label="Free" value={statusCounts.free} />
        <StatPill label="Occupied" value={statusCounts.occupied} />
        <StatPill label="Avg priority" value={avgPriorityLabel(filtered)} />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] p-10 text-center">
          <UserRound className="mx-auto h-8 w-8 text-white/25" aria-hidden />
          <p className="mt-3 text-sm font-medium text-white/70">No models found</p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 inline-flex items-center rounded-xl border border-pink-500/35 bg-pink-500/10 px-4 py-2 text-sm font-medium text-pink-200 hover:bg-pink-500/20"
            >
              Clear filters
            </button>
          ) : (
            <p className="mt-1 text-xs text-white/45">Create a model to get started.</p>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
          {pageItems.map((m, index) => {
            const inactive = isInactiveStatus(m.status);
            const isOccupied = m.current_status === "occupied";
            const payment = paymentPill(m);
            const notesPreview = m.notes?.trim()
              ? m.notes.trim().length > 60
                ? `${m.notes.trim().slice(0, 60)}…`
                : m.notes.trim()
              : null;

            return (
              <motion.article
                key={m.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03, ease: "easeOut" }}
                className={cn(
                  "flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] transition-[border-color,box-shadow,opacity]",
                  "hover:border-pink-500/20 hover:shadow-[0_12px_40px_-28px_rgba(236,72,153,0.2)]",
                  isOccupied ? "border-l-[3px] border-l-emerald-500/70" : "border-l-[3px] border-l-white/20",
                  inactive && "opacity-60"
                )}
                style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.04)" }}
              >
                <header className="flex items-start gap-3 border-b border-white/[0.06] p-4">
                  <AdminRowAvatar name={m.model_name || "?"} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/55 capitalize">
                        {m.platform}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-white/95">{m.model_name}</h3>
                      <span
                        className={cn(
                          "inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          teamBadgeClass(m.team)
                        )}
                      >
                        {teamLabel(m.team)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
                          isOccupied
                            ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-200"
                            : "border-white/12 bg-white/[0.05] text-white/65"
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            isOccupied ? "bg-emerald-400" : "bg-white/40"
                          )}
                          aria-hidden
                        />
                        {m.current_status}
                      </span>
                      {m.priority ? (
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
                            priorityBadgeClass(m.priority)
                          )}
                        >
                          {m.priority}
                        </span>
                      ) : null}
                      <RecordStatusBadge status={m.status} />
                      <IntegrationLinkBadge kind="infloww" linked={Boolean(m.infloww_creator_id?.trim())} />
                      <IntegrationLinkBadge kind="instagram" linked={Boolean(m.clariosuite_ig_user_id?.trim())} />
                    </div>
                  </div>
                  <div className="inline-flex shrink-0 items-center gap-0.5 rounded-xl border border-white/[0.08] bg-black/25 p-0.5">
                    <Link
                      href={ROUTES.modelEdit(m.id)}
                      className="rounded-lg p-2 text-white/55 hover:bg-pink-500/15 hover:text-pink-200"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Link>
                    <form onSubmit={(e) => handleToggle(e, m.id)} className="inline-flex">
                      <button
                        type="submit"
                        disabled={togglingId === m.id}
                        className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white/85 disabled:opacity-50"
                        title={m.status === "active" ? "Deactivate" : "Activate"}
                      >
                        <Power className="h-4 w-4" aria-hidden />
                      </button>
                    </form>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({
                          id: m.id,
                          name: m.model_name?.trim() || m.model_id?.trim() || "Model",
                        })
                      }
                      disabled={deletingId !== null}
                      className="rounded-lg p-2 text-white/45 hover:bg-red-500/15 hover:text-red-300 disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </header>

                <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
                  <dl className="space-y-2.5 text-sm">
                    <div>
                      <dt className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                        Current chatter
                      </dt>
                      <dd className="mt-0.5 flex items-center gap-1.5 text-white/85">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            isOccupied && m.current_chatter_name ? "bg-emerald-400" : "bg-white/25"
                          )}
                          aria-hidden
                        />
                        {isOccupied && m.current_chatter_name ? m.current_chatter_name : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                        VA in model
                      </dt>
                      <dd className="mt-0.5 text-white/85">—</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                        Entered at
                      </dt>
                      <dd className="mt-0.5 text-white/85">
                        {m.entered_at ? formatDateEuropean(m.entered_at) : "—"}
                      </dd>
                    </div>
                  </dl>
                  <dl className="space-y-2.5 text-sm">
                    <div>
                      <dt className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                        Last chatter
                      </dt>
                      <dd className="mt-0.5 text-white/85">{m.last_chatter_name?.trim() || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                        Last exit
                      </dt>
                      <dd className="mt-0.5 text-white/85">
                        {m.last_exit_at ? formatDateEuropean(m.last_exit_at) : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                        OF User ID
                      </dt>
                      <dd className="mt-0.5 truncate font-mono text-xs text-white/70" title={m.of_user_id}>
                        {m.of_user_id?.trim() || "—"}
                      </dd>
                    </div>
                  </dl>
                </div>

                <footer className="mt-auto flex flex-wrap items-center gap-2 border-t border-white/[0.06] px-4 py-3">
                  {!m.of_user_id?.trim() ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-200">
                      <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                      No OF link
                    </span>
                  ) : null}
                  {payment ? (
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        payment.className
                      )}
                    >
                      {payment.label}
                    </span>
                  ) : null}
                  {notesPreview ? (
                    <span className="min-w-0 flex-1 truncate text-xs text-white/45" title={m.notes}>
                      {notesPreview}
                    </span>
                  ) : (
                    <span className="flex-1" />
                  )}
                  <Link
                    href={`${ROUTES.admin.models}?model=${encodeURIComponent(m.model_id || m.id)}`}
                    className="shrink-0 text-xs font-medium text-pink-300/90 hover:text-pink-200"
                  >
                    Log period
                  </Link>
                </footer>
              </motion.article>
            );
          })}
          </div>
          <ListPagination page={page} totalPages={totalPages} total={total} pageSize={12} onPageChange={setPage} />
        </div>
      )}
    </>
  );
}
