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
import { ArrowDown, ArrowUp, Brain, ClipboardList, GripVertical, HeartHandshake } from "lucide-react";
import {
  PIPELINE_STEP_LABELS,
  type PipelineStepConfig,
  type PipelineStepType,
} from "@/lib/application-forms-types";
import { SCREENING_FRAMING_COPY } from "@/lib/application-screening-banks";

const GOLD = "#D4AF8C";

const STEP_META: Record<
  PipelineStepType,
  { icon: typeof Brain; accent: string; blurb: string }
> = {
  cognitive_screening: {
    icon: Brain,
    accent: "#7DD3C0",
    blurb: "Timed reasoning MCQs (~18 min)",
  },
  eq_screening: {
    icon: HeartHandshake,
    accent: "#E8A0BF",
    blurb: "Situational judgment scenarios",
  },
  application_form: {
    icon: ClipboardList,
    accent: GOLD,
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
        opacity: isDragging ? 0.75 : 1,
      }}
      className="relative flex min-w-[200px] flex-1 flex-col"
    >
      <div
        className={`relative overflow-hidden rounded-2xl border p-4 transition ${
          step.enabled
            ? "border-white/15 bg-gradient-to-br from-white/[0.08] to-white/[0.02]"
            : "border-white/5 bg-white/[0.02] opacity-60"
        }`}
      >
        <div
          className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-30 blur-2xl"
          style={{ background: meta.accent }}
        />
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {canManage && (
              <button
                type="button"
                className="hidden cursor-grab touch-none text-white/30 hover:text-white/70 md:inline-flex"
                aria-label="Drag to reorder"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-4 w-4" />
              </button>
            )}
            <span
              className="flex h-8 w-8 items-center justify-center rounded-xl text-sm font-semibold text-[#0D0B0D]"
              style={{ background: meta.accent }}
            >
              {index + 1}
            </span>
          </div>
          <label className="inline-flex items-center gap-2 text-[11px] text-white/55">
            <input
              type="checkbox"
              checked={step.enabled}
              disabled={!canManage || locked}
              onChange={onToggle}
              className="rounded border-white/20"
            />
            {locked ? "Required" : step.enabled ? "On" : "Off"}
          </label>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: meta.accent }} aria-hidden />
          <p className="text-sm font-medium text-white">{PIPELINE_STEP_LABELS[step.step]}</p>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-white/45">{meta.blurb}</p>

        {/* Mobile up/down */}
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
      {index < total - 1 && (
        <div className="pointer-events-none absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 md:block">
          <div className="h-px w-6 bg-gradient-to-r from-white/30 to-transparent" />
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
    commit(
      ordered.map((s) => (s.step === step ? { ...s, enabled: !s.enabled } : s)),
    );
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
          Drag to reorder. Toggle Cognitive / EQ independently.{" "}
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
