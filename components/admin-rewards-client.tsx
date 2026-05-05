"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { useToast } from "@/contexts/toast-context";
import { awardManualPointsAction, resetWeeklyLeaderboardCacheAction } from "@/app/actions/rewards";
import type { AppNotification } from "@/types";
import type { AdminPointsLedgerRow, ChatterPointsSummaryRow } from "@/services/points-engine";
import { cn } from "@/lib/utils";
import { CustomSelect, type CustomSelectOption } from "@/components/ui/custom-select";

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

const LEVEL_COLORS: Record<string, string> = {
  Bronze: "#cd7f32",
  Silver: "#c0c0c0",
  Gold: "#ffd700",
  Diamond: "#b9f2ff",
};

function formatLedgerDate(isoOrYmd: string): string {
  const s = isoOrYmd.trim();
  if (!s) return "—";
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }
  return s.slice(0, 16);
}

function rankRowClass(rank: number): string {
  if (rank === 1) return "bg-amber-500/[0.09] ring-1 ring-inset ring-amber-500/25";
  if (rank === 2) return "bg-slate-300/[0.08] ring-1 ring-inset ring-slate-300/20";
  if (rank === 3) return "bg-amber-800/[0.12] ring-1 ring-inset ring-amber-700/30";
  return "";
}

function rankLabelClass(rank: number): string {
  if (rank === 1) return "text-amber-300 font-bold tabular-nums";
  if (rank === 2) return "text-slate-200 font-bold tabular-nums";
  if (rank === 3) return "text-amber-600/90 font-bold tabular-nums";
  return "text-white/50 tabular-nums";
}

