"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  ChevronDown,
  ExternalLink,
  FileText,
  History,
  Info,
  Loader2,
  Paperclip,
  PenLine,
  Trash2,
  Upload,
} from "lucide-react";
import {
  AttachmentLinks,
  ManagerReviewSelect,
  ManagerReviewTextarea,
  ReviewFieldLabel,
  ScriptStatusBadge,
  displayOrDash,
  type CustomSelectOption,
} from "@/components/manager-review-ui";
import { StatInfoTooltip } from "@/components/infloww-performance-ui";
import { useToast } from "@/contexts/toast-context";
import { truncateNote } from "@/lib/winner-videos-copy";
import { winnerVideoLocalToast } from "@/components/winner-videos-shared";
import type { WinnerVideoRecord } from "@/services/winner-videos";
import type {
  BunchScriptProgress,
  SlotScriptMeta,
} from "@/services/winner-sourcing";
import type { ModelRecord } from "@/types";
import { useIsSupabaseBackend } from "@/contexts/data-backend-context";
import { useSupabaseRealtimeRefresh } from "@/lib/hooks/use-supabase-realtime";
import { slotVideoTypeLabel } from "@/lib/winner-sourcing-helpers";
import { uploadFileToSupabaseStorage } from "@/lib/client-direct-storage-upload";
import {
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_CARD,
  VA_CARD_GLOW,
  VA_STATUS_BADGE,
} from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import { CreativeScriptsHistory } from "@/components/creative-scripts-history";

type Props = {
  initialQueue: WinnerVideoRecord[];
  initialHistory?: WinnerVideoRecord[];
  initialBunchProgress?: BunchScriptProgress[];
  initialSlotMeta?: SlotScriptMeta[];
  gunzoModels: ModelRecord[];
};

function resolveModelId(video: WinnerVideoRecord, models: ModelRecord[]): string {
  const name = video.assigned_creator_name?.trim();
  if (!name) return "";
  const match = models.find((m) => m.model_name.trim() === name);
  return match?.id ?? `custom:${name}`;
}

function modelNameFromSelection(modelId: string, models: ModelRecord[]): string {
  if (modelId.startsWith("custom:")) return modelId.slice("custom:".length);
  return models.find((m) => m.id === modelId)?.model_name ?? "";
}

function statusSortRank(status: string): number {
  if (status === "Rejected") return 0;
  if (status === "Needs Script") return 1;
  if (status === "Pending Review") return 2;
  if (status === "Approved") return 3;
  return 4;
}

type QueueGroup = {
  key: string;
  title: string;
  modelName: string;
  progress?: BunchScriptProgress;
  videos: WinnerVideoRecord[];
};

const BRIEF_TIP =
  "Filming brief for the shoot: tone, framing, wardrobe, lighting, or shot notes the filmer should follow.";
const TOS_TIP =
  "Suggested on-screen text overlays (captions, titles, callouts). Secondary to the spoken/main script.";

