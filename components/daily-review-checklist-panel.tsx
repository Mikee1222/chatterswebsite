"use client";

import * as React from "react";
import { Check, ChevronDown, ClipboardList, Flag, ImageIcon, RotateCcw } from "lucide-react";
import {
  ReviewEmptyState,
  ReviewSectionHeader,
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_CARD,
  VA_CHAMPAGNE_DIVIDER,
  VA_MODEL_TAG,
} from "@/components/manager-review-ui";
import { formatVaBreakdownLine } from "@/lib/daily-review-checklist-format";
import type {
  DailyReviewChecklistItem,
  DailyReviewChecklistPayload,
  DailyReviewChecklistTask,
  DailyReviewChecklistVa,
  DailyReviewChecklistVaShared,
} from "@/services/daily-review-checklist";
import type { DailyReviewItemVerification } from "@/services/daily-review-verifications";
import { cn } from "@/lib/utils";

type Mode = "supervisor" | "admin";

type Props = {
  mode: Mode;
  checklist: DailyReviewChecklistPayload | null;
  /** Admin shared view with multi-supervisor overlays */
  sharedVas?: DailyReviewChecklistVaShared[];
  busyItemId?: string | null;
  onVerify?: (item: DailyReviewChecklistItem, va: { va_id: string; va_name: string }) => void;
  onFlag?: (item: DailyReviewChecklistItem, va: { va_id: string; va_name: string }) => void;
  onClear?: (item: DailyReviewChecklistItem) => void;
  readOnly?: boolean;
};

type ChecklistTaskLike = DailyReviewChecklistTask | DailyReviewChecklistVaShared["tasks"][number];
type ChecklistItemLike = ChecklistTaskLike["items"][number];

type TaskReviewStats = {
  total: number;
  verified: number;
  flagged: number;
  unverified: number;
};

function computeTaskReviewStats(items: ChecklistItemLike[]): TaskReviewStats {
  let verified = 0;
  let flagged = 0;
  for (const item of items) {
    const list =
      "verifications" in item && Array.isArray(item.verifications)
        ? item.verifications
        : "verification" in item && item.verification
          ? [item.verification]
          : [];
    if (list.some((v) => v.verified_status === "flagged_not_done")) flagged += 1;
    else if (list.some((v) => v.verified_status === "verified")) verified += 1;
  }
  const total = items.length;
  return { total, verified, flagged, unverified: Math.max(0, total - verified - flagged) };
}

function formatTaskReviewSummary(stats: TaskReviewStats): string {
  if (stats.total === 0) return "No items";
  if (stats.flagged > 0) {
    return `${stats.verified}/${stats.total} verified, ${stats.flagged} flagged`;
  }
  return `${stats.verified}/${stats.total} verified`;
}

function VaStatusPill({ status }: { status: "pending" | "completed" }) {
  return status === "completed" ? (
    <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
      VA done
    </span>
  ) : (
    <span className="rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#B8B4B8]/55">
      VA pending
    </span>
  );
}

function VerificationOverlay({
  verification,
  verifications,
}: {
  verification?: DailyReviewItemVerification | null;
  verifications?: DailyReviewItemVerification[];
}) {
  const list = verifications ?? (verification ? [verification] : []);
  if (!list.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {list.map((v) => (
        <span
          key={v.id}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            v.verified_status === "verified"
              ? "border-emerald-500/35 bg-emerald-500/12 text-emerald-300"
              : "border-red-500/40 bg-red-500/15 text-red-300",
          )}
          title={`${v.verified_by_name || "Supervisor"} · ${v.verified_at}`}
        >
          {v.verified_status === "verified" ? (
            <Check className="h-3 w-3" aria-hidden />
          ) : (
            <Flag className="h-3 w-3" aria-hidden />
          )}
          {v.verified_by_name || "Supervisor"}
        </span>
      ))}
    </div>
  );
}

