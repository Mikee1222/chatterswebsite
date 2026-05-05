"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useToast } from "@/contexts/toast-context";
import {
  clearLeaderboardCacheDebugAction,
  fixPointsAuditAction,
  runPointsAuditAction,
  simulateTestPointsAction,
} from "@/app/actions/rewards-debug";
import { REWARDS_TEST_EVENT_TYPES, type RewardsTestEventType } from "@/lib/rewards-debug-constants";
import type { PointsAuditIssue } from "@/services/points-debug-audit";
import type { AppNotification } from "@/types";
import { CustomSelect, type CustomSelectOption } from "@/components/ui/custom-select";
import { cn } from "@/lib/utils";

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

const EVENT_LABELS: Record<RewardsTestEventType, string> = {
  shift_end: "Shift end (per-hour rate)",
  whale_added: "Whale added",
  transaction: "Whale transaction",
  custom_completed: "Custom completed",
  availability: "Availability submitted",
};

const EVENT_OPTIONS: CustomSelectOption[] = REWARDS_TEST_EVENT_TYPES.map((v) => ({
  value: v,
  label: EVENT_LABELS[v],
}));

function kindStyles(kind: PointsAuditIssue["kind"]): string {
  if (kind === "duplicate_tx") return "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30";
  if (kind === "negative_total") return "bg-red-500/15 text-red-200 ring-1 ring-red-500/30";
  return "bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/30";
}

