"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { ApplicationFlagBadges } from "@/components/application-flag-badges";
import {
  hireCandidateRequest,
  type HireCredentialsPayload,
} from "@/components/application-hire-credentials-modal";
import { AdminRowAvatar } from "@/components/admin-list-primitives";
import { ROUTES } from "@/lib/routes";
import {
  APPLICATION_RESPONSE_STATUSES,
  RESPONSE_STATUS_LABELS,
  type ApplicationFormResponseWithAnswers,
  type ApplicationResponseStatus,
} from "@/lib/application-forms-types";
import { RESPONSE_STATUS_STYLE } from "@/lib/application-ui-tokens";
import { VA_STATUS_BADGE } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import { shortAiSummary } from "@/lib/application-ai-display";

const COLUMN_IDS = APPLICATION_RESPONSE_STATUSES;

function candidateLabel(r: ApplicationFormResponseWithAnswers): string {
  const first = r.answers.find((a) => (a.answer_text ?? "").trim());
  return first?.answer_text?.trim() || "Candidate";
}

function KanbanCardInner({
  r,
  formId,
  canManage,
  onHire,
  dragging,
}: {
  r: ApplicationFormResponseWithAnswers;
  formId: string;
  canManage: boolean;
  onHire: (r: ApplicationFormResponseWithAnswers) => void;
  dragging?: boolean;
}) {
  const name = candidateLabel(r);
  const cog = r.cognitive?.percentile_at_time_of_completion;
  const eq = r.eq?.overall_score;
  const wpm = r.typing?.wpm;
  const blurb = shortAiSummary(r.ai_summary, 120);

  return (
    <div
      className={cn(
        "rounded-xl border border-white/10 bg-[#0D0B0D]/95 p-3 shadow-[0_8px_24px_-16px_rgba(0,0,0,0.8)]",
        dragging && "opacity-90 ring-2 ring-[#FF1493]/40",
      )}
    >
      <div className="flex items-start gap-2">
        <AdminRowAvatar name={name} className="h-8 w-8 text-[10px]" />
        <div className="min-w-0 flex-1">
          <Link
            href={ROUTES.admin.applicationFormResponseDetail(formId, r.id)}
            className="block truncate text-sm font-medium text-white/90 hover:text-[#FF1493]"
            onClick={(e) => e.stopPropagation()}
          >
            {name}
          </Link>
          <p className="mt-0.5 text-[10px] text-white/35">
            {new Date(r.submitted_at).toLocaleDateString()}
          </p>
        </div>
      </div>
      <ApplicationFlagBadges flags={r.auto_flags} className="mt-2" max={2} />
      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] tabular-nums text-white/55">
        <span className="rounded border border-[#FF1493]/20 bg-[#FF1493]/10 px-1.5 py-0.5 text-[#FF1493]/90">
          Cog {cog != null ? `${cog}` : "—"}
        </span>
        <span className="rounded border border-[#D4AF8C]/25 bg-[#D4AF8C]/10 px-1.5 py-0.5 text-[#D4AF8C]">
          EQ {eq != null ? eq : "—"}
        </span>
        <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5">
          {wpm != null ? `${wpm} WPM` : "— WPM"}
        </span>
      </div>
      {blurb ? (
        <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-white/40">{blurb}</p>
      ) : null}
      {canManage && r.status !== "hired" ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onHire(r);
          }}
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#D4AF8C]/35 bg-[#D4AF8C]/12 px-2 py-1.5 text-[11px] font-semibold text-[#D4AF8C] transition hover:bg-[#D4AF8C]/20"
        >
          <PartyPopper className="h-3 w-3" aria-hidden />
          Hire
        </button>
      ) : null}
      {canManage && r.status === "hired" && r.has_hire_password ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onHire(r);
          }}
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-2 py-1.5 text-[11px] font-medium text-white/70 hover:bg-white/[0.07]"
        >
          View credentials
        </button>
      ) : null}
    </div>
  );
}

function DraggableCard({
  r,
  formId,
  canManage,
  onHire,
}: {
  r: ApplicationFormResponseWithAnswers;
  formId: string;
  canManage: boolean;
  onHire: (r: ApplicationFormResponseWithAnswers) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: r.id,
    data: { status: r.status },
    disabled: !canManage,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="touch-none">
      <KanbanCardInner r={r} formId={formId} canManage={canManage} onHire={onHire} />
    </div>
  );
}

