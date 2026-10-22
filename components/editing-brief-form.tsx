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
import { EditingBriefView } from "@/components/editing-brief-view";
import {
  BriefDeadlineFields,
  BriefFieldLabel,
  BriefTextArea,
  deadlineInputFromUtc,
} from "@/components/brief-shared-ui";
import { greeceLocalToUtc } from "@/lib/brief-deadlines";
import type {
  EditingBrief,
  EditingBriefAudioVoice,
  EditingBriefInput,
  EditingBriefPriority,
  EditingBriefTextGraphics,
  EditingBriefVideoInput,
} from "@/services/editing-briefs";
import { emptyTextGraphics } from "@/services/editing-briefs";
import type { ModelRecord } from "@/types";
import { VA_BTN_PRIMARY, VA_BTN_SECONDARY, VA_FILTER_INPUT } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

export type EditingBriefFormModelOption = Pick<ModelRecord, "id" | "model_name">;
export type EditorOption = { id: string; full_name: string; email?: string };
export type RecordingBriefOption = { id: string; title: string };

type DraftVideo = EditingBriefVideoInput & { key: string };

type Props = {
  models: EditingBriefFormModelOption[];
  editors: EditorOption[];
  recordingBriefOptions?: RecordingBriefOption[];
  initial?: EditingBrief | null;
  submitLabel?: string;
  onSubmit: (input: EditingBriefInput) => Promise<void>;
  onCancel?: () => void;
};

function newKey(): string {
  return `e_${Math.random().toString(36).slice(2, 9)}`;
}

function emptyVideo(): DraftVideo {
  return { key: newKey(), output_name: "", raw_take: "", special_instructions: "" };
}

