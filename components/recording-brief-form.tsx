"use client";

import * as React from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, GripVertical, Plus, Trash2 } from "lucide-react";
import { BriefAiGenerateButton } from "@/components/brief-ai-generate-button";
import { RecordingBriefView } from "@/components/recording-brief-view";
import {
  BriefDeadlineFields,
  BriefFieldLabel,
  BriefTextArea,
  deadlineInputFromUtc,
} from "@/components/brief-shared-ui";
import { greeceLocalToUtc } from "@/lib/brief-deadlines";
import type {
  RecordingBrief,
  RecordingBriefInput,
  RecordingBriefPriority,
  RecordingBriefVariationInput,
} from "@/services/recording-briefs";
import type { ModelRecord } from "@/types";
import { VA_BTN_PRIMARY, VA_BTN_SECONDARY, VA_FILTER_INPUT } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

export type RecordingBriefFormModelOption = Pick<ModelRecord, "id" | "model_name">;

type DraftVar = RecordingBriefVariationInput & { key: string };

type Props = {
  models: RecordingBriefFormModelOption[];
  initial?: RecordingBrief | null;
  submitLabel?: string;
  onSubmit: (input: RecordingBriefInput) => Promise<void>;
  onCancel?: () => void;
};

function newKey(): string {
  return `v_${Math.random().toString(36).slice(2, 9)}`;
}

function emptyVar(): DraftVar {
  return { key: newKey(), name: "", script_shot_list: "", takes: 2, notes: "" };
}