function ItemRow({
  item,
  va,
  mode,
  busy,
  readOnly,
  verifications,
  onVerify,
  onFlag,
  onClear,
}: {
  item: DailyReviewChecklistItem & { verifications?: DailyReviewItemVerification[] };
  va: { va_id: string; va_name: string };
  mode: Mode;
  busy: boolean;
  readOnly?: boolean;
  verifications?: DailyReviewItemVerification[];
  onVerify?: Props["onVerify"];
  onFlag?: Props["onFlag"];
  onClear?: Props["onClear"];
}) {
  const flagged =
    item.verification?.verified_status === "flagged_not_done" ||
    (verifications ?? []).some((v) => v.verified_status === "flagged_not_done");
  const verified =
    item.verification?.verified_status === "verified" ||
    (verifications ?? []).some((v) => v.verified_status === "verified");

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-3 transition-colors",
        flagged
          ? "border-red-500/40 bg-red-500/[0.08] shadow-[0_0_16px_-6px_rgba(239,68,68,0.35)]"
          : verified
            ? "border-emerald-500/25 bg-emerald-500/[0.05]"
            : "border-white/10 bg-white/[0.02]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-white">{item.title || "Untitled step"}</p>
            <VaStatusPill status={item.va_status} />
            {item.requires_screenshot ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-[#D4AF8C]/70">
                <ImageIcon className="h-3 w-3" aria-hidden />
                Screenshot{item.screenshot_count > 0 ? ` · ${item.screenshot_count}` : ""}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-[#B8B4B8]/45">
            Phase {item.phase_number}
            {item.phase_title ? ` · ${item.phase_title}` : ""}
          </p>
          {item.description ? (
            <p className="text-sm text-[#B8B4B8]/65">{item.description}</p>
          ) : null}
          <VerificationOverlay verification={item.verification} verifications={verifications} />
        </div>

        {mode === "supervisor" && !readOnly ? (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => onVerify?.(item, va)}
              className={cn(
                VA_BTN_SECONDARY,
                "inline-flex min-h-9 items-center gap-1.5 px-2.5 py-1.5 text-xs",
                item.verification?.verified_status === "verified" &&
                  "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
              )}
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              Verify
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onFlag?.(item, va)}
              className={cn(
                VA_BTN_SECONDARY,
                "inline-flex min-h-9 items-center gap-1.5 px-2.5 py-1.5 text-xs",
                item.verification?.verified_status === "flagged_not_done" &&
                  "border-red-500/45 bg-red-500/15 text-red-200",
              )}
            >
              <Flag className="h-3.5 w-3.5" aria-hidden />
              Flag
            </button>
            {item.verification ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onClear?.(item)}
                className={cn(VA_BTN_SECONDARY, "inline-flex min-h-9 items-center gap-1.5 px-2.5 py-1.5 text-xs")}
                title="Clear verification"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TaskGroup({
  task,
  va,
  mode,
  busyItemId,
  readOnly,
  onVerify,
  onFlag,
  onClear,
}: {
  task: ChecklistTaskLike;
  va: { va_id: string; va_name: string };
  mode: Mode;
  busyItemId?: string | null;
  readOnly?: boolean;
  onVerify?: Props["onVerify"];
  onFlag?: Props["onFlag"];
  onClear?: Props["onClear"];
}) {
  const stats = computeTaskReviewStats(task.items);
  // Default: expand tasks still needing review; collapse fully reviewed ones.
  // Manual toggles only after mount — finishing the last item does not auto-collapse mid-session.
  const [expanded, setExpanded] = React.useState(() => stats.unverified > 0 || stats.total === 0);
  const panelId = React.useId();
  const summary = formatTaskReviewSummary(stats);
  const fullyReviewed = stats.total > 0 && stats.unverified === 0;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.015]",
        fullyReviewed && stats.flagged === 0 && "border-emerald-500/15",
        stats.flagged > 0 && "border-red-500/20",
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-[#D4AF8C]">{task.task_title}</p>
            {task.is_virtual ? (
              <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#B8B4B8]/45">
                Projected
              </span>
            ) : null}
            <span className="text-[10px] uppercase tracking-wider text-[#B8B4B8]/40">{task.task_status}</span>
          </div>
          <p
            className={cn(
              "text-[11px] tabular-nums",
              stats.flagged > 0
                ? "text-red-300/80"
                : fullyReviewed
                  ? "text-emerald-300/75"
                  : "text-[#B8B4B8]/45",
            )}
          >
            {summary}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[#B8B4B8]/40 transition-transform duration-300 ease-out motion-reduce:transition-none",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <div
        id={panelId}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-2 border-t border-white/[0.05] px-3 pb-3 pt-2">
            {task.items.length === 0 ? (
              <p className="py-2 text-xs text-[#B8B4B8]/35">No checklist items</p>
            ) : (
              task.items.map((item) => (
                <ItemRow
                  key={item.item_id}
                  item={item as DailyReviewChecklistItem & { verifications?: DailyReviewItemVerification[] }}
                  va={va}
                  mode={mode}
                  busy={busyItemId === item.item_id}
                  readOnly={readOnly}
                  verifications={"verifications" in item ? item.verifications : undefined}
                  onVerify={onVerify}
                  onFlag={onFlag}
                  onClear={onClear}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function VaBlock({
  va,
  mode,
  busyItemId,
  readOnly,
  onVerify,
  onFlag,
  onClear,
}: {
  va: DailyReviewChecklistVa | DailyReviewChecklistVaShared;
  mode: Mode;
  busyItemId?: string | null;
  readOnly?: boolean;
  onVerify?: Props["onVerify"];
  onFlag?: Props["onFlag"];
  onClear?: Props["onClear"];
}) {
  const flaggedCount = va.stats.flagged;
  return (
    <section
      className={cn(
        VA_CARD,
        "space-y-4 p-4 md:p-5",
        flaggedCount > 0 && "ring-1 ring-red-500/25",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-white">{va.va_name}</h3>
          <p className="mt-0.5 text-xs text-[#B8B4B8]/50">{formatVaBreakdownLine(va)}</p>
        </div>
        <span className={VA_MODEL_TAG}>
          {va.stats.va_completed}/{va.stats.total_items} VA completed
        </span>
      </div>
      <div className={VA_CHAMPAGNE_DIVIDER} />
      <div className="space-y-3">
        {va.tasks.map((task) => (
          <TaskGroup
            key={task.task_id}
            task={task}
            va={{ va_id: va.va_id, va_name: va.va_name }}
            mode={mode}
            busyItemId={busyItemId}
            readOnly={readOnly}
            onVerify={onVerify}
            onFlag={onFlag}
            onClear={onClear}
          />
        ))}
      </div>
    </section>
  );
}

export function DailyReviewChecklistPanel({
  mode,
  checklist,
  sharedVas,
  busyItemId,
  onVerify,
  onFlag,
  onClear,
  readOnly,
}: Props) {
  const vas = sharedVas ?? checklist?.vas ?? [];
  if (!checklist && !sharedVas) return null;
  if (!vas.length) {
    return (
      <ReviewEmptyState
        icon={ClipboardList}
        title="No VA checklist items for this date"
        description="When VAs have tasks with phases on this Athens day, every checklist step will appear here for verify / flag."
      />
    );
  }

  const flaggedFirst = [...vas].sort((a, b) => b.stats.flagged - a.stats.flagged || a.va_name.localeCompare(b.va_name));

  return (
    <div className="space-y-4">
      <ReviewSectionHeader>
        {mode === "admin" ? "Team checklist audit" : "Live VA checklist audit"}
      </ReviewSectionHeader>
      {flaggedFirst.map((va) => (
        <VaBlock
          key={va.va_id}
          va={va}
          mode={mode}
          busyItemId={busyItemId}
          readOnly={readOnly}
          onVerify={onVerify}
          onFlag={onFlag}
          onClear={onClear}
        />
      ))}
      {mode === "supervisor" && !readOnly ? (
        <p className="text-center text-xs text-[#B8B4B8]/40">
          Verify confirms the step; Flag marks it not done. Starting an action auto-creates your daily review for this date.
        </p>
      ) : null}
      {mode === "supervisor" && readOnly ? null : null}
    </div>
  );
}

/** Compact per-VA summary chips for the stats strip. */
export function DailyReviewVaSummaryChips({
  vas,
}: {
  vas: Array<{ va_id: string; va_name: string; stats: DailyReviewChecklistVa["stats"] }>;
}) {
  if (!vas.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {vas.map((va) => (
        <span
          key={va.va_id}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs",
            va.stats.flagged > 0
              ? "border-red-500/35 bg-red-500/10 text-red-200"
              : va.stats.verified === va.stats.total_items && va.stats.total_items > 0
                ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
                : "border-white/10 bg-white/5 text-[#B8B4B8]/70",
          )}
        >
          {formatVaBreakdownLine(va)}
        </span>
      ))}
    </div>
  );
}

// Keep primary button token referenced for tree-shaking / design consistency in parents
void VA_BTN_PRIMARY;