export function CreativeScriptsQueueClient({
  initialQueue,
  initialHistory = [],
  initialBunchProgress = [],
  initialSlotMeta = [],
  gunzoModels,
}: Props) {
  const { addToast } = useToast();
  const reduceMotion = useReducedMotion();
  const isSupabaseBackend = useIsSupabaseBackend();
  const [queue, setQueue] = React.useState(initialQueue);
  const [history, setHistory] = React.useState(initialHistory);
  const [bunchProgress, setBunchProgress] = React.useState(initialBunchProgress);
  const [slotMeta, setSlotMeta] = React.useState(initialSlotMeta);
  const [loading, setLoading] = React.useState(false);
  const [tab, setTab] = React.useState<"write" | "history">("write");
  const [expandedBunch, setExpandedBunch] = React.useState<string | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [modelId, setModelId] = React.useState("");
  const [scriptText, setScriptText] = React.useState("");
  const [textOnScreen, setTextOnScreen] = React.useState("");
  const [textOnScreenOpen, setTextOnScreenOpen] = React.useState(false);
  const [scriptBrief, setScriptBrief] = React.useState("");
  const [scriptBriefOpen, setScriptBriefOpen] = React.useState(false);
  const [brainstormText, setBrainstormText] = React.useState<string | null>(null);
  const [brainstormLoading, setBrainstormLoading] = React.useState(false);
  /** New direct-upload sb:// token; undefined = keep existing. */
  const [briefAttachmentToken, setBriefAttachmentToken] = React.useState<string | undefined>(
    undefined,
  );
  const [briefAttachmentDisplay, setBriefAttachmentDisplay] = React.useState<{
    url: string;
    filename: string;
  } | null>(null);
  const [briefUploading, setBriefUploading] = React.useState(false);
  const [briefUploadError, setBriefUploadError] = React.useState<string | null>(null);
  const briefFileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => setQueue(initialQueue), [initialQueue]);
  React.useEffect(() => setHistory(initialHistory), [initialHistory]);
  React.useEffect(() => setBunchProgress(initialBunchProgress), [initialBunchProgress]);
  React.useEffect(() => setSlotMeta(initialSlotMeta), [initialSlotMeta]);

  const metaByVideoId = React.useMemo(() => {
    const map = new Map<string, SlotScriptMeta>();
    for (const m of slotMeta) map.set(m.winner_video_id, m);
    return map;
  }, [slotMeta]);

  const progressByBunchId = React.useMemo(() => {
    const map = new Map<string, BunchScriptProgress>();
    for (const p of bunchProgress) map.set(p.bunch_id, p);
    return map;
  }, [bunchProgress]);

  const groups = React.useMemo<QueueGroup[]>(() => {
    const byBunch = new Map<string, WinnerVideoRecord[]>();
    const other: WinnerVideoRecord[] = [];
    for (const v of queue) {
      const bunchId = v.bunch_id?.trim();
      if (bunchId) {
        const list = byBunch.get(bunchId) ?? [];
        list.push(v);
        byBunch.set(bunchId, list);
      } else {
        other.push(v);
      }
    }
    const out: QueueGroup[] = [];
    for (const [bunchId, videos] of byBunch) {
      const progress = progressByBunchId.get(bunchId);
      const title =
        progress?.bunch_name ||
        videos[0]?.bunch_name?.trim() ||
        metaByVideoId.get(videos[0]?.id ?? "")?.bunch_name ||
        "Bunch";
      const modelName =
        progress?.model_name?.trim() ||
        videos.find((v) => v.assigned_creator_name?.trim())?.assigned_creator_name?.trim() ||
        videos[0]?.reference_model_name?.trim() ||
        "";
      const sorted = [...videos].sort((a, b) => {
        const rank = statusSortRank(a.script_status) - statusSortRank(b.script_status);
        if (rank !== 0) return rank;
        const seqA = metaByVideoId.get(a.id)?.sequence_number ?? 0;
        const seqB = metaByVideoId.get(b.id)?.sequence_number ?? 0;
        return seqA - seqB;
      });
      out.push({ key: bunchId, title, modelName, progress, videos: sorted });
    }
    out.sort((a, b) => {
      const aNeeds = a.videos.some(
        (v) => v.script_status === "Needs Script" || v.script_status === "Rejected",
      );
      const bNeeds = b.videos.some(
        (v) => v.script_status === "Needs Script" || v.script_status === "Rejected",
      );
      if (aNeeds !== bNeeds) return aNeeds ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
    if (other.length > 0) {
      out.push({
        key: "__other__",
        title: "Other scripts",
        modelName: "",
        videos: [...other].sort(
          (a, b) => statusSortRank(a.script_status) - statusSortRank(b.script_status),
        ),
      });
    }
    return out;
  }, [queue, progressByBunchId, metaByVideoId]);

  const didAutoExpand = React.useRef(false);
  React.useEffect(() => {
    if (didAutoExpand.current || groups.length === 0) return;
    const firstActionable = groups.find((g) =>
      g.videos.some(
        (v) => v.script_status === "Needs Script" || v.script_status === "Rejected",
      ),
    );
    setExpandedBunch(firstActionable?.key ?? groups[0]?.key ?? null);
    didAutoExpand.current = true;
  }, [groups]);

  const modelOptions = React.useMemo<CustomSelectOption[]>(() => {
    const base = gunzoModels.map((m) => ({ value: m.id, label: m.model_name }));
    const active = activeId ? queue.find((v) => v.id === activeId) : null;
    const assigned = active?.assigned_creator_name?.trim();
    if (assigned && !base.some((o) => o.label === assigned)) {
      return [{ value: `custom:${assigned}`, label: assigned }, ...base];
    }
    return [{ value: "", label: "Select Gunzo-team model…" }, ...base];
  }, [gunzoModels, activeId, queue]);

  const needsCount = queue.filter(
    (v) => v.script_status === "Needs Script" || v.script_status === "Rejected",
  ).length;
  const pendingCount = queue.filter((v) => v.script_status === "Pending Review").length;
  const approvedCount = queue.filter((v) => v.script_status === "Approved").length;

  async function reload() {
    setLoading(true);
    try {
      const [queueRes, mineRes] = await Promise.all([
        fetch("/api/creative-scripts/queue", { credentials: "include" }),
        fetch("/api/creative-scripts/mine", { credentials: "include" }),
      ]);
      const queueData = (await queueRes.json()) as {
        videos?: WinnerVideoRecord[];
        bunchProgress?: BunchScriptProgress[];
        slotMeta?: SlotScriptMeta[];
      };
      const mineData = (await mineRes.json()) as {
        videos?: WinnerVideoRecord[];
        slotMeta?: SlotScriptMeta[];
      };
      if (queueRes.ok) {
        setQueue(queueData.videos ?? []);
        setBunchProgress(queueData.bunchProgress ?? []);
        setSlotMeta((prev) => {
          const fromQueue = queueData.slotMeta ?? [];
          if (fromQueue.length > 0) return fromQueue;
          return prev;
        });
      }
      if (mineRes.ok) {
        setHistory(mineData.videos ?? []);
        if (mineData.slotMeta?.length) {
          setSlotMeta((prev) => {
            const map = new Map(prev.map((m) => [m.winner_video_id, m]));
            for (const m of mineData.slotMeta!) map.set(m.winner_video_id, m);
            return [...map.values()];
          });
        }
      }
    } finally {
      setLoading(false);
    }
  }

  const reloadRef = React.useRef(reload);
  reloadRef.current = reload;

  React.useEffect(() => {
    if (isSupabaseBackend) return;
    const id = window.setInterval(() => {
      void reloadRef.current();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [isSupabaseBackend]);

  useSupabaseRealtimeRefresh(["winner_videos"], () => void reloadRef.current(), { debounceMs: 600 });

  function openForm(video: WinnerVideoRecord) {
    const isRejected = video.script_status === "Rejected";
    const isNeeds = video.script_status === "Needs Script";
    if (!isRejected && !isNeeds) return;

    if (activeId === video.id) {
      setActiveId(null);
      return;
    }
    setActiveId(video.id);
    setModelId(resolveModelId(video, gunzoModels));
    if (isRejected) {
      setScriptText(video.script_text || "");
    } else {
      setScriptText("");
    }
    setTextOnScreen(video.text_on_screen_suggestion ?? "");
    setTextOnScreenOpen(Boolean(video.text_on_screen_suggestion?.trim()));
    setScriptBrief(video.script_brief ?? "");
    const hasBriefFile = Boolean(video.script_brief_attachment_url?.trim());
    setScriptBriefOpen(
      Boolean(video.script_brief?.trim()) || hasBriefFile || isRejected,
    );
    setBriefAttachmentToken(undefined);
    setBriefAttachmentDisplay(
      hasBriefFile
        ? {
            url: video.script_brief_attachment_url,
            filename: video.script_brief_attachment_filename || "Brief attachment",
          }
        : null,
    );
    setBriefUploadError(null);
    setBrainstormText(null);
    if (briefFileRef.current) briefFileRef.current.value = "";
  }

  async function handleBrainstorm(video: WinnerVideoRecord) {
    setBrainstormLoading(true);
    setBrainstormText(null);
    try {
      const typeLabel =
        video.script_video_type?.trim() || video.content_type?.trim() || "";
      const res = await fetch("/api/creative-scripts/ai-brainstorm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftScript: scriptText,
          brief: scriptBrief,
          caption: video.note || video.admin_instructions || "",
          videoType: typeLabel,
          modelName: video.assigned_creator_name || video.reference_model_name || "",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        suggestions?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Brainstorm failed");
      setBrainstormText(data.suggestions ?? "");
    } catch (e) {
      addToast(
        winnerVideoLocalToast(
          `brainstorm-${Date.now()}`,
          "AI suggestions failed",
          e instanceof Error ? e.message : "Try again",
          "high",
        ),
      );
    } finally {
      setBrainstormLoading(false);
    }
  }

  async function handleBriefFile(videoId: string, file: File | null) {
    setBriefUploadError(null);
    if (!file) return;
    setBriefUploading(true);
    try {
      const { sbUrl, filename } = await uploadFileToSupabaseStorage(
        file,
        "creative-script-brief",
        { itemId: videoId },
      );
      setBriefAttachmentToken(sbUrl);
      setBriefAttachmentDisplay({
        url: URL.createObjectURL(file),
        filename: filename || file.name,
      });
    } catch (err) {
      setBriefUploadError(err instanceof Error ? err.message : "Upload failed");
      setBriefAttachmentToken(undefined);
    } finally {
      setBriefUploading(false);
    }
  }

  function clearBriefAttachment() {
    setBriefAttachmentToken("");
    setBriefAttachmentDisplay(null);
    setBriefUploadError(null);
    if (briefFileRef.current) briefFileRef.current.value = "";
  }

  async function handleSubmit(video: WinnerVideoRecord) {
    const modelName = modelNameFromSelection(modelId, gunzoModels).trim();
    if (!modelName || (!scriptText.trim() && !textOnScreen.trim())) {
      addToast(
        winnerVideoLocalToast(
          `cs-val-${Date.now()}`,
          "Missing fields",
          "Model plus script and/or text-on-screen required.",
          "high",
        ),
      );
      return;
    }
    if (briefUploading) {
      addToast(
        winnerVideoLocalToast(
          `cs-up-${Date.now()}`,
          "Upload in progress",
          "Wait for the brief file to finish uploading.",
          "high",
        ),
      );
      return;
    }

    const isResubmit = video.script_status === "Rejected";
    setSavingId(video.id);
    try {
      const body: Record<string, unknown> = {
        id: video.id,
        assigned_creator_name: modelName,
        script_text: scriptText,
        text_on_screen_suggestion: textOnScreen,
        script_brief: scriptBrief,
      };
      if (briefAttachmentToken !== undefined) {
        body.script_brief_attachment_url = briefAttachmentToken;
      }
      const res = await fetch(
        isResubmit
          ? `/api/creative-scripts/${encodeURIComponent(video.id)}`
          : "/api/creative-scripts",
        {
          method: isResubmit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        addToast(
          winnerVideoLocalToast(
            `cs-err-${Date.now()}`,
            isResubmit ? "Resubmit failed" : "Submit failed",
            data.error ?? "Could not save script",
            "high",
          ),
        );
        return;
      }
      addToast(
        winnerVideoLocalToast(
          `cs-ok-${Date.now()}`,
          isResubmit ? "Script resubmitted" : "Script submitted",
          isResubmit ? "Sent back for review." : "Sent for review.",
          "normal",
        ),
      );
      setActiveId(null);
      await reload();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-[#D4AF8C]/15 bg-gradient-to-br from-[#151315] via-[#0D0B0D] to-[#120810] px-6 py-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#FF1493]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-[#D4AF8C]/8 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D4AF8C]/70">
              Creative
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Scripts to Write
            </h1>
            <p className="mt-2 max-w-xl text-sm text-[#B8B4B8]/70">
              Bunches assigned to you — write each slot, revise rejected scripts, and track progress
              in one place.
            </p>
          </div>
          <div className="flex rounded-xl border border-white/10 bg-black/30 p-1">
            <button
              type="button"
              onClick={() => setTab("write")}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition duration-200 motion-reduce:transition-none",
                tab === "write"
                  ? "bg-[#FF1493]/20 text-[#FF1493]"
                  : "text-white/45 hover:text-white/80",
              )}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setTab("history")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition duration-200 motion-reduce:transition-none",
                tab === "history"
                  ? "bg-[#FF1493]/20 text-[#FF1493]"
                  : "text-white/45 hover:text-white/80",
              )}
            >
              <History className="h-3.5 w-3.5" aria-hidden />
              History
            </button>
          </div>
        </div>
        {tab === "write" ? (
          <div className="relative mt-5 flex flex-wrap items-center gap-2">
            <span className={cn(VA_STATUS_BADGE, "bg-amber-500/15 text-amber-200")}>
              {needsCount} to write
            </span>
            <span className={cn(VA_STATUS_BADGE, "bg-sky-500/15 text-sky-200")}>
              {pendingCount} submitted
            </span>
            <span className={cn(VA_STATUS_BADGE, "bg-emerald-500/15 text-emerald-300")}>
              {approvedCount} approved
            </span>
            <button
              type="button"
              className={cn(VA_BTN_SECONDARY, "ml-auto !px-4 !py-2 text-xs")}
              onClick={() => void reload()}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
            </button>
          </div>
        ) : null}
      </div>

      {tab === "history" ? (
        <CreativeScriptsHistory scripts={history} slotMeta={slotMeta} />
      ) : loading && queue.length === 0 ? (
        <div className={cn(VA_CARD, "flex items-center justify-center gap-3 px-6 py-16")}>
          <Loader2 className="h-5 w-5 animate-spin text-[#D4AF8C]/70" />
          <p className="text-sm text-[#B8B4B8]/55">Loading assignments…</p>
        </div>
      ) : groups.length === 0 ? (
        <div className={cn(VA_CARD, "flex flex-col items-center gap-3 px-6 py-16 text-center")}>
          <FileText className="h-10 w-10 text-[#D4AF8C]/40" />
          <p className="text-base font-medium text-white/90">No bunches assigned yet</p>
          <p className="max-w-sm text-sm text-[#B8B4B8]/55">
            When a manager assigns you a bunch (or an approved research find), scripts appear here
            grouped by bunch.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const open = expandedBunch === group.key;
            const written = group.progress?.written ?? group.videos.filter((v) => v.script_status !== "Needs Script").length;
            const total = group.progress?.total ?? group.videos.length;
            const pct = total > 0 ? Math.round((written / total) * 100) : 0;
            const rejectedInGroup = group.videos.filter((v) => v.script_status === "Rejected").length;

            return (
              <motion.div
                key={group.key}
                layout={!reduceMotion}
                className={cn(VA_CARD, VA_CARD_GLOW, "overflow-hidden")}
              >
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left transition hover:bg-white/[0.02] motion-reduce:transition-none"
                  onClick={() => setExpandedBunch(open ? null : group.key)}
                  aria-expanded={open}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-semibold text-white">{group.title}</h2>
                      {rejectedInGroup > 0 ? (
                        <span className={cn(VA_STATUS_BADGE, "border-red-500/35 bg-red-500/12 text-red-200")}>
                          {rejectedInGroup} rejected
                        </span>
                      ) : null}
                    </div>
                    {group.modelName ? (
                      <p className="mt-1 text-sm text-[#D4AF8C]/85">{group.modelName}</p>
                    ) : null}
                    <p className="mt-1.5 text-xs tabular-nums text-[#B8B4B8]/55">
                      {written} of {total} scripts written
                    </p>
                    <div className="mt-2 h-1.5 w-44 max-w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#FF1493] to-[#D4AF8C] transition-all duration-500 motion-reduce:transition-none"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <ChevronDown
                    className={cn(
                      "mt-1 h-5 w-5 shrink-0 text-[#D4AF8C]/70 transition-transform duration-200 motion-reduce:transition-none",
                      open && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>

                <AnimatePresence initial={false}>
                  {open ? (
                    <motion.div
                      key="slots"
                      initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden border-t border-white/[0.06]"
                    >
                      <div className="space-y-3 px-4 py-4 sm:px-5">
                        {group.videos.map((v) => {
                          const meta = metaByVideoId.get(v.id);
                          const typeLabel =
                            slotVideoTypeLabel(meta?.video_type, meta?.video_type_other) ||
                            meta?.video_type?.trim() ||
                            v.script_video_type?.trim() ||
                            v.content_type?.trim() ||
                            "";
                          const description =
                            meta?.description?.trim() ||
                            (v.note?.trim() ? truncateNote(v.note, 200) || v.note : "");
                          const videoLink = meta?.video_link?.trim() || v.video_link?.trim() || "";
                          const isRejected = v.script_status === "Rejected";
                          const isNeeds = v.script_status === "Needs Script";
                          const canWrite = isNeeds || isRejected;
                          const formOpen = activeId === v.id;
                          const rejection = v.script_rejection_reason?.trim() || "";

                          return (
                            <article
                              key={v.id}
                              className={cn(
                                "rounded-2xl border bg-[#0D0B0D]/55 px-4 py-4 transition duration-200 motion-reduce:transition-none",
                                isRejected
                                  ? "border-red-500/30 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.08)]"
                                  : isNeeds
                                    ? "border-[#D4AF8C]/20 hover:border-[#D4AF8C]/35"
                                    : "border-white/[0.06]",
                                savingId === v.id && "opacity-80",
                              )}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <ScriptStatusBadge status={v.script_status} />
                                    {typeLabel ? (
                                      <span
                                        className={cn(
                                          VA_STATUS_BADGE,
                                          "border-[#D4AF8C]/30 bg-[#D4AF8C]/10 text-[#D4AF8C]",
                                        )}
                                      >
                                        {typeLabel}
                                      </span>
                                    ) : null}
                                    {meta && meta.recreate_total > 1 ? (
                                      <span className="text-xs font-medium text-[#D4AF8C]/80">
                                        Recreate {meta.recreate_index} of {meta.recreate_total}
                                      </span>
                                    ) : meta ? (
                                      <span className="text-xs text-[#B8B4B8]/45">
                                        Slot #{meta.sequence_number}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                                {canWrite ? (
                                  <button
                                    type="button"
                                    className={cn(
                                      formOpen ? VA_BTN_SECONDARY : VA_BTN_PRIMARY,
                                      "!px-4 !py-2 text-xs inline-flex items-center gap-1.5",
                                    )}
                                    onClick={() => openForm(v)}
                                    disabled={savingId === v.id}
                                  >
                                    <PenLine className="h-3.5 w-3.5" aria-hidden />
                                    {formOpen
                                      ? "Close"
                                      : isRejected
                                        ? "Revise & resubmit"
                                        : "Write script"}
                                  </button>
                                ) : null}
                              </div>

                              {videoLink ? (
                                <a
                                  href={videoLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-3 inline-flex items-center gap-1 text-sm text-[#FF1493] transition hover:underline motion-reduce:transition-none"
                                >
                                  Reference video{" "}
                                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                                </a>
                              ) : null}

                              {description ? (
                                <p className="mt-2 text-sm leading-relaxed text-[#B8B4B8]/70">
                                  {description}
                                </p>
                              ) : null}
                              {v.admin_instructions?.trim() ? (
                                <div className="mt-2 rounded-lg border border-[#D4AF8C]/20 bg-[#D4AF8C]/[0.06] px-3 py-2">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#D4AF8C]/80">Admin guidance</p>
                                  <p className="mt-1 whitespace-pre-wrap text-xs text-[#D4AF8C]/90">{v.admin_instructions}</p>
                                </div>
                              ) : null}

                              {isRejected && rejection ? (
                                <div className="mt-3 flex gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3">
                                  <AlertCircle
                                    className="mt-0.5 h-4 w-4 shrink-0 text-red-300"
                                    aria-hidden
                                  />
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-red-200/90">
                                      Rejection reason
                                    </p>
                                    <p className="mt-1 text-sm leading-relaxed text-red-100/90">
                                      {rejection}
                                    </p>
                                  </div>
                                </div>
                              ) : null}

                              <AnimatePresence initial={false}>
                                {formOpen ? (
                                  <motion.div
                                    key="form"
                                    initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                                    className="overflow-hidden"
                                  >
                                    <div className="mt-4 space-y-4 rounded-2xl border border-white/[0.06] bg-black/25 p-4 shadow-[inset_0_2px_8px_rgba(0,0,0,0.25)]">
                                      <div>
                                        <p className="text-sm font-semibold text-white">
                                          {isRejected ? "Revise script" : "Write script"}
                                        </p>
                                        <p className="mt-0.5 text-xs text-[#B8B4B8]/50">
                                          Assign the Gunzo model and paste the full script. Video type
                                          is set by research — brief and text-on-screen help the filmer.
                                        </p>
                                      </div>

                                      <div>
                                        <ReviewFieldLabel>Model</ReviewFieldLabel>
                                        <ManagerReviewSelect
                                          value={modelId}
                                          onChange={setModelId}
                                          options={modelOptions}
                                          placeholder="Select Gunzo-team model…"
                                          required
                                        />
                                      </div>
                                      {typeLabel ? (
                                        <div>
                                          <ReviewFieldLabel>Type</ReviewFieldLabel>
                                          <span
                                            className={cn(
                                              VA_STATUS_BADGE,
                                              "mt-1 border-[#D4AF8C]/30 bg-[#D4AF8C]/10 text-[#D4AF8C]",
                                            )}
                                          >
                                            {typeLabel}
                                          </span>
                                        </div>
                                      ) : (
                                        <p className="text-xs text-amber-200/80">
                                          Video type is missing. Ask a researcher or admin to set it
                                          before submitting.
                                        </p>
                                      )}
                                      <div>
                                        <ReviewFieldLabel>Script</ReviewFieldLabel>
                                        <ManagerReviewTextarea
                                          value={scriptText}
                                          onChange={(e) => setScriptText(e.target.value)}
                                          rows={10}
                                          placeholder="Write the full script here (or Text on Screen)…"
                                        />
                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                          <button
                                            type="button"
                                            className={cn(VA_BTN_SECONDARY, "text-xs")}
                                            disabled={brainstormLoading}
                                            onClick={() => void handleBrainstorm(v)}
                                          >
                                            {brainstormLoading ? (
                                              <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />
                                            ) : null}
                                            Get AI suggestions
                                          </button>
                                        </div>
                                        {brainstormText ? (
                                          <div className="mt-2 rounded-xl border border-[#D4AF8C]/20 bg-[#D4AF8C]/[0.06] px-3 py-2.5 text-xs leading-relaxed text-white/75 whitespace-pre-wrap">
                                            {brainstormText}
                                          </div>
                                        ) : null}
                                      </div>

                                      <div className="overflow-hidden rounded-xl border border-[#D4AF8C]/15 bg-[#D4AF8C]/[0.04]">
                                        <button
                                          type="button"
                                          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                                          onClick={() => setTextOnScreenOpen((o) => !o)}
                                          aria-expanded={textOnScreenOpen}
                                        >
                                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/75">
                                            Text on Screen Suggestion
                                            <StatInfoTooltip text={TOS_TIP} />
                                            <span className="ml-0.5 font-normal normal-case tracking-normal text-[#B8B4B8]/45">
                                              (optional)
                                            </span>
                                          </span>
                                          <ChevronDown
                                            className={cn(
                                              "h-4 w-4 text-[#D4AF8C]/70 transition-transform duration-200 motion-reduce:transition-none",
                                              textOnScreenOpen && "rotate-180",
                                            )}
                                            aria-hidden
                                          />
                                        </button>
                                        {textOnScreenOpen ? (
                                          <div className="border-t border-[#D4AF8C]/10 px-3 pb-3 pt-2">
                                            <ManagerReviewTextarea
                                              value={textOnScreen}
                                              onChange={(e) => setTextOnScreen(e.target.value)}
                                              rows={4}
                                              placeholder="e.g. captions, titles, callouts…"
                                            />
                                          </div>
                                        ) : null}
                                      </div>

                                      <div className="overflow-hidden rounded-xl border border-[#D4AF8C]/15 bg-[#D4AF8C]/[0.04]">
                                        <button
                                          type="button"
                                          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                                          onClick={() => setScriptBriefOpen((o) => !o)}
                                          aria-expanded={scriptBriefOpen}
                                        >
                                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/75">
                                            Brief
                                            <StatInfoTooltip text={BRIEF_TIP} />
                                            <span className="ml-0.5 font-normal normal-case tracking-normal text-[#B8B4B8]/45">
                                              (optional)
                                            </span>
                                          </span>
                                          <ChevronDown
                                            className={cn(
                                              "h-4 w-4 text-[#D4AF8C]/70 transition-transform duration-200 motion-reduce:transition-none",
                                              scriptBriefOpen && "rotate-180",
                                            )}
                                            aria-hidden
                                          />
                                        </button>
                                        {scriptBriefOpen ? (
                                          <div className="border-t border-[#D4AF8C]/10 px-3 pb-3 pt-2 space-y-3">
                                            <p className="inline-flex items-start gap-1.5 text-xs text-[#B8B4B8]/50">
                                              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                                              Visible to the filmer on Shoot Assignments. PDF or image
                                              optional.
                                            </p>
                                            <ManagerReviewTextarea
                                              value={scriptBrief}
                                              onChange={(e) => setScriptBrief(e.target.value)}
                                              rows={4}
                                              placeholder="e.g. handheld selfie angle, soft lighting, playful energy…"
                                            />
                                            <div className="space-y-2">
                                              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#D4AF8C]/65">
                                                Brief file
                                              </p>
                                              {briefAttachmentDisplay ? (
                                                <div className="flex flex-wrap items-center gap-2">
                                                  <AttachmentLinks
                                                    attachments={[
                                                      {
                                                        url: briefAttachmentDisplay.url,
                                                        filename: briefAttachmentDisplay.filename,
                                                      },
                                                    ]}
                                                  />
                                                  <button
                                                    type="button"
                                                    className={cn(
                                                      VA_BTN_SECONDARY,
                                                      "!px-2.5 !py-1.5 text-xs inline-flex items-center gap-1",
                                                    )}
                                                    onClick={clearBriefAttachment}
                                                    disabled={briefUploading || savingId === v.id}
                                                  >
                                                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                                    Remove
                                                  </button>
                                                </div>
                                              ) : (
                                                <label
                                                  className={cn(
                                                    VA_BTN_SECONDARY,
                                                    "!px-3 !py-2 text-xs inline-flex items-center gap-1.5 cursor-pointer",
                                                    (briefUploading || savingId === v.id) &&
                                                      "pointer-events-none opacity-60",
                                                  )}
                                                >
                                                  {briefUploading ? (
                                                    <Loader2
                                                      className="h-3.5 w-3.5 animate-spin"
                                                      aria-hidden
                                                    />
                                                  ) : (
                                                    <Upload className="h-3.5 w-3.5" aria-hidden />
                                                  )}
                                                  {briefUploading ? "Uploading…" : "Upload PDF or image"}
                                                  <input
                                                    ref={briefFileRef}
                                                    type="file"
                                                    accept="image/*,.pdf,application/pdf"
                                                    className="sr-only"
                                                    disabled={briefUploading || savingId === v.id}
                                                    onChange={(e) => {
                                                      const f = e.target.files?.[0] ?? null;
                                                      void handleBriefFile(v.id, f);
                                                    }}
                                                  />
                                                </label>
                                              )}
                                              {briefUploadError ? (
                                                <p className="text-xs text-red-300">{briefUploadError}</p>
                                              ) : null}
                                              {!briefAttachmentDisplay ? (
                                                <p className="inline-flex items-center gap-1 text-[11px] text-[#B8B4B8]/40">
                                                  <Paperclip className="h-3 w-3" aria-hidden />
                                                  Max 10MB · PDF, PNG, JPG, WebP…
                                                </p>
                                              ) : null}
                                            </div>
                                          </div>
                                        ) : null}
                                      </div>

                                      <div className="flex flex-wrap justify-end gap-2">
                                        <button
                                          type="button"
                                          className={cn(VA_BTN_SECONDARY, "!px-4 !py-2 text-xs")}
                                          onClick={() => setActiveId(null)}
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          className={cn(
                                            VA_BTN_PRIMARY,
                                            "!px-4 !py-2 text-xs inline-flex items-center gap-2",
                                          )}
                                          disabled={savingId === v.id}
                                          onClick={() => void handleSubmit(v)}
                                        >
                                          {savingId === v.id ? (
                                            <>
                                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                              {isRejected ? "Resubmitting…" : "Submitting…"}
                                            </>
                                          ) : isRejected ? (
                                            "Resubmit for review"
                                          ) : (
                                            "Submit script"
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  </motion.div>
                                ) : null}
                              </AnimatePresence>

                              {!formOpen &&
                              !canWrite &&
                              v.script_text?.trim() ? (
                                <p className="mt-3 line-clamp-2 text-xs text-[#B8B4B8]/40">
                                  {displayOrDash(v.script_text)}
                                </p>
                              ) : null}
                            </article>
                          );
                        })}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