function SortableVideo({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: DraftVideo;
  index: number;
  onChange: (next: DraftVideo) => void;
  onRemove: () => void;
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
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-white/40"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <p className="flex-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
          Video {index + 1}
        </p>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-white/40 hover:text-rose-300"
          aria-label="Remove"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3">
        <div>
          <BriefFieldLabel>Output name</BriefFieldLabel>
          <input
            value={item.output_name ?? ""}
            onChange={(e) => onChange({ ...item, output_name: e.target.value })}
            className={cn(VA_FILTER_INPUT, "w-full min-h-11")}
          />
        </div>
        <div>
          <BriefFieldLabel>Raw take</BriefFieldLabel>
          <input
            value={item.raw_take ?? ""}
            onChange={(e) => onChange({ ...item, raw_take: e.target.value })}
            className={cn(VA_FILTER_INPUT, "w-full min-h-11")}
          />
        </div>
        <div>
          <BriefFieldLabel>Special instructions</BriefFieldLabel>
          <BriefTextArea
            value={item.special_instructions ?? ""}
            onChange={(e) => onChange({ ...item, special_instructions: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

export function EditingBriefForm({
  models,
  editors,
  recordingBriefOptions = [],
  initial,
  submitLabel = "Save",
  onSubmit,
  onCancel,
}: Props) {
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [modelId, setModelId] = React.useState(initial?.model_id ?? models[0]?.id ?? "");
  const [linksText, setLinksText] = React.useState((initial?.reference_links ?? []).join("\n"));
  const [priority, setPriority] = React.useState<EditingBriefPriority>(
    initial?.priority ?? "normal",
  );
  const [deadlineLocal, setDeadlineLocal] = React.useState(
    deadlineInputFromUtc(initial?.deadline_at),
  );
  const [deliverables, setDeliverables] = React.useState(initial?.deliverables_count ?? 1);
  const [recordingBriefId, setRecordingBriefId] = React.useState(
    initial?.recording_brief_id ?? "",
  );
  const [editorId, setEditorId] = React.useState(
    initial?.assigned_editor_id ?? editors[0]?.id ?? "",
  );
  const [concept, setConcept] = React.useState(initial?.concept ?? "");
  const [rawPath, setRawPath] = React.useState(initial?.raw_footage_path ?? "");
  const [rawFiles, setRawFiles] = React.useState(initial?.raw_files_takes ?? "");
  const [cutRules, setCutRules] = React.useState(initial?.cut_rules ?? "");
  const [audioVoice, setAudioVoice] = React.useState<EditingBriefAudioVoice>(
    initial?.audio_voice ?? "keep_voice",
  );
  const [audioMusic, setAudioMusic] = React.useState(initial?.audio_music ?? false);
  const [audioNotes, setAudioNotes] = React.useState(initial?.audio_notes ?? "");
  const [textGraphics, setTextGraphics] = React.useState<EditingBriefTextGraphics[]>(
    initial?.text_graphics?.length ? initial.text_graphics : [emptyTextGraphics()],
  );
  const [doNotAdd, setDoNotAdd] = React.useState(initial?.do_not_add ?? "");
  const [exportW, setExportW] = React.useState(initial?.export_width ?? 1080);
  const [exportH, setExportH] = React.useState(initial?.export_height ?? 1920);
  const [exportFps, setExportFps] = React.useState(initial?.export_fps ?? 30);
  const [exportFormat, setExportFormat] = React.useState(initial?.export_format ?? "MP4");
  const [uploadFinals, setUploadFinals] = React.useState(initial?.upload_path_finals ?? "");
  const [finalCheck, setFinalCheck] = React.useState(initial?.final_check ?? "");
  const [status, setStatus] = React.useState(initial?.status ?? "draft");
  const [videos, setVideos] = React.useState<DraftVideo[]>(
    initial?.videos?.length
      ? initial.videos.map((v) => ({
          key: newKey(),
          output_name: v.output_name,
          raw_take: v.raw_take,
          special_instructions: v.special_instructions,
        }))
      : [emptyVideo()],
  );
  const [preview, setPreview] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setVideos((items) => {
      const oldIndex = items.findIndex((i) => i.key === active.id);
      const newIndex = items.findIndex((i) => i.key === over.id);
      if (oldIndex < 0 || newIndex < 0) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const buildInput = (nextStatus = status): EditingBriefInput => ({
    title: title.trim() || title,
    model_id: modelId,
    reference_links: linksText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
    priority,
    deadline_local_greece: deadlineLocal.trim() || null,
    deliverables_count: deliverables,
    recording_brief_id: recordingBriefId.trim() || null,
    assigned_editor_id: editorId,
    concept,
    raw_footage_path: rawPath,
    raw_files_takes: rawFiles,
    cut_rules: cutRules,
    audio_voice: audioVoice,
    audio_music: audioMusic,
    audio_notes: audioNotes,
    text_graphics: textGraphics,
    do_not_add: doNotAdd,
    export_width: exportW,
    export_height: exportH,
    export_fps: exportFps,
    export_format: exportFormat,
    upload_path_finals: uploadFinals,
    final_check: finalCheck,
    status: nextStatus as EditingBriefInput["status"],
    videos: videos.map(({ output_name, raw_take, special_instructions }) => ({
      output_name,
      raw_take,
      special_instructions,
    })),
  });

  const draft = buildInput();
  const previewBrief: EditingBrief = {
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
    deliverables_count: deliverables,
    recording_brief_id: recordingBriefId || null,
    assigned_editor_id: editorId,
    concept,
    raw_footage_path: rawPath,
    raw_files_takes: rawFiles,
    cut_rules: cutRules,
    audio_voice: audioVoice,
    audio_music: audioMusic,
    audio_notes: audioNotes,
    text_graphics: textGraphics,
    do_not_add: doNotAdd,
    export_width: exportW,
    export_height: exportH,
    export_fps: exportFps,
    export_format: exportFormat,
    upload_path_finals: uploadFinals,
    final_check: finalCheck,
    status: status as EditingBrief["status"],
    reviewer_comment: initial?.reviewer_comment ?? "",
    created_by: initial?.created_by ?? "",
    reminder_sent_at: null,
    overdue_alerted_at: null,
    delivered_at: null,
    delivered_by: null,
    reviewed_at: null,
    reviewed_by: null,
    created_at: initial?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
    videos: videos.map((v, i) => ({
      id: `p${i}`,
      brief_id: initial?.id ?? "preview",
      position: i,
      output_name: v.output_name ?? "",
      raw_take: v.raw_take ?? "",
      special_instructions: v.special_instructions ?? "",
      created_at: "",
      updated_at: "",
    })),
  };

  const submit = async (publish: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (publish && !editorId.trim()) {
        throw new Error("Assigned editor is required to publish");
      }
      const next = publish
        ? "published"
        : status === "published"
          ? "published"
          : "draft";
      await onSubmit(buildInput(next as EditingBriefInput["status"]));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  if (preview) {
    const modelName = models.find((m) => m.id === modelId)?.model_name;
    const editorName = editors.find((e) => e.id === editorId)?.full_name;
    return (
      <div className="space-y-4">
        <button type="button" className={VA_BTN_SECONDARY} onClick={() => setPreview(false)}>
          Back to edit
        </button>
        <EditingBriefView brief={previewBrief} modelName={modelName} editorName={editorName} />
      </div>
    );
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(false);
      }}
    >
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
        <BriefFieldLabel>Reference links</BriefFieldLabel>
        <BriefTextArea
          value={linksText}
          onChange={(e) => setLinksText(e.target.value)}
          placeholder="One URL per line — watch first, copy the style"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <BriefFieldLabel>Priority</BriefFieldLabel>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as EditingBriefPriority)}
            className={cn(VA_FILTER_INPUT, "w-full min-h-11")}
          >
            <option value="normal">Normal</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <BriefDeadlineFields value={deadlineLocal} onChange={setDeadlineLocal} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <BriefFieldLabel>Deliverables (# videos)</BriefFieldLabel>
          <input
            type="number"
            min={1}
            value={deliverables}
            onChange={(e) => setDeliverables(Math.max(1, Number(e.target.value) || 1))}
            className={cn(VA_FILTER_INPUT, "w-full min-h-11")}
          />
        </div>
        <div>
          <BriefFieldLabel>Linked Recording Brief (optional)</BriefFieldLabel>
          <select
            value={recordingBriefId}
            onChange={(e) => setRecordingBriefId(e.target.value)}
            className={cn(VA_FILTER_INPUT, "w-full min-h-11")}
          >
            <option value="">None</option>
            {recordingBriefOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <BriefFieldLabel>Assigned Editor (required to publish)</BriefFieldLabel>
        <select
          value={editorId}
          onChange={(e) => setEditorId(e.target.value)}
          className={cn(VA_FILTER_INPUT, "w-full min-h-11")}
        >
          <option value="">Select editor…</option>
          {editors.map((ed) => (
            <option key={ed.id} value={ed.id}>
              {ed.full_name || ed.email || ed.id}
            </option>
          ))}
        </select>
      </div>
      <div>
        <BriefFieldLabel>Concept</BriefFieldLabel>
        <BriefTextArea value={concept} onChange={(e) => setConcept(e.target.value)} />
      </div>
      <div>
        <BriefFieldLabel>Raw footage path</BriefFieldLabel>
        <BriefTextArea value={rawPath} onChange={(e) => setRawPath(e.target.value)} />
      </div>
      <div>
        <BriefFieldLabel>Files / takes list</BriefFieldLabel>
        <BriefTextArea value={rawFiles} onChange={(e) => setRawFiles(e.target.value)} />
      </div>
      <div>
        <BriefFieldLabel>Cut rules</BriefFieldLabel>
        <BriefTextArea value={cutRules} onChange={(e) => setCutRules(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <BriefFieldLabel>Audio voice</BriefFieldLabel>
          <select
            value={audioVoice}
            onChange={(e) => setAudioVoice(e.target.value as EditingBriefAudioVoice)}
            className={cn(VA_FILTER_INPUT, "w-full min-h-11")}
          >
            <option value="keep_voice">Keep voice</option>
            <option value="mute_original">Mute original</option>
            <option value="clean_up">Clean up</option>
          </select>
        </div>
        <div>
          <BriefFieldLabel>Music</BriefFieldLabel>
          <select
            value={audioMusic ? "yes" : "no"}
            onChange={(e) => setAudioMusic(e.target.value === "yes")}
            className={cn(VA_FILTER_INPUT, "w-full min-h-11")}
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>
        <div>
          <BriefFieldLabel>Audio notes</BriefFieldLabel>
          <input
            value={audioNotes}
            onChange={(e) => setAudioNotes(e.target.value)}
            className={cn(VA_FILTER_INPUT, "w-full min-h-11")}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/75">
            Text & graphics
          </p>
          <button
            type="button"
            className={cn(VA_BTN_SECONDARY, "min-h-11")}
            onClick={() => setTextGraphics((g) => [...g, emptyTextGraphics()])}
          >
            <Plus className="mr-1 inline h-4 w-4" /> Add
          </button>
        </div>
        {textGraphics.map((tg, i) => (
          <div key={i} className="space-y-2 rounded-2xl border border-white/[0.1] p-4">
            <div className="flex justify-between">
              <p className="text-xs text-white/45">Block {i + 1}</p>
              <button
                type="button"
                className="text-white/40 hover:text-rose-300"
                onClick={() =>
                  setTextGraphics((g) => (g.length <= 1 ? g : g.filter((_, j) => j !== i)))
                }
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <BriefFieldLabel>Title on top — text</BriefFieldLabel>
            <BriefTextArea
              value={tg.title_on_top_text}
              onChange={(e) =>
                setTextGraphics((g) =>
                  g.map((x, j) => (j === i ? { ...x, title_on_top_text: e.target.value } : x)),
                )
              }
            />
            <BriefFieldLabel>Title on top — style</BriefFieldLabel>
            <input
              value={tg.title_on_top_style}
              onChange={(e) =>
                setTextGraphics((g) =>
                  g.map((x, j) => (j === i ? { ...x, title_on_top_style: e.target.value } : x)),
                )
              }
              className={cn(VA_FILTER_INPUT, "w-full min-h-11")}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <BriefFieldLabel>Subtitles</BriefFieldLabel>
                <select
                  value={tg.subtitles ? "yes" : "no"}
                  onChange={(e) =>
                    setTextGraphics((g) =>
                      g.map((x, j) =>
                        j === i ? { ...x, subtitles: e.target.value === "yes" } : x,
                      ),
                    )
                  }
                  className={cn(VA_FILTER_INPUT, "w-full min-h-11")}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              <div>
                <BriefFieldLabel>Subtitles style</BriefFieldLabel>
                <input
                  value={tg.subtitles_style}
                  onChange={(e) =>
                    setTextGraphics((g) =>
                      g.map((x, j) => (j === i ? { ...x, subtitles_style: e.target.value } : x)),
                    )
                  }
                  className={cn(VA_FILTER_INPUT, "w-full min-h-11")}
                />
              </div>
            </div>
            <BriefFieldLabel>Labels (clip→label)</BriefFieldLabel>
            <BriefTextArea
              value={tg.labels}
              onChange={(e) =>
                setTextGraphics((g) =>
                  g.map((x, j) => (j === i ? { ...x, labels: e.target.value } : x)),
                )
              }
            />
            <BriefFieldLabel>Pictures (item→image)</BriefFieldLabel>
            <BriefTextArea
              value={tg.pictures}
              onChange={(e) =>
                setTextGraphics((g) =>
                  g.map((x, j) => (j === i ? { ...x, pictures: e.target.value } : x)),
                )
              }
            />
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/75">
            Per video
          </p>
          <button
            type="button"
            className={cn(VA_BTN_SECONDARY, "min-h-11")}
            onClick={() => setVideos((v) => [...v, emptyVideo()])}
          >
            <Plus className="mr-1 inline h-4 w-4" /> Add
          </button>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={videos.map((v) => v.key)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {videos.map((item, index) => (
                <SortableVideo
                  key={item.key}
                  item={item}
                  index={index}
                  onChange={(next) =>
                    setVideos((list) => list.map((x) => (x.key === item.key ? next : x)))
                  }
                  onRemove={() =>
                    setVideos((list) =>
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
        <BriefFieldLabel>Do NOT add</BriefFieldLabel>
        <BriefTextArea value={doNotAdd} onChange={(e) => setDoNotAdd(e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <BriefFieldLabel>Width</BriefFieldLabel>
          <input
            type="number"
            value={exportW}
            onChange={(e) => setExportW(Number(e.target.value) || 1080)}
            className={cn(VA_FILTER_INPUT, "w-full min-h-11")}
          />
        </div>
        <div>
          <BriefFieldLabel>Height</BriefFieldLabel>
          <input
            type="number"
            value={exportH}
            onChange={(e) => setExportH(Number(e.target.value) || 1920)}
            className={cn(VA_FILTER_INPUT, "w-full min-h-11")}
          />
        </div>
        <div>
          <BriefFieldLabel>FPS</BriefFieldLabel>
          <input
            type="number"
            value={exportFps}
            onChange={(e) => setExportFps(Number(e.target.value) || 30)}
            className={cn(VA_FILTER_INPUT, "w-full min-h-11")}
          />
        </div>
        <div>
          <BriefFieldLabel>Format</BriefFieldLabel>
          <input
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value)}
            className={cn(VA_FILTER_INPUT, "w-full min-h-11")}
          />
        </div>
      </div>
      <div>
        <BriefFieldLabel>Upload path for finals</BriefFieldLabel>
        <BriefTextArea value={uploadFinals} onChange={(e) => setUploadFinals(e.target.value)} />
      </div>
      <div>
        <BriefFieldLabel>Final check</BriefFieldLabel>
        <BriefTextArea value={finalCheck} onChange={(e) => setFinalCheck(e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
        <button
          type="button"
          disabled={busy}
          className={cn(VA_BTN_PRIMARY, "min-h-12 px-6")}
          onClick={() => void submit(true)}
        >
          {busy ? "Saving…" : "Publish"}
        </button>
        <button type="submit" disabled={busy} className={cn(VA_BTN_SECONDARY, "min-h-12 px-6")}>
          {submitLabel}
        </button>
        <button
          type="button"
          className={cn(VA_BTN_SECONDARY, "inline-flex min-h-12 items-center gap-2 px-5")}
          onClick={() => setPreview(true)}
        >
          <Eye className="h-4 w-4" /> Preview
        </button>
        {onCancel ? (
          <button type="button" className={cn(VA_BTN_SECONDARY, "min-h-12 px-5")} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          className="sr-only"
          onClick={() => setStatus(status)}
          tabIndex={-1}
          aria-hidden
        />
      </div>
    </form>
  );
}
