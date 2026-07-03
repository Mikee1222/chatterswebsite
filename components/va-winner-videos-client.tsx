"use client";

import * as React from "react";
import { ExternalLink, Loader2, Trophy } from "lucide-react";
import {
  AttachmentLinks,
  FindingCard,
  ManagerReviewFileDropzone,
  ManagerReviewSelect,
  ManagerReviewTextarea,
  ReviewEmptyState,
  ReviewFieldLabel,
  ReviewFormSection,
  ReviewLoadingState,
  ReviewPageEyebrow,
  ReviewSectionHeader,
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_FILTER_INPUT,
  WinnerVideoStatusBadge,
  displayOrDash,
  type CustomSelectOption,
} from "@/components/manager-review-ui";
import {
  WinnerVideoCopyButton,
  WinnerVideoContentTypeBadge,
  WinnerVideoFilters,
  WinnerVideoKanbanBoard,
  WinnerVideoRefreshButton,
  WinnerVideoSubmissionsToolbar,
  useWinnerVideoCopy,
  winnerVideoLocalToast,
} from "@/components/winner-videos-shared";
import { useToast } from "@/contexts/toast-context";
import { formatDateTimeAthens } from "@/lib/format";
import { filterWinnerVideosClient, type WinnerVideoDateRange, type WinnerVideoViewMode } from "@/lib/winner-videos-filters";
import { WINNER_VIDEO_CONTENT_TYPES, type WinnerVideoContentType } from "@/lib/winner-videos-helpers";
import type { WinnerVideoRecord } from "@/services/winner-videos";
import type { ModelRecord } from "@/types";

type Props = {
  initialSubmissions: WinnerVideoRecord[];
  gunzoModels: ModelRecord[];
};