function ConfirmModal({
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
  confirming,
  confirmVariant = "primary",
  confirmDisabled = false,
}: {
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  confirming: boolean;
  confirmVariant?: "primary" | "danger";
  confirmDisabled?: boolean;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 md:items-center">
      <button type="button" className="absolute inset-0 bg-black/75 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <h2 id="confirm-modal-title" className="text-lg font-semibold text-white">
          {title}
        </h2>
        <div className="mt-4 text-sm text-white/80">{children}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming || confirmDisabled}
            className={cn(
              "flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50",
              confirmVariant === "danger"
                ? "bg-red-600 hover:bg-red-500"
                : "bg-gradient-to-r from-[hsl(330,75%,52%)] to-[hsl(280,55%,48%)]"
            )}
          >
            {confirming ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function AdminRewardsClient({
  summaries,
  chatters,
  ledger,
  isAdmin,
  showAdminInfoCard,
}: {
  summaries: ChatterPointsSummaryRow[];
  chatters: { id: string; name: string }[];
  ledger: AdminPointsLedgerRow[];
  isAdmin: boolean;
  showAdminInfoCard?: boolean;
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [userId, setUserId] = React.useState("");
  const [points, setPoints] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [showManualConfirm, setShowManualConfirm] = React.useState(false);
  const [categoryFilter, setCategoryFilter] = React.useState("");
  const [showResetModal, setShowResetModal] = React.useState(false);
  const [resetPhrase, setResetPhrase] = React.useState("");
  const [resetting, setResetting] = React.useState(false);
  const [ledgerRowPendingDelete, setLedgerRowPendingDelete] = React.useState<AdminPointsLedgerRow | null>(null);
  const [confirmingLedgerDelete, setConfirmingLedgerDelete] = React.useState(false);
  const [hiddenLedgerIds, setHiddenLedgerIds] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    setHiddenLedgerIds(new Set());
  }, [ledger]);

  const chatterSelectOptions = React.useMemo<CustomSelectOption[]>(
    () => chatters.map((c) => ({ value: c.id, label: c.name })),
    [chatters]
  );

  const categoryOptions = React.useMemo<CustomSelectOption[]>(() => {
    const set = new Set<string>();
    for (const row of ledger) {
      const c = row.category.trim();
      if (c) set.add(c);
    }
    const sorted = [...set].sort((a, b) => a.localeCompare(b));
    return [{ value: "", label: "All categories" }, ...sorted.map((c) => ({ value: c, label: c }))];
  }, [ledger]);

  const filteredLedger = React.useMemo(() => {
    if (!categoryFilter.trim()) return ledger;
    return ledger.filter((r) => r.category.trim() === categoryFilter.trim());
  }, [ledger, categoryFilter]);

  const visibleFilteredLedger = React.useMemo(
    () => filteredLedger.filter((r) => !hiddenLedgerIds.has(r.id)),
    [filteredLedger, hiddenLedgerIds]
  );

  const confirmDeleteLedgerRow = React.useCallback(async () => {
    if (!ledgerRowPendingDelete) return;
    const row = ledgerRowPendingDelete;
    setConfirmingLedgerDelete(true);
    try {
      const res = await fetch(`/api/rewards/${encodeURIComponent(row.id)}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        addToast(localToast(`ar-del-err-${Date.now()}`, "Could not remove entry", data.error ?? "Delete failed.", "high"));
        return;
      }
      setHiddenLedgerIds((prev) => new Set(prev).add(row.id));
      setLedgerRowPendingDelete(null);
      addToast(
        localToast(
          `ar-del-ok-${Date.now()}`,
          "Ledger entry removed",
          "Points balance was adjusted to match.",
          "normal"
        )
      );
      router.refresh();
    } catch {
      addToast(localToast(`ar-del-err-${Date.now()}`, "Could not remove entry", "Network error.", "high"));
    } finally {
      setConfirmingLedgerDelete(false);
    }
  }, [ledgerRowPendingDelete, addToast, router]);

  const selectedChatterName = chatters.find((c) => c.id === userId)?.name ?? "—";

  function openManualConfirm() {
    const pts = Math.trunc(Number(points));
    if (!userId.trim()) {
      addToast(localToast(`ar-err-${Date.now()}`, "Missing chatter", "Select a chatter.", "high"));
      return;
    }
    if (!Number.isFinite(pts) || pts === 0) {
      addToast(localToast(`ar-err-${Date.now()}`, "Invalid points", "Enter a non-zero number.", "high"));
      return;
    }
    if (!reason.trim()) {
      addToast(localToast(`ar-err-${Date.now()}`, "Missing reason", "Reason is required.", "high"));
      return;
    }
    setShowManualConfirm(true);
  }

  async function confirmManualAward() {
    const pts = Math.trunc(Number(points));
    setSubmitting(true);
    try {
      const res = await awardManualPointsAction(userId, pts, reason);
      if (!res.success) {
        addToast(localToast(`ar-err-${Date.now()}`, "Could not update points", res.error, "high"));
        return;
      }
      addToast(
        localToast(`ar-ok-${Date.now()}`, "Points updated", "The chatter’s balance and ledger were updated.", "normal")
      );
      setPoints("");
      setReason("");
      setUserId("");
      setShowManualConfirm(false);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      addToast(localToast(`ar-err-${Date.now()}`, "Could not update points", msg, "high"));
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmResetWeekly() {
    setResetting(true);
    try {
      const res = await resetWeeklyLeaderboardCacheAction(resetPhrase);
      if (!res.success) {
        addToast(localToast(`ar-rst-err-${Date.now()}`, "Reset failed", res.error, "high"));
        return;
      }
      addToast(
        localToast(
          `ar-rst-ok-${Date.now()}`,
          "Weekly cache cleared",
          "The in-memory weekly leaderboard cache was invalidated. Totals were not changed.",
          "normal"
        )
      );
      setResetPhrase("");
      setShowResetModal(false);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      addToast(localToast(`ar-rst-err-${Date.now()}`, "Reset failed", msg, "high"));
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-10">
      {showAdminInfoCard ? (
        <div className="rounded-2xl border border-white/[0.1] bg-zinc-900/50 p-4 text-sm leading-relaxed text-white/70">
          Points are awarded automatically when chatters complete shifts, add whales, log transactions and submit
          availability. You can award manual points using the form below. Configure point values in{" "}
          <span className="font-medium text-white/90">Rewards Config</span>.
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-900/40">
        <div className="border-b border-white/10 px-4 py-3 md:px-5">
          <h2 className="text-sm font-semibold text-white">Points overview</h2>
          <p className="mt-0.5 text-xs text-white/45">All chatters by total points (live balances).</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/45">
                <th className="px-4 py-3 font-medium">Rank</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Level</th>
                <th className="px-4 py-3 font-medium">Total points</th>
                <th className="px-4 py-3 font-medium">Streak</th>
                <th className="px-4 py-3 font-medium">Spins available</th>
                <th className="px-4 py-3 font-medium">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {summaries.map((row, i) => {
                const rank = i + 1;
                const color = LEVEL_COLORS[row.level] ?? LEVEL_COLORS.Bronze;
                return (
                  <tr key={row.userId} className={cn("text-white/90", rankRowClass(rank))}>
                    <td className={cn("px-4 py-3", rankLabelClass(rank))}>{rank}</td>
                    <td className="px-4 py-3 font-medium">{row.userName}</td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded px-2 py-0.5 text-xs font-bold uppercase"
                        style={{ color, backgroundColor: `${color}18` }}
                      >
                        {row.level}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.total_points}</td>
                    <td className="px-4 py-3 tabular-nums text-white/70">{row.streak_days}</td>
                    <td className="px-4 py-3 tabular-nums text-white/70">{row.spins_available}</td>
                    <td className="px-4 py-3 tabular-nums text-white/60">{row.last_active}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {summaries.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-white/45">No chatters found.</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-zinc-900/50 p-5">
        <h2 className="mb-1 text-sm font-semibold text-white">Manual points</h2>
        <p className="mb-4 text-xs text-white/45">Adjust balance with a ledger reason (managers and admins).</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
          <label className="block sm:col-span-2 lg:col-span-4">
            <span className="mb-1 block text-xs text-white/50">Chatter</span>
            <CustomSelect
              value={userId}
              onChange={setUserId}
              options={chatterSelectOptions}
              placeholder="Select chatter…"
              required
              aria-label="Chatter"
            />
          </label>
          <label className="block lg:col-span-2">
            <span className="mb-1 block text-xs text-white/50">Points (+ or −)</span>
            <input
              type="number"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition hover:border-white/20 focus:border-[hsl(330,70%,55%)]/50"
              placeholder="e.g. 100 or -20"
              aria-label="Points amount"
            />
          </label>
          <label className="block sm:col-span-2 lg:col-span-4">
            <span className="mb-1 block text-xs text-white/50">Reason (required)</span>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition hover:border-white/20 focus:border-[hsl(330,70%,55%)]/50"
              placeholder="Shown in ledger"
            />
          </label>
          <div className="sm:col-span-2 lg:col-span-2">
            <button
              type="button"
              onClick={openManualConfirm}
              disabled={submitting}
              className="flex h-11 w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[hsl(330,75%,52%)] to-[hsl(280,55%,48%)] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              Submit
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-900/40">
        <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-5">
          <div>
            <h2 className="text-sm font-semibold text-white">Points history</h2>
            <p className="mt-0.5 text-xs text-white/45">Last 50 transactions across all chatters.</p>
          </div>
          <div className="w-full max-w-xs shrink-0">
            <span className="mb-1 block text-xs text-white/50 md:hidden">Category</span>
            <CustomSelect
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={categoryOptions}
              placeholder="Filter category"
              aria-label="Filter by category"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/45">
                <th className="px-4 py-3 font-medium">Chatter</th>
                <th className="px-4 py-3 font-medium">Points</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 w-14 text-center font-medium"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {visibleFilteredLedger.map((row) => (
                <tr key={row.id} className="text-white/90">
                  <td className="px-4 py-3 font-medium">{row.chatterName}</td>
                  <td
                    className={cn(
                      "px-4 py-3 font-semibold tabular-nums",
                      row.points > 0 && "text-emerald-400",
                      row.points < 0 && "text-red-400",
                      row.points === 0 && "text-white/50"
                    )}
                  >
                    {row.points > 0 ? `+${row.points}` : String(row.points)}
                  </td>
                  <td className="px-4 py-3 text-white/70">{row.category.trim() || "—"}</td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-white/60" title={row.reason}>
                    {row.reason}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-white/55">{formatLedgerDate(row.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={confirmingLedgerDelete && ledgerRowPendingDelete?.id === row.id}
                        onClick={() => setLedgerRowPendingDelete(row)}
                        className="rounded-lg p-2 text-white/45 transition-colors hover:bg-red-500/15 hover:text-red-300 disabled:opacity-50"
                        title="Remove ledger entry"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ledger.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-white/45">No ledger rows yet.</p>
        ) : filteredLedger.length === 0 || visibleFilteredLedger.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-white/45">
            {filteredLedger.length === 0 ? "No rows for this category." : "No rows to show."}
          </p>
        ) : null}
      </section>

      <ConfirmDeleteModal
        open={ledgerRowPendingDelete != null}
        title="Remove ledger entry?"
        description={
          ledgerRowPendingDelete ? (
            <>
              Remove this transaction for{" "}
              <span className="font-medium text-white">{ledgerRowPendingDelete.chatterName}</span> (
              {ledgerRowPendingDelete.points > 0 ? "+" : ""}
              {ledgerRowPendingDelete.points} pts)? The chatter&apos;s balance will be adjusted. This action cannot be
              undone.
            </>
          ) : null
        }
        confirmLabel="Remove"
        onClose={() => {
          if (!confirmingLedgerDelete) setLedgerRowPendingDelete(null);
        }}
        onConfirm={confirmDeleteLedgerRow}
        confirming={confirmingLedgerDelete}
      />

      {isAdmin ? (
        <section className="rounded-2xl border border-red-500/25 bg-red-950/20 p-5">
          <h2 className="text-sm font-semibold text-red-200">Weekly leaderboard cache</h2>
          <p className="mt-1 max-w-xl text-xs text-red-200/70">
            Clears only the server’s in-memory cache for the weekly period leaderboard. Chatter total points and Airtable
            data are not modified.
          </p>
          <button
            type="button"
            onClick={() => {
              setResetPhrase("");
              setShowResetModal(true);
            }}
            className="mt-4 rounded-xl border border-red-500/40 bg-red-600/20 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:bg-red-600/30"
          >
            Reset weekly points
          </button>
        </section>
      ) : null}

      {showManualConfirm ? (
        <ConfirmModal
          title="Confirm manual points"
          confirmLabel="Confirm & apply"
          onClose={() => !submitting && setShowManualConfirm(false)}
          onConfirm={confirmManualAward}
          confirming={submitting}
        >
          <ul className="list-inside list-disc space-y-1 text-white/70">
            <li>
              <span className="text-white/90">Chatter:</span> {selectedChatterName}
            </li>
            <li>
              <span className="text-white/90">Points:</span>{" "}
              <span className={cn(Number(points) < 0 ? "text-red-400" : "text-emerald-400")}>
                {Math.trunc(Number(points)) > 0 ? "+" : ""}
                {Math.trunc(Number(points))}
              </span>
            </li>
            <li>
              <span className="text-white/90">Reason:</span> {reason.trim()}
            </li>
          </ul>
        </ConfirmModal>
      ) : null}

      {showResetModal && isAdmin ? (
        <ConfirmModal
          title="Reset weekly leaderboard cache?"
          confirmLabel="Clear weekly cache"
          confirmVariant="danger"
          confirmDisabled={resetPhrase.trim() !== "RESET"}
          onClose={() => !resetting && setShowResetModal(false)}
          onConfirm={confirmResetWeekly}
          confirming={resetting}
        >
          <p className="text-white/75">
            This does not change total points. Type <span className="font-mono font-semibold text-white">RESET</span>{" "}
            below, then confirm.
          </p>
          <label className="mt-4 block">
            <span className="mb-1 block text-xs text-white/50">Confirmation</span>
            <input
              type="text"
              value={resetPhrase}
              onChange={(e) => setResetPhrase(e.target.value)}
              autoComplete="off"
              className="h-11 w-full rounded-xl border border-white/15 bg-black/40 px-3 font-mono text-sm text-white outline-none focus:border-red-500/50"
              placeholder="RESET"
            />
          </label>
        </ConfirmModal>
      ) : null}
    </div>
  );
}