export function RewardsDebugTools({ chatters }: { chatters: { id: string; name: string }[] }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [testUserId, setTestUserId] = React.useState("");
  const [testEvent, setTestEvent] = React.useState<RewardsTestEventType>("shift_end");
  const [simulating, setSimulating] = React.useState(false);
  const [simResult, setSimResult] = React.useState<{
    pointsAwarded: number;
    previousTotal: number;
    newTotal: number;
    previousLevel: string;
    newLevel: string;
    levelChanged: boolean;
  } | null>(null);

  const [auditIssues, setAuditIssues] = React.useState<PointsAuditIssue[] | null>(null);
  const [auditing, setAuditing] = React.useState(false);
  const [fixing, setFixing] = React.useState(false);
  const [clearingCache, setClearingCache] = React.useState(false);

  const chatterOptions = React.useMemo<CustomSelectOption[]>(
    () => chatters.map((c) => ({ value: c.id, label: c.name })),
    [chatters]
  );

  async function onSimulate() {
    if (!testUserId.trim()) {
      addToast(localToast(`rd-sim-${Date.now()}`, "Select chatter", "Choose a chatter to simulate.", "high"));
      return;
    }
    setSimulating(true);
    setSimResult(null);
    try {
      const res = await simulateTestPointsAction(testUserId, testEvent);
      if (!res.success) {
        addToast(localToast(`rd-sim-err-${Date.now()}`, "Simulate failed", res.error, "high"));
        return;
      }
      setSimResult({
        pointsAwarded: res.pointsAwarded,
        previousTotal: res.previousTotal,
        newTotal: res.newTotal,
        previousLevel: res.previousLevel,
        newLevel: res.newLevel,
        levelChanged: res.levelChanged,
      });
      addToast(localToast(`rd-sim-ok-${Date.now()}`, "Test award applied", "Ledger row created with reason [TEST].", "normal"));
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      addToast(localToast(`rd-sim-err-${Date.now()}`, "Simulate failed", msg, "high"));
    } finally {
      setSimulating(false);
    }
  }

  async function onRunAudit() {
    setAuditing(true);
    setAuditIssues(null);
    try {
      const res = await runPointsAuditAction();
      if (!res.success) {
        addToast(localToast(`rd-audit-err-${Date.now()}`, "Audit failed", res.error, "high"));
        return;
      }
      setAuditIssues(res.issues);
      addToast(
        localToast(
          `rd-audit-ok-${Date.now()}`,
          "Audit complete",
          res.issues.length === 0 ? "No issues found." : `${res.issues.length} issue(s) listed below.`,
          "normal"
        )
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      addToast(localToast(`rd-audit-err-${Date.now()}`, "Audit failed", msg, "high"));
    } finally {
      setAuditing(false);
    }
  }

  async function onFixAll() {
    if (!window.confirm("This will delete duplicate ledger rows and realign totals/levels from the ledger. Continue?")) {
      return;
    }
    setFixing(true);
    try {
      const res = await fixPointsAuditAction();
      if (!res.success) {
        addToast(localToast(`rd-fix-err-${Date.now()}`, "Fix failed", res.error, "high"));
        return;
      }
      const extra =
        res.errors.length > 0 ? ` Warnings: ${res.errors.slice(0, 3).join(" · ")}${res.errors.length > 3 ? "…" : ""}` : "";
      addToast(
        localToast(
          `rd-fix-ok-${Date.now()}`,
          "Fix applied",
          `Removed ${res.deletedLedgerRows} duplicate row(s); updated ${res.updatedChatterRows} chatter profile(s).${extra}`,
          res.errors.length > 0 ? "high" : "normal"
        )
      );
      setAuditIssues(null);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      addToast(localToast(`rd-fix-err-${Date.now()}`, "Fix failed", msg, "high"));
    } finally {
      setFixing(false);
    }
  }

  async function onClearCache() {
    setClearingCache(true);
    try {
      const res = await clearLeaderboardCacheDebugAction();
      if (!res.success) {
        addToast(localToast(`rd-cache-err-${Date.now()}`, "Clear failed", res.error, "high"));
        return;
      }
      addToast(
        localToast(
          `rd-cache-ok-${Date.now()}`,
          "Cache cleared",
          "Leaderboard will refetch from Airtable on the next view.",
          "normal"
        )
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      addToast(localToast(`rd-cache-err-${Date.now()}`, "Clear failed", msg, "high"));
    } finally {
      setClearingCache(false);
    }
  }

  return (
    <div
      className="rounded-2xl border border-amber-500/25 bg-gradient-to-b from-amber-950/30 to-black/80 p-5 shadow-[0_0_0_1px_rgba(251,191,36,0.08)]"
      style={{ boxShadow: "0 0 0 1px rgba(251,191,36,0.12), 0 20px 50px rgba(0,0,0,0.5)" }}
    >
      <div className="border-b border-amber-500/20 pb-3">
        <h2 className="text-base font-semibold tracking-tight text-amber-100">Test points (admin debug)</h2>
        <p className="mt-1 text-xs text-amber-200/70">
          Creates real ledger rows and balance updates (reason <span className="font-mono">[TEST]</span>). May trigger
          notifications like normal awards.
        </p>
      </div>

      <div className="mt-5 space-y-8">
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-white/90">1. Test award</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
            <label className="block lg:col-span-5">
              <span className="mb-1 block text-xs text-white/50">Chatter</span>
              <CustomSelect
                value={testUserId}
                onChange={setTestUserId}
                options={chatterOptions}
                placeholder="Select chatter…"
                aria-label="Chatter for test award"
              />
            </label>
            <label className="block lg:col-span-5">
              <span className="mb-1 block text-xs text-white/50">Event type</span>
              <CustomSelect
                value={testEvent}
                onChange={(v) =>
                  setTestEvent(
                    (REWARDS_TEST_EVENT_TYPES as readonly string[]).includes(v) ? (v as RewardsTestEventType) : "shift_end"
                  )
                }
                options={EVENT_OPTIONS}
                aria-label="Simulated event type"
              />
            </label>
            <div className="lg:col-span-2">
              <button
                type="button"
                onClick={onSimulate}
                disabled={simulating}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-600/25 px-4 text-sm font-semibold text-amber-50 transition hover:bg-amber-600/35 disabled:opacity-50"
              >
                {simulating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Simulate
              </button>
            </div>
          </div>
          {simResult ? (
            <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/85">
              <p>
                <span className="text-white/50">Points awarded:</span>{" "}
                <span className="font-semibold tabular-nums text-emerald-300">{simResult.pointsAwarded}</span>
              </p>
              <p className="mt-1">
                <span className="text-white/50">Total:</span>{" "}
                <span className="tabular-nums">
                  {simResult.previousTotal} → {simResult.newTotal}
                </span>
              </p>
              <p className="mt-1">
                <span className="text-white/50">Level:</span>{" "}
                <span>
                  {simResult.previousLevel} → {simResult.newLevel}
                  {simResult.levelChanged ? (
                    <span className="ml-2 text-xs font-medium text-amber-300/90">(changed)</span>
                  ) : (
                    <span className="ml-2 text-xs text-white/40">(unchanged)</span>
                  )}
                </span>
              </p>
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium text-white/90">2. Points audit</h3>
          <p className="text-xs text-white/45">
            Scans duplicate <span className="font-mono">reference_id</span> rows, invalid totals, and level mismatches vs
            rules.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRunAudit}
              disabled={auditing}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              {auditing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Run audit
            </button>
            <button
              type="button"
              onClick={onFixAll}
              disabled={fixing}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-red-500/35 bg-red-600/20 px-4 text-sm font-semibold text-red-100 transition hover:bg-red-600/30 disabled:opacity-50"
            >
              {fixing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Fix all
            </button>
          </div>
          {auditIssues != null ? (
            <ul className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/25 p-3 text-sm">
              {auditIssues.length === 0 ? (
                <li className="text-white/50">No issues.</li>
              ) : (
                auditIssues.map((issue) => (
                  <li key={issue.id} className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
                    <span className={cn("inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase", kindStyles(issue.kind))}>
                      {issue.kind.replace(/_/g, " ")}
                    </span>
                    <p className="mt-2 text-white/80">{issue.message}</p>
                    {issue.duplicateRecordIds != null && issue.duplicateRecordIds.length > 0 ? (
                      <p className="mt-1 font-mono text-[10px] text-white/35">
                        Remove: {issue.duplicateRecordIds.join(", ")}
                      </p>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium text-white/90">3. Leaderboard cache</h3>
          <p className="text-xs text-white/45">Clears in-memory cached leaderboards so the next load recomputes from the ledger.</p>
          <button
            type="button"
            onClick={onClearCache}
            disabled={clearingCache}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
          >
            {clearingCache ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Clear leaderboard cache
          </button>
        </section>
      </div>
    </div>
  );
}