export function VaWinnerVideosClient({ initialSubmissions, gunzoModels }: Props) {
  const { addToast } = useToast();
  const copySubmission = useWinnerVideoCopy(addToast);
  const [submissions, setSubmissions] = React.useState(initialSubmissions);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<WinnerVideoViewMode>("list");
  const [filterDateRange, setFilterDateRange] = React.useState<WinnerVideoDateRange>("all");
  const [filterDateFrom, setFilterDateFrom] = React.useState("");
  const [filterDateTo, setFilterDateTo] = React.useState("");

  const [referenceModelId, setReferenceModelId] = React.useState("");
  const [contentType, setContentType] = React.useState<WinnerVideoContentType | "">("");
  const [videoLink, setVideoLink] = React.useState("");
  const [note, setNote] = React.useState("");
  const [views, setViews] = React.useState("");
  const [screenshotFiles, setScreenshotFiles] = React.useState<File[]>([]);

  React.useEffect(() => setSubmissions(initialSubmissions), [initialSubmissions]);

  const filteredSubmissions = React.useMemo(
    () =>
      filterWinnerVideosClient(submissions, {
        dateRange: filterDateRange,
        dateFrom: filterDateFrom,
        dateTo: filterDateTo,
      }),
    [submissions, filterDateRange, filterDateFrom, filterDateTo],
  );

  const modelOptions = React.useMemo<CustomSelectOption[]>(
    () => [
      { value: "", label: "Select Gunzo-team model…" },
      ...gunzoModels.map((m) => ({ value: m.id, label: m.model_name })),
    ],
    [gunzoModels],
  );

  const contentTypeOptions = React.useMemo<CustomSelectOption[]>(
    () => [
      { value: "", label: "Select content type…" },
      ...WINNER_VIDEO_CONTENT_TYPES.map((type) => ({ value: type, label: type })),
    ],
    [],
  );

  const selectedModelName = React.useMemo(
    () => gunzoModels.find((m) => m.id === referenceModelId)?.model_name ?? "",
    [gunzoModels, referenceModelId],
  );

  async function reload() {
    setLoading(true);
    try {
      const res = await fetch("/api/winner-videos", { credentials: "include" });
      const data = (await res.json()) as { videos?: WinnerVideoRecord[] };
      if (res.ok) setSubmissions(data.videos ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!referenceModelId || !selectedModelName.trim()) {
      addToast(winnerVideoLocalToast(`wv-val-${Date.now()}`, "Missing fields", "Reference model is required.", "high"));
      return;
    }
    if (!contentType) {
      addToast(winnerVideoLocalToast(`wv-val-${Date.now()}`, "Missing fields", "Content type is required.", "high"));
      return;
    }
    if (!videoLink.trim()) {
      addToast(winnerVideoLocalToast(`wv-val-${Date.now()}`, "Missing link", "A video link is required.", "high"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/winner-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          reference_model_id: referenceModelId,
          reference_model_name: selectedModelName.trim(),
          content_type: contentType,
          video_link: videoLink.trim(),
          note: note.trim(),
          views_at_submission: views.trim() ? Number(views) : null,
        }),
      });
      const data = (await res.json()) as { video?: WinnerVideoRecord; error?: string };
      if (!res.ok || !data.video) {
        addToast(winnerVideoLocalToast(`wv-err-${Date.now()}`, "Submit failed", data.error ?? "Could not submit", "high"));
        return;
      }
      if (screenshotFiles.length > 0) {
        const fd = new FormData();
        for (const f of screenshotFiles) fd.append("screenshot", f);
        await fetch(`/api/winner-videos/${encodeURIComponent(data.video.id)}/screenshot`, {
          method: "POST",
          body: fd,
          credentials: "include",
        });
      }
      setReferenceModelId("");
      setContentType("");
      setVideoLink("");
      setNote("");
      setViews("");
      setScreenshotFiles([]);
      await reload();
      addToast(winnerVideoLocalToast(`wv-ok-${Date.now()}`, "Submitted", "Your research find was logged for review.", "normal"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <ReviewPageEyebrow>Content</ReviewPageEyebrow>
        <h1 className="mt-1 text-2xl font-bold text-white">Research</h1>
        <p className="mt-1 text-sm text-[#B8B4B8]/60">
          Submit winning reference videos for recreation tracking. Analytics dashboards for step-type completion are a
          future task.
        </p>
      </div>

      <ReviewFormSection title="Submit research find" description="Share the reference video link. Optional note and screenshot help reviewers.">
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <ReviewFieldLabel>Reference model</ReviewFieldLabel>
            <ManagerReviewSelect
              value={referenceModelId}
              onChange={setReferenceModelId}
              options={modelOptions}
              placeholder="Select Gunzo-team model…"
              required
            />
          </div>
          <div>
            <ReviewFieldLabel>Content type</ReviewFieldLabel>
            <ManagerReviewSelect
              value={contentType}
              onChange={(v) => setContentType(v as WinnerVideoContentType | "")}
              options={contentTypeOptions}
              placeholder="Select content type…"
              required
            />
          </div>
          <div>
            <ReviewFieldLabel>Video link</ReviewFieldLabel>
            <input
              value={videoLink}
              onChange={(e) => setVideoLink(e.target.value)}
              className={VA_FILTER_INPUT}
              placeholder="https://…"
              type="url"
              required
            />
          </div>
          <div>
            <ReviewFieldLabel>Note</ReviewFieldLabel>
            <ManagerReviewTextarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Context for reviewers…"
              rows={3}
            />
          </div>
          <div>
            <ReviewFieldLabel>Views at submission (optional)</ReviewFieldLabel>
            <input
              value={views}
              onChange={(e) => setViews(e.target.value.replace(/[^\d]/g, ""))}
              className={VA_FILTER_INPUT}
              inputMode="numeric"
              placeholder="e.g. 120000"
            />
          </div>
          <div>
            <ReviewFieldLabel>Screenshot (optional)</ReviewFieldLabel>
            <ManagerReviewFileDropzone
              files={screenshotFiles}
              onChange={setScreenshotFiles}
              accept="image/*"
              multiple={false}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className={VA_BTN_SECONDARY}
              onClick={() => {
                setReferenceModelId("");
                setContentType("");
                setVideoLink("");
                setNote("");
                setViews("");
                setScreenshotFiles([]);
              }}
            >
              Clear
            </button>
            <button type="submit" disabled={saving} className={VA_BTN_PRIMARY}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Submit find
            </button>
          </div>
        </form>
      </ReviewFormSection>

      <WinnerVideoFilters
        filterDateRange={filterDateRange}
        onFilterDateRangeChange={setFilterDateRange}
        filterDateFrom={filterDateFrom}
        onFilterDateFromChange={setFilterDateFrom}
        filterDateTo={filterDateTo}
        onFilterDateToChange={setFilterDateTo}
      />

      <section className="space-y-3">
        <ReviewSectionHeader
          action={
            filteredSubmissions.length > 0 ? (
              <WinnerVideoSubmissionsToolbar
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                videos={filteredSubmissions}
                addToast={addToast}
              />
            ) : null
          }
        >
          My submissions
        </ReviewSectionHeader>
        {loading ? (
          <ReviewLoadingState />
        ) : filteredSubmissions.length === 0 ? (
          <ReviewEmptyState
            icon={Trophy}
            title={submissions.length === 0 ? "No submissions yet" : "No matching submissions"}
            description={
              submissions.length === 0
                ? "Your research submissions will appear here with review status."
                : "Try adjusting your date filters."
            }
          />
        ) : viewMode === "board" ? (
          <WinnerVideoKanbanBoard
            videos={filteredSubmissions}
            onCopy={copySubmission}
            addToast={addToast}
            onRefresh={() => void reload()}
            refreshing={loading}
          />
        ) : (
          filteredSubmissions.map((v) => (
            <FindingCard key={v.id}>
              <div className="flex flex-wrap items-center gap-2">
                <WinnerVideoStatusBadge status={v.status} />
                {v.content_type ? <WinnerVideoContentTypeBadge contentType={v.content_type} /> : null}
                <span className="text-xs text-[#B8B4B8]/45">
                  {v.submitted_at ? formatDateTimeAthens(v.submitted_at) : "—"}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <WinnerVideoRefreshButton onClick={() => void reload()} refreshing={loading} />
                  <WinnerVideoCopyButton onClick={() => void copySubmission(v)} />
                </div>
              </div>
              <p className="mt-2 font-semibold text-white">{displayOrDash(v.reference_model_name)}</p>
              {v.video_link ? (
                <a
                  href={v.video_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-sm text-[#FF1493] hover:underline"
                >
                  Open video <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              ) : null}
              {v.note?.trim() ? <p className="mt-2 text-sm text-[#B8B4B8]/70">{v.note}</p> : null}
              {v.views_at_submission != null ? (
                <p className="mt-1 text-xs text-[#B8B4B8]/50">Views at submission: {v.views_at_submission.toLocaleString()}</p>
              ) : null}
              {v.status === "Rejected" && v.rejection_reason?.trim() ? (
                <p className="mt-3 rounded-lg border border-red-500/25 bg-red-500/8 px-3 py-2 text-sm text-red-200">
                  {v.rejection_reason}
                </p>
              ) : null}
              {v.status === "Approved" && v.assigned_creator_name ? (
                <p className="mt-2 text-xs text-[#D4AF8C]/80">
                  Assigned to {v.assigned_creator_name}
                  {v.recreation_deadline ? ` · deadline ${v.recreation_deadline}` : ""}
                </p>
              ) : null}
              {v.screenshot.length > 0 ? (
                <div className="mt-3">
                  <AttachmentLinks attachments={v.screenshot} />
                </div>
              ) : null}
            </FindingCard>
          ))
        )}
      </section>
    </div>
  );
}