function DropColumn({
  status,
  items,
  formId,
  canManage,
  onHire,
}: {
  status: ApplicationResponseStatus;
  items: ApplicationFormResponseWithAnswers[];
  formId: string;
  canManage: boolean;
  onHire: (r: ApplicationFormResponseWithAnswers) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}` });
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex w-[min(100%,17.5rem)] shrink-0 flex-col rounded-xl border border-white/10 bg-white/[0.03] p-3 md:w-72",
        isOver && "border-[#FF1493]/40 bg-[#FF1493]/[0.06]",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className={cn(VA_STATUS_BADGE, RESPONSE_STATUS_STYLE[status])}>
          {RESPONSE_STATUS_LABELS[status]}
        </span>
        <span className="text-xs tabular-nums text-white/40">{items.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/[0.06] px-3 py-8 text-center text-xs text-white/30">
            Drop here
          </p>
        ) : (
          items.map((r) => (
            <DraggableCard
              key={r.id}
              r={r}
              formId={formId}
              canManage={canManage}
              onHire={onHire}
            />
          ))
        )}
      </div>
    </section>
  );
}

type Props = {
  formId: string;
  responses: ApplicationFormResponseWithAnswers[];
  canManage: boolean;
  onStatusChange: (id: string, status: ApplicationResponseStatus) => Promise<void>;
  onHired: (responseId: string, payload: HireCredentialsPayload, response: unknown) => void;
};

export function ApplicationResponsesKanban({
  formId,
  responses,
  canManage,
  onStatusChange,
  onHired,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileCol, setMobileCol] = useState<ApplicationResponseStatus>("new");
  const [hiringId, setHiringId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const grouped = useMemo(() => {
    const map = Object.fromEntries(
      COLUMN_IDS.map((s) => [s, [] as ApplicationFormResponseWithAnswers[]]),
    ) as Record<ApplicationResponseStatus, ApplicationFormResponseWithAnswers[]>;
    for (const r of responses) map[r.status].push(r);
    return map;
  }, [responses]);

  const active = activeId ? responses.find((r) => r.id === activeId) : null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (!canManage) return;
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId?.startsWith("col-")) return;
    const nextStatus = overId.slice(4) as ApplicationResponseStatus;
    if (!COLUMN_IDS.includes(nextStatus)) return;
    const responseId = String(e.active.id);
    const current = responses.find((r) => r.id === responseId);
    if (!current || current.status === nextStatus) return;
    try {
      await onStatusChange(responseId, nextStatus);
      toast.success(`Moved to ${RESPONSE_STATUS_LABELS[nextStatus]}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Move failed");
    }
  }

  async function handleHire(r: ApplicationFormResponseWithAnswers) {
    setHiringId(r.id);
    try {
      const result = await hireCandidateRequest(formId, r.id);
      onHired(r.id, result, result.response);
      toast.success(result.created ? "Hired — credentials ready" : "Credentials loaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hire failed");
    } finally {
      setHiringId(null);
    }
  }

  return (
    <div className="mt-4">
      {/* Mobile: single column switcher */}
      <div className="mb-3 flex gap-1 overflow-x-auto pb-1 md:hidden">
        {COLUMN_IDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setMobileCol(s)}
            className={cn(
              "shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium",
              mobileCol === s
                ? "border-[#FF1493]/40 bg-[#FF1493]/15 text-[#FF1493]"
                : "border-white/10 bg-white/[0.03] text-white/55",
            )}
          >
            {RESPONSE_STATUS_LABELS[s]} ({grouped[s].length})
          </button>
        ))}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={(ev) => void onDragEnd(ev)}
      >
        <div className="-mx-1 overflow-x-auto pb-2">
          <div className="flex min-w-min gap-3 px-1 md:gap-4">
            {COLUMN_IDS.map((status) => {
              const items = grouped[status];
              const show = true;
              // Mobile shows only selected column
              const mobileHidden = status !== mobileCol;
              return (
                <div
                  key={status}
                  className={cn(mobileHidden && "hidden md:block", !show && "hidden")}
                >
                  <DropColumn
                    status={status}
                    items={items}
                    formId={formId}
                    canManage={canManage && !hiringId}
                    onHire={(row) => void handleHire(row)}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <DragOverlay>
          {active ? (
            <div className="w-72">
              <KanbanCardInner
                r={active}
                formId={formId}
                canManage={false}
                onHire={() => undefined}
                dragging
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
