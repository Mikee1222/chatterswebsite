"use client";

/**
 * "Draft briefs" panel under a Winner Breakdown.
 * The CD decides: creator, Editable vs Creation, flow. The AI writes the briefs
 * into the existing modules in status DRAFT. The CD edits + publishes there.
 */

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Clapperboard,
  FileText,
  Loader2,
  Scissors,
  Send,
  Wand2,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";
import type { BriefDraftSet, DraftContentType, DraftFlow } from "@/lib/brief-drafts-schema";
import { VA_BTN_PRIMARY, VA_BTN_SECONDARY, VA_FILTER_INPUT } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";

type ModelOpt = { id: string; model_name: string };

type Props = {
  breakdownId: string | null;
  models: ModelOpt[];
  defaultModelId: string;
  perms: { editing: boolean; recording: boolean; posting: boolean };
};

function flowLabel(f: DraftFlow): string {
  return f === "batch" ? "Batch" : f === "urgent" ? "Urgent" : "Trend";
}

function DraftSetCard({ set, models }: { set: BriefDraftSet; models: ModelOpt[] }) {
  const name = set.model_name || models.find((m) => m.id === set.model_id)?.model_name || set.model_id;
  const links: Array<{ href: string; label: string; icon: React.ReactNode }> = [];
  if (set.recording_brief_id) {
    links.push({
      href: ROUTES.recordingBriefEdit(set.recording_brief_id),
      label: "Recording brief",
      icon: <Clapperboard className="h-3.5 w-3.5" />,
    });
  }
  if (set.editing_brief_id) {
    links.push({
      href: ROUTES.editingBriefEdit(set.editing_brief_id),
      label: "Editing brief",
      icon: <Scissors className="h-3.5 w-3.5" />,
    });
  }
  if (set.posting_brief_id) {
    links.push({
      href: ROUTES.postingBriefEdit(set.posting_brief_id),
      label: "Posting brief",
      icon: <Send className="h-3.5 w-3.5" />,
    });
  }
  return (
    <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/[0.05] p-3">
      <p className="text-sm text-white/85">
        <span className="font-medium text-white">{name}</span>
        <span className="text-white/45">
          {" "}· {set.content_type === "editable" ? "Editable" : "Creation"} · {flowLabel(set.flow)} ·{" "}
          {new Date(set.created_at).toLocaleString()}
        </span>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={cn(VA_BTN_SECONDARY, "inline-flex min-h-9 items-center gap-1.5 px-3 text-xs")}
          >
            {l.icon}
            {l.label}
            <span className="rounded-md border border-amber-400/35 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-100">
              Draft
            </span>
            <ArrowUpRight className="h-3 w-3 opacity-60" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function CreativeStudioDraftBriefs({ breakdownId, models, defaultModelId, perms }: Props) {
  const [open, setOpen] = React.useState(false);
  const [modelId, setModelId] = React.useState(defaultModelId);
  const [contentType, setContentType] = React.useState<DraftContentType | null>(null);
  const [flow, setFlow] = React.useState<DraftFlow>("batch");
  const [variationCount, setVariationCount] = React.useState(2);
  const [contentSource, setContentSource] = React.useState<"" | "proven" | "experimental" | "recreation">("proven");
  const [accountHandle, setAccountHandle] = React.useState("");
  const [region, setRegion] = React.useState<"Greece" | "USA" | "Global">("Greece");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [sets, setSets] = React.useState<BriefDraftSet[]>([]);

  React.useEffect(() => {
    setModelId(defaultModelId);
  }, [defaultModelId]);

  React.useEffect(() => {
    setSets([]);
    setWarnings([]);
    setError(null);
    if (!breakdownId) return;
    void fetch(`/api/creative-studio/breakdown/${encodeURIComponent(breakdownId)}/draft-briefs`)
      .then((r) => r.json())
      .then((d: { sets?: BriefDraftSet[] }) => setSets(Array.isArray(d.sets) ? d.sets : []))
      .catch(() => null);
  }, [breakdownId]);

  const canUse = perms.editing;
  const needsRecordingPerm = contentType === "creation" && !perms.recording;

  async function submit() {
    if (!breakdownId || !modelId || !contentType || busy) return;
    setBusy(true);
    setError(null);
    setWarnings([]);
    try {
      const res = await fetch(
        `/api/creative-studio/breakdown/${encodeURIComponent(breakdownId)}/draft-briefs`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            modelId,
            contentType,
            flow,
            variationCount,
            accountHandle: accountHandle.trim() || undefined,
            region,
            contentSource,
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        set?: BriefDraftSet;
        warnings?: string[];
      };
      if (!res.ok || !data.set) {
        setError(data.error ?? "Could not draft briefs.");
        return;
      }
      setSets((prev) => [...prev, data.set!]);
      setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
    } catch {
      setError("Could not draft briefs. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!canUse) return null;

  return (
    <div className="w-full space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={cn(VA_BTN_PRIMARY, "min-h-11 px-4 text-xs")}
          disabled={!breakdownId}
          onClick={() => setOpen((o) => !o)}
          title={breakdownId ? undefined : "Run a breakdown first"}
        >
          <Wand2 className="mr-1.5 h-3.5 w-3.5" />
          Draft briefs
        </button>
        {sets.length ? (
          <span className="text-[11px] text-white/40">
            {sets.length} draft set{sets.length === 1 ? "" : "s"} from this breakdown
          </span>
        ) : null}
      </div>

      {open && (
        <div className="space-y-4 rounded-2xl border border-[#FF1493]/25 bg-[#FF1493]/[0.04] p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Creator
              </p>
              <CustomSelect
                portaled
                value={modelId}
                onChange={setModelId}
                options={models.map((m) => ({ value: m.id, label: m.model_name }))}
                triggerClassName={cn(VA_FILTER_INPUT, "min-h-11 w-full")}
              />
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Flow
              </p>
              <div className="inline-flex w-full rounded-xl border border-white/10 bg-white/[0.03] p-1">
                {(["batch", "urgent", "trend"] as DraftFlow[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFlow(f)}
                    className={cn(
                      "min-h-9 flex-1 rounded-lg text-xs font-medium transition",
                      flow === f ? "bg-[#FF1493]/20 text-white" : "text-white/50",
                    )}
                  >
                    {flowLabel(f)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Type of content — your call: check the creator&apos;s Raw / Edited folders first
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setContentType("editable")}
                className={cn(
                  "rounded-xl border p-3 text-left transition",
                  contentType === "editable"
                    ? "border-emerald-400/50 bg-emerald-500/10"
                    : "border-white/10 bg-white/[0.02] hover:border-white/20",
                )}
              >
                <p className="flex items-center gap-2 text-sm font-medium text-white">
                  <Scissors className="h-4 w-4 text-emerald-300" /> Editable
                </p>
                <p className="mt-1 text-[12px] text-white/55">
                  The footage already exists. Editing brief + Posting brief. No recording.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setContentType("creation")}
                className={cn(
                  "rounded-xl border p-3 text-left transition",
                  contentType === "creation"
                    ? "border-[#D4AF8C]/60 bg-[#D4AF8C]/10"
                    : "border-white/10 bg-white/[0.02] hover:border-white/20",
                )}
              >
                <p className="flex items-center gap-2 text-sm font-medium text-white">
                  <Clapperboard className="h-4 w-4 text-[#D4AF8C]" /> Creation
                </p>
                <p className="mt-1 text-[12px] text-white/55">
                  The creator films new raw clips. Recording + Editing + Posting brief.
                </p>
              </button>
            </div>
            {needsRecordingPerm && (
              <p className="mt-1.5 text-[12px] text-amber-200/80">
                You need recording_briefs:manage to draft a recording brief.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Variations
              </p>
              <input
                type="number"
                min={1}
                max={6}
                className={cn(VA_FILTER_INPUT, "min-h-11 w-full")}
                value={variationCount}
                onChange={(e) => setVariationCount(Math.min(6, Math.max(1, Number(e.target.value) || 1)))}
              />
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Source bunch
              </p>
              <select
                className={cn(VA_FILTER_INPUT, "min-h-11 w-full")}
                value={contentSource}
                onChange={(e) =>
                  setContentSource(e.target.value as "" | "proven" | "experimental" | "recreation")
                }
                title="Tags the posting brief: original → grid, variations → trials."
              >
                <option value="proven">Proven</option>
                <option value="experimental">Experimental</option>
                <option value="recreation">Recreation</option>
                <option value="">—</option>
              </select>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Posting account (optional)
              </p>
              <input
                className={cn(VA_FILTER_INPUT, "min-h-11 w-full")}
                placeholder="@handle"
                value={accountHandle}
                onChange={(e) => setAccountHandle(e.target.value)}
              />
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Region
              </p>
              <select
                className={cn(VA_FILTER_INPUT, "min-h-11 w-full")}
                value={region}
                onChange={(e) => setRegion(e.target.value as typeof region)}
              >
                <option value="Greece">Greece</option>
                <option value="USA">USA</option>
                <option value="Global">Global</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={cn(VA_BTN_PRIMARY, "min-h-11 px-4 text-xs")}
              disabled={busy || !modelId || !contentType || needsRecordingPerm}
              onClick={() => void submit()}
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="mr-1.5 h-3.5 w-3.5" />
              )}
              {busy ? "Writing briefs… ~30–60 s" : "Create draft briefs"}
            </button>
            <p className="text-[12px] text-white/45">
              Drafts are invisible to creator, editor and VA until you open each one and press
              Publish.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-100/90">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {warnings.map((w, i) => (
            <p key={i} className="text-[12px] text-amber-200/80">
              {w}
            </p>
          ))}
        </div>
      )}

      {sets.length > 0 && (
        <div className="space-y-2">
          {[...sets].reverse().map((s) => (
            <DraftSetCard key={s.id} set={s} models={models} />
          ))}
        </div>
      )}
    </div>
  );
}