function SortableVariation({
  item,
  index,
  onChange,
  onRemove,
  modelId,
}: {
  item: DraftVar;
  index: number;
  onChange: (next: DraftVar) => void;
  onRemove: () => void;
  modelId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-2xl border border-white/[0.1] bg-white/[0.03] p-4",
        isDragging && "opacity-80 ring-1 ring-[#D4AF8C]/40",
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-white/40 hover:bg-white/5 hover:text-white/70"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <p className="flex-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
          Variation {index + 1}
        </p>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-white/40 hover:bg-rose-500/10 hover:text-rose-300"
          aria-label="Remove variation"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3">
        <div>
          <BriefFieldLabel>Name</BriefFieldLabel>
          <input
            value={item.name ?? ""}
            onChange={(e) => onChange({ ...item, name: e.target.value })}
            className={cn(VA_FILTER_INPUT, "w-full min-h-11")}
          />
        </div>
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <BriefFieldLabel>Script / shot list</BriefFieldLabel>
            <BriefAiGenerateButton
              modelId={modelId}
              mode="text_on_screen"
              label="Generate TOS hooks"
              onResult={(text) => {
                const prev = (item.script_shot_list ?? "").trim();
                const block = `Text on screen:\n${text}`;
                onChange({
                  ...item,
                  script_shot_list: prev ? `${prev}\n\n${block}` : block,
                });
              }}
            />
          </div>
          <BriefTextArea
            value={item.script_shot_list ?? ""}
            onChange={(e) => onChange({ ...item, script_shot_list: e.target.value })}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <BriefFieldLabel>Takes</BriefFieldLabel>
            <input
              type="number"
              min={1}
              value={item.takes ?? 2}
              onChange={(e) =>
                onChange({ ...item, takes: Math.max(1, Number(e.target.value) || 2) })
              }
              className={cn(VA_FILTER_INPUT, "w-full min-h-11")}
            />
          </div>
          <div>
            <BriefFieldLabel>Notes</BriefFieldLabel>
            <input
              value={item.notes ?? ""}
              onChange={(e) => onChange({ ...item, notes: e.target.value })}
              className={cn(VA_FILTER_INPUT, "w-full min-h-11")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function RecordingBriefForm({
  models,
  initial,
  submitLabel = "Save",
  onSubmit,
  onCancel,
}: Props) {
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [modelId, setModelId] = React.useState(initial?.model_id ?? models[0]?.id ?? "");
  const [linksText, setLinksText] = React.useState(
    (initial?.reference_links ?? []).join("\n"),
  );
  const [priority, setPriority] = React.useState<RecordingBriefPriority>(
    initial?.priority ?? "normal",
  );
  const [deadlineLocal, setDeadlineLocal] = React.useState(
    deadlineInputFromUtc(initial?.deadline_at),
  );
  const [conceptWhy, setConceptWhy] = React.useState(initial?.concept_why ?? "");
  const [setupCamera, setSetupCamera] = React.useState(initial?.setup_camera ?? "");
  const [setupFraming, setSetupFraming] = React.useState(initial?.setup_framing ?? "");
  const [setupLocation, setSetupLocation] = React.useState(initial?.setup_location ?? "");
  const [setupOutfit, setSetupOutfit] = React.useState(initial?.setup_outfit ?? "");
  const [setupLight, setSetupLight] = React.useState(initial?.setup_light ?? "");
  const [setupSound, setSetupSound] = React.useState(initial?.setup_sound ?? "");
  const [setupNotes, setSetupNotes] = React.useState(initial?.setup_notes ?? "");
  const [howToTalk, setHowToTalk] = React.useState(initial?.how_to_talk ?? "");
  const [howToAct, setHowToAct] = React.useState(initial?.how_to_act ?? "");
  const [propsText, setPropsText] = React.useState(initial?.props ?? "");
  const [checklist, setChecklist] = React.useState(initial?.checklist_before_upload ?? "");
  const [uploadPath, setUploadPath] = React.useState(initial?.upload_path ?? "");
  const [clipNaming, setClipNaming] = React.useState(initial?.clip_naming ?? "V1_take1");
  const [status, setStatus] = React.useState(initial?.status ?? "draft");
  const [variations, setVariations] = React.useState<DraftVar[]>(
    initial?.variations?.length
      ? initial.variations.map((v) => ({
          key: newKey(),
          name: v.name,
          script_shot_list: v.script_shot_list,
          takes: v.takes,
          notes: v.notes,
        }))
      : [emptyVar()],
  );
  const [preview, setPreview] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setVariations((items) => {
      const oldIndex = items.findIndex((i) => i.key === active.id);
      const newIndex = items.findIndex((i) => i.key === over.id);
      if (oldIndex < 0 || newIndex < 0) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const buildInput = (nextStatus = status): RecordingBriefInput => ({
    title: title.trim() || title,
    model_id: modelId,
    reference_links: linksText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
    priority,
    deadline_local_greece: deadlineLocal.trim() || null,
    concept_why: conceptWhy,
    setup_camera: setupCamera,
    setup_framing: setupFraming,
    setup_location: setupLocation,
    setup_outfit: setupOutfit,
    setup_light: setupLight,
    setup_sound: setupSound,
    setup_notes: setupNotes,
    how_to_talk: howToTalk,
    how_to_act: howToAct,
    props: propsText,
    checklist_before_upload: checklist,
    upload_path: uploadPath,
    clip_naming: clipNaming,
    status: nextStatus as RecordingBriefInput["status"],
    variations: variations.map(({ name, script_shot_list, takes, notes }) => ({
      name,
      script_shot_list,
      takes,
      notes,
    })),
  });

  const draft = buildInput();
  const previewBrief: RecordingBrief = {
    id: initial?.id ?? "preview",
    title: draft.title,
    model_id: draft.model_id,
    reference_links: draft.reference_links ?? [],
    priority,
    deadline_at: deadlineLocal.trim()
      ? (() => {
          try {
            return greeceLocalToUtc(deadlineLocal).toISOString();
          } catch {
            return null;
          }
        })()
      : null,
    concept_why: draft.concept_why ?? "",
    setup_camera: draft.setup_camera ?? "",
    setup_framing: draft.setup_framing ?? "",
    setup_location: draft.setup_location ?? "",
    setup_outfit: draft.setup_outfit ?? "",
    setup_light: draft.setup_light ?? "",
    setup_sound: draft.setup_sound ?? "",
    setup_notes: draft.setup_notes ?? "",
    how_to_talk: draft.how_to_talk ?? "",
    how_to_act: draft.how_to_act ?? "",
    props: draft.props ?? "",
    checklist_before_upload: draft.checklist_before_upload ?? "",
    upload_path: draft.upload_path ?? "",
    clip_naming: draft.clip_naming ?? "",
    outfit_item_id: initial?.outfit_item_id ?? null,
    location_item_id: initial?.location_item_id ?? null,
    status: status as RecordingBrief["status"],
    created_by: initial?.created_by ?? "",
    reminder_sent_at: null,
    overdue_alerted_at: null,
    uploaded_at: null,
    uploaded_by: null,
    created_at: initial?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
    variations: variations.map((v, i) => ({
      id: `p${i}`,
      brief_id: initial?.id ?? "preview",
      position: i,
      name: v.name ?? "",
      script_shot_list: v.script_shot_list ?? "",
      takes: v.takes ?? 2,
      notes: v.notes ?? "",
      created_at: "",
      updated_at: "",
    })),
  };

  const submit = async (publish: boolean) => {
    setBusy(true);
    setError(null);
    try {
      // Keep current lifecycle status on save — never silently force Draft
      // when editing a published/uploaded brief (fires existing "updated" notify).
      const next = publish ? "published" : status;
      await onSubmit(buildInput(next as RecordingBriefInput["status"]));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const saveLabel =
    submitLabel !== "Save" && submitLabel !== "Save draft"
      ? submitLabel
      : status === "draft"
        ? "Save draft"
        : "Save changes";

  const modelName = models.find((m) => m.id === modelId)?.model_name;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 md:hidden">
        <button
          type="button"
          className={cn(
            VA_BTN_SECONDARY,
            "min-h-11 flex-1",
            !preview && "border-[#FF1493]/40 bg-[#FF1493]/10 text-[#FFB6DE]",
          )}
          onClick={() => setPreview(false)}
        >
          Edit
        </button>
        <button
          type="button"
          className={cn(
            VA_BTN_SECONDARY,
            "min-h-11 flex-1",
            preview && "border-[#FF1493]/40 bg-[#FF1493]/10 text-[#FFB6DE]",
          )}
          onClick={() => setPreview(true)}
        >
          Preview
        </button>
      </div>

      {preview ? (
        <div className="space-y-4 md:hidden">
          <RecordingBriefView brief={previewBrief} modelName={modelName} />
        </div>
      ) : null}

    <form
      className={cn("space-y-6 pb-28", preview && "hidden md:grid md:grid-cols-2 md:gap-6 md:space-y-0")}
      onSubmit={(e) => {
        e.preventDefault();
        void submit(false);
      }}
    >
      <div className={cn("space-y-6", preview && "md:block")}>
      {error ? (
        <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <div>
        <BriefFieldLabel>Title</BriefFieldLabel>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={cn(VA_FILTER_INPUT, "w-full min-h-11 text-base")}
        />
      </div>

      <div>
        <BriefFieldLabel>Model</BriefFieldLabel>
        <select
          required
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          className={cn(VA_FILTER_INPUT, "w-full min-h-11")}
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.model_name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <BriefFieldLabel>Reference link(s)</BriefFieldLabel>
        <BriefTextArea
          value={linksText}
          onChange={(e) => setLinksText(e.target.value)}
          placeholder={"One URL per line\nWatch before filming"}
        />
        <p className="mt-1 text-xs text-white/40">One URL per line — watch before filming</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <BriefFieldLabel>Priority</BriefFieldLabel>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as RecordingBriefPriority)}
            className={cn(VA_FILTER_INPUT, "w-full min-h-11")}
          >
            <option value="normal">Normal</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <BriefDeadlineFields value={deadlineLocal} onChange={setDeadlineLocal} />
      </div>

      <div>
        <BriefFieldLabel>Concept & Why</BriefFieldLabel>
        <BriefTextArea value={conceptWhy} onChange={(e) => setConceptWhy(e.target.value)} />
      </div>

      <div className="space-y-3 rounded-2xl border border-white/[0.08] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/75">
          Setup
        </p>
        {(
          [
            ["Camera", setupCamera, setSetupCamera],
            ["Framing", setupFraming, setSetupFraming],
            ["Location", setupLocation, setSetupLocation],
            ["Outfit", setupOutfit, setSetupOutfit],
            ["Light", setupLight, setSetupLight],
            ["Sound", setupSound, setSetupSound],
          ] as const
        ).map(([label, val, set]) => (
          <div key={label}>
            <BriefFieldLabel>{label}</BriefFieldLabel>
            <input
              value={val}
              onChange={(e) => set(e.target.value)}
              className={cn(VA_FILTER_INPUT, "w-full min-h-11")}
            />
          </div>
        ))}
        <div>
          <BriefFieldLabel>Setup notes</BriefFieldLabel>
          <BriefTextArea value={setupNotes} onChange={(e) => setSetupNotes(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <BriefFieldLabel>How to talk</BriefFieldLabel>
          <BriefTextArea value={howToTalk} onChange={(e) => setHowToTalk(e.target.value)} />
        </div>
        <div>
          <BriefFieldLabel>How to act</BriefFieldLabel>
          <BriefTextArea value={howToAct} onChange={(e) => setHowToAct(e.target.value)} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/75">
            Variations
          </p>
          <button
            type="button"
            className={cn(VA_BTN_SECONDARY, "inline-flex min-h-11 items-center gap-2")}
            onClick={() => setVariations((v) => [...v, emptyVar()])}
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={variations.map((v) => v.key)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {variations.map((item, index) => (
                <SortableVariation
                  key={item.key}
                  item={item}
                  index={index}
                  modelId={modelId}
                  onChange={(next) =>
                    setVariations((list) => list.map((x) => (x.key === item.key ? next : x)))
                  }
                  onRemove={() =>
                    setVariations((list) =>
                      list.length <= 1 ? list : list.filter((x) => x.key !== item.key),
                    )
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <div>
        <BriefFieldLabel>Props (one per line)</BriefFieldLabel>
        <BriefTextArea value={propsText} onChange={(e) => setPropsText(e.target.value)} />
      </div>
      <div>
        <BriefFieldLabel>Checklist before upload</BriefFieldLabel>
        <BriefTextArea value={checklist} onChange={(e) => setChecklist(e.target.value)} />
      </div>
      <div>
        <BriefFieldLabel>Upload path</BriefFieldLabel>
        <BriefTextArea value={uploadPath} onChange={(e) => setUploadPath(e.target.value)} />
      </div>
      <div>
        <BriefFieldLabel>Clip naming</BriefFieldLabel>
        <input
          value={clipNaming}
          onChange={(e) => setClipNaming(e.target.value)}
          className={cn(VA_FILTER_INPUT, "w-full min-h-11")}
          placeholder="V1_take1"
        />
      </div>

      </div>

      {preview ? (
        <div className="hidden md:block">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/75">
            Live preview
          </p>
          <RecordingBriefView brief={previewBrief} modelName={modelName} />
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#0A0A0A]/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md md:static md:border-0 md:bg-transparent md:p-0 md:pt-4 md:backdrop-blur-none">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-2 border-t border-white/10 pt-0 md:border-t md:pt-4">
          <button
            type="submit"
            disabled={busy}
            className={cn(VA_BTN_SECONDARY, "min-h-12 px-6")}
          >
            {busy ? "Saving…" : saveLabel}
          </button>
          <button
            type="button"
            className={cn(VA_BTN_SECONDARY, "hidden min-h-12 items-center gap-2 px-5 md:inline-flex")}
            onClick={() => setPreview((v) => !v)}
          >
            <Eye className="h-4 w-4" /> {preview ? "Hide preview" : "Preview"}
          </button>
          <button
            type="button"
            disabled={busy}
            className={cn(VA_BTN_PRIMARY, "min-h-12 px-6")}
            onClick={() => void submit(true)}
          >
            {busy ? "Saving…" : "Publish"}
          </button>
          {onCancel ? (
            <button type="button" className={cn(VA_BTN_SECONDARY, "min-h-12 px-5")} onClick={onCancel}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    </form>
    </div>
  );
}
