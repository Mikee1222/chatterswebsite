"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  Brain,
  ClipboardList,
  GripVertical,
  HeartHandshake,
  Keyboard,
} from "lucide-react";
import {
  PIPELINE_STEP_LABELS,
  type PipelineStepConfig,
  type PipelineStepType,
} from "@/lib/application-forms-types";
import { SCREENING_FRAMING_COPY } from "@/lib/application-screening-banks";
import { APPLY } from "@/lib/application-ui-tokens";
import { cn } from "@/lib/utils";

const STEP_META: Record<
  PipelineStepType,
  { icon: typeof Brain; accent: string; blurb: string }
> = {
  cognitive_screening: {
    icon: Brain,
    accent: APPLY.pink,
    blurb: "Timed reasoning MCQs (~18 min)",
  },
  eq_screening: {
    icon: HeartHandshake,
    accent: APPLY.champagne,
    blurb: "Situational judgment scenarios",
  },
  typing_speed_test: {
    icon: Keyboard,
    accent: "#f9a8d4",
    blurb: "In-app WPM + accuracy (Greek/English)",
  },
  application_form: {
    icon: ClipboardList,
    accent: APPLY.champagne,
    blurb: "Your custom questions (always on)",
  },
};

function SortablePipelineCard({
  step,
  index,
  total,
  canManage,
  onToggle,
  onMove,
}: {
  step: PipelineStepConfig;
  index: number;
  total: number;
  canManage: boolean;
  onToggle: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.step,
    disabled: !canManage,
  });
  const meta = STEP_META[step.step];
  const Icon = meta.icon;
  const locked = step.step === "application_form";

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="relative flex min-w-[200px] flex-1 flex-col"
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border transition",
          isDragging && "shadow-lg shadow-black/40",
          step.enabled
            ? "border-[#1f1f1f] bg-[#0a0a0a]"
            : "border-white/5 bg-[#0a0a0a]/60 opacity-60",
        )}
      >
        <div
          className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-25 blur-2xl"
          style={{ background: meta.accent }}
        />
        <div className="relative border-b border-white/8 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              {canManage && (
                <button
                  type="button"
                  className="hidden cursor-grab touch-none text-white/20 hover:text-white/50 md:inline-flex"
                  aria-label="Drag to reorder"
                  {...attributes}
                  {...listeners}
                >
                  <GripVertical className="h-4 w-4" />
                </button>
              )}
              <span className="flex h-7 w-7 items-center justify-center rounded-xl border border-pink-500/20 bg-pink-500/15 text-xs font-bold text-pink-400">
                {index + 1}
              </span>
            </div>
            <label className="inline-flex items-center gap-2 text-[11px] text-white/55">
              <input
                type="checkbox"
                checked={step.enabled}
                disabled={!canManage || locked}
                onChange={onToggle}
                className="rounded border-white/20 accent-[#FF1493]"
              />
              {locked ? "Required" : step.enabled ? "On" : "Off"}
            </label>
          </div>
        </div>
        <div className="relative px-4 py-3.5">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" style={{ color: meta.accent }} aria-hidden />
            <p className="text-sm font-medium text-white">{PIPELINE_STEP_LABELS[step.step]}</p>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-white/45">{meta.blurb}</p>

          {canManage && (
            <div className="mt-3 flex gap-2 md:hidden">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => onMove(-1)}
                className="rounded-lg border border-white/10 p-1.5 text-white/60 disabled:opacity-30"
                aria-label="Move up"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={index >= total - 1}
                onClick={() => onMove(1)}
                className="rounded-lg border border-white/10 p-1.5 text-white/60 disabled:opacity-30"
                aria-label="Move down"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
      {index < total - 1 && (
        <div className="pointer-events-none absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 md:block">
          <div className="h-px w-6 bg-gradient-to-r from-[#FF1493]/40 to-transparent" />
        </div>
      )}
    </div>
  );
}

type Props = {
  config: PipelineStepConfig[];
  canManage: boolean;
  onChange: (next: PipelineStepConfig[]) => void;
};

export function ApplicationPipelineBuilder({ config, canManage, onChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ordered = [...config].sort((a, b) => a.order - b.order);

  function commit(next: PipelineStepConfig[]) {
    onChange(next.map((s, i) => ({ ...s, order: i })));
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ordered.findIndex((s) => s.step === active.id);
    const newIndex = ordered.findIndex((s) => s.step === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    commit(arrayMove(ordered, oldIndex, newIndex));
  }

  function toggle(step: PipelineStepType) {
    if (step === "application_form") return;
    commit(ordered.map((s) => (s.step === step ? { ...s, enabled: !s.enabled } : s)));
  }

  function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= ordered.length) return;
    commit(arrayMove(ordered, index, next));
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-medium text-white/85">Candidate pipeline</h2>
        <p className="mt-1 text-xs leading-relaxed text-white/40">
          Drag to reorder. Toggle Cognitive / EQ / Typing independently.{" "}
          {SCREENING_FRAMING_COPY.adminDisclaimer}
        </p>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext
          items={ordered.map((s) => s.step)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-stretch md:gap-4">
            {ordered.map((step, index) => (
              <SortablePipelineCard
                key={step.step}
                step={step}
                index={index}
                total={ordered.length}
                canManage={canManage}
                onToggle={() => toggle(step.step)}
                onMove={(dir) => move(index, dir)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
