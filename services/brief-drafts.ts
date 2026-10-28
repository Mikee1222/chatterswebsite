/**
 * Draft briefs from a Winner Breakdown.
 * The CD chooses creator + content type (Editable / Creation) + flow; the AI writes
 * the brief text (persona-grounded, must-keep elements preserved); records are
 * created in status DRAFT in the existing Recording / Editing / Posting Briefs
 * modules, linked through the FLOW. Nothing is published or notified here.
 */

import "server-only";

import { randomUUID } from "crypto";
import {
  AI_ASSISTANT_MODEL,
  callAnthropicVision,
  resolveBreakdownModel,
} from "@/lib/ai-assistant";
import {
  BRIEF_DRAFTS_MAX_TOKENS,
  BRIEF_DRAFTS_SYSTEM_PROMPT,
  BRIEF_DRAFTS_TOOL,
  BRIEF_DRAFTS_TOOL_NAME,
  type BriefDraftSet,
  type BriefDraftsJson,
  type DraftContentType,
  type DraftEditing,
  type DraftFlow,
  type DraftPosting,
  type DraftRecording,
} from "@/lib/brief-drafts-schema";
import { buildPersonaAiContext, PLATFORM_SAFE_SOCIAL_RULES } from "@/lib/persona-ai-context";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { breakdownToMarkdown } from "@/lib/winner-breakdown-schema";
import { assertCreativeRateLimit } from "@/services/creative-studio";
import { createEditingBrief } from "@/services/editing-briefs";
import { getModelById } from "@/services/modelss";
import {
  getPersonaByModelId,
  isPersonaAdult,
  listLiveUpdates,
} from "@/services/model-personas";
import { createPostingBrief, type PostingBriefRegion } from "@/services/posting-briefs";
import { createRecordingBrief } from "@/services/recording-briefs";
import { getWinnerBreakdown, type WinnerBreakdownRow } from "@/services/winner-breakdowns";

const BREAKDOWN_TABLE = "creative_studio_winner_breakdowns";

export type DraftBriefsInput = {
  breakdownId: string;
  modelId: string;
  contentType: DraftContentType;
  flow: DraftFlow;
  variationCount?: number;
  accountHandle?: string;
  region?: PostingBriefRegion;
  userId: string;
  /** Skip the posting brief (caller lacks posting_briefs:manage). */
  skipPosting?: boolean;
};

export type DraftBriefsResult = {
  set: BriefDraftSet;
  warnings: string[];
};

/* ------------------------------------------------------------------ */
/* House conventions (deterministic — not left to the model)           */
/* ------------------------------------------------------------------ */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

function folderSegment(flow: DraftFlow, now: Date): string {
  return flow === "batch" ? `Week ${isoWeek(now)}` : "Urgent";
}

function accountSegment(accountHandle: string | undefined): string {
  const h = (accountHandle ?? "").trim().replace(/^@/, "");
  return h ? `@${h}` : "Main Account";
}

export function housePaths(input: {
  creatorName: string;
  flow: DraftFlow;
  accountHandle?: string;
  now?: Date;
}): { raw: string; edited: string; ready: string } {
  const now = input.now ?? new Date();
  const base = `iCloud Drive → USA Marketing Agency → ${input.creatorName}`;
  const ym = `${now.getFullYear()} → ${MONTHS[now.getMonth()]}`;
  const seg = folderSegment(input.flow, now);
  const acc = accountSegment(input.accountHandle);
  return {
    raw: `${base} → Content To Edit → Raw Videos → ${ym} → ${seg} → ${acc}`,
    edited: `${base} → Content To Edit → Edited Videos → ${ym} → ${seg} → ${acc}`,
    ready: `${base} → Content To Upload → Videos To Upload → ${ym} → Week ${isoWeek(now)} → [day] → ${acc} → Trial`,
  };
}

function priorityFor(flow: DraftFlow): "normal" | "urgent" {
  return flow === "batch" ? "normal" : "urgent";
}

function flowLabel(flow: DraftFlow): string {
  return flow === "batch" ? "Batch" : flow === "urgent" ? "Urgent trial" : "Trend";
}

/* ------------------------------------------------------------------ */
/* Model output sanitising                                              */
/* ------------------------------------------------------------------ */

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function bool(v: unknown): boolean {
  return v === true || v === "true";
}
function strArr(v: unknown, max = 20): string[] {
  return Array.isArray(v) ? v.map((x) => str(x).trim()).filter(Boolean).slice(0, max) : [];
}

function sanitizeRecording(v: unknown): DraftRecording | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  const variations = Array.isArray(r.variations)
    ? (r.variations as unknown[])
        .map((x) => {
          const o = (x ?? {}) as Record<string, unknown>;
          return {
            name: str(o.name).trim(),
            script_shot_list: str(o.script_shot_list).trim(),
            takes: Math.min(5, Math.max(1, Math.round(Number(o.takes) || 2))),
            notes: str(o.notes).trim(),
          };
        })
        .filter((x) => x.name || x.script_shot_list)
        .slice(0, 8)
    : [];
  if (!str(r.concept_why).trim() && !variations.length) return null;
  return {
    title: str(r.title).trim(),
    concept_why: str(r.concept_why).trim(),
    setup_camera: str(r.setup_camera).trim(),
    setup_framing: str(r.setup_framing).trim(),
    setup_location: str(r.setup_location).trim(),
    setup_outfit: str(r.setup_outfit).trim(),
    setup_light: str(r.setup_light).trim(),
    setup_sound: str(r.setup_sound).trim(),
    setup_notes: str(r.setup_notes).trim(),
    how_to_talk: str(r.how_to_talk).trim(),
    how_to_act: str(r.how_to_act).trim(),
    props: str(r.props).trim(),
    checklist_before_upload: str(r.checklist_before_upload).trim(),
    variations,
  };
}

function sanitizeEditing(v: unknown): DraftEditing | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  const videos = Array.isArray(r.videos)
    ? (r.videos as unknown[])
        .map((x) => {
          const o = (x ?? {}) as Record<string, unknown>;
          return {
            output_name: str(o.output_name).trim(),
            raw_take: str(o.raw_take).trim(),
            special_instructions: str(o.special_instructions).trim(),
            text_on_screen: str(o.text_on_screen).trim(),
          };
        })
        .filter((x) => x.output_name)
        .slice(0, 8)
    : [];
  const av = str(r.audio_voice);
  return {
    title: str(r.title).trim(),
    concept: str(r.concept).trim(),
    raw_files_takes: str(r.raw_files_takes).trim(),
    cut_rules: str(r.cut_rules).trim(),
    audio_voice: av === "mute_original" || av === "clean_up" ? av : "keep_voice",
    audio_music: bool(r.audio_music),
    audio_notes: str(r.audio_notes).trim(),
    subtitles: bool(r.subtitles),
    do_not_add: str(r.do_not_add).trim(),
    final_check: str(r.final_check).trim(),
    videos,
  };
}

function sanitizePosting(v: unknown): DraftPosting | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  const posts = Array.isArray(r.posts)
    ? (r.posts as unknown[])
        .map((x) => {
          const o = (x ?? {}) as Record<string, unknown>;
          return {
            video_name: str(o.video_name).trim(),
            text_on_screen: str(o.text_on_screen).trim(),
            caption: str(o.caption).trim(),
            pinned_comment: str(o.pinned_comment).trim(),
            notes: str(o.notes).trim(),
          };
        })
        .filter((x) => x.video_name || x.caption)
        .slice(0, 8)
    : [];
  return {
    title: str(r.title).trim(),
    instructions_notes: str(r.instructions_notes).trim(),
    sound_name: str(r.sound_name).trim(),
    sound_notes: str(r.sound_notes).trim(),
    text_style_notes: str(r.text_style_notes).trim(),
    timing_notes: str(r.timing_notes).trim(),
    final_checklist: strArr(r.final_checklist),
    posts,
  };
}

/* ------------------------------------------------------------------ */
/* Prompt                                                               */
/* ------------------------------------------------------------------ */

function buildPrompt(input: {
  breakdown: WinnerBreakdownRow;
  creatorName: string;
  personaText: string;
  firstLanguage: string;
  contentType: DraftContentType;
  flow: DraftFlow;
  variationCount: number;
  paths: { raw: string; edited: string; ready: string };
  accountHandle?: string;
}): string {
  const b = input.breakdown;
  const lines: string[] = [];
  lines.push(`CREATOR: ${input.creatorName}`);
  lines.push(`CREATOR FIRST LANGUAGE (scripts / text on screen / captions): ${input.firstLanguage || "Greek"}`);
  lines.push(`CONTENT TYPE (decided by the Creative Director): ${input.contentType.toUpperCase()} — ${
    input.contentType === "editable"
      ? "the footage already exists; NO recording brief (pass recording: null)."
      : "the creator must film new raw clips; write the recording brief."
  }`);
  lines.push(`FLOW: ${flowLabel(input.flow)} (priority ${priorityFor(input.flow)}).`);
  lines.push(`VARIATIONS: write exactly ${input.variationCount} variations, V1..V${input.variationCount}. Each one keeps every must-keep element.`);
  if (input.accountHandle) lines.push(`POSTING ACCOUNT: @${input.accountHandle.replace(/^@/, "")}`);
  lines.push("");
  lines.push("HOUSE RULES:");
  lines.push("- Recording brief order: concept & why it works → setup → how to talk / act → variations → checklist. The creator shoots RAW only: no music, no text, no filters. 2 takes per variation unless told otherwise. One take = one clip.");
  lines.push(`- Clip naming: V1_take1, V1_take2 … Creator uploads to: ${input.paths.raw}`);
  lines.push(`- Editor takes from the Raw folder (or existing footage) and delivers to: ${input.paths.edited}. Export 1080x1920, 30fps, MP4, no watermark. Output names V1_final …`);
  lines.push(`- VA posts from: ${input.paths.ready}. Trials ON. Text on screen must match the edit.`);
  lines.push("- Text on screen, labels and captions: relatable, clever, innuendo instead of explicit wording.");
  lines.push(PLATFORM_SAFE_SOCIAL_RULES.trim());
  lines.push("");
  lines.push("CREATOR PERSONA (allowlisted fields only):");
  lines.push(input.personaText || "(no persona details available)");
  lines.push("");
  lines.push("WINNER BREAKDOWN:");
  lines.push(breakdownToMarkdown(b.breakdown, { sourceUrl: b.source_url || undefined }));
  if (b.transcript.trim()) {
    lines.push("");
    lines.push("ORIGINAL TRANSCRIPT (for reference — do not copy it word for word, write new scripts):");
    lines.push(b.transcript.trim().slice(0, 6_000));
  }
  lines.push("");
  lines.push(`Write the briefs now with ${BRIEF_DRAFTS_TOOL_NAME}.`);
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* Main                                                                 */
/* ------------------------------------------------------------------ */

export async function draftBriefsFromBreakdown(input: DraftBriefsInput): Promise<DraftBriefsResult> {
  await assertCreativeRateLimit(input.userId);
  const warnings: string[] = [];

  const breakdown = await getWinnerBreakdown(input.breakdownId);
  if (!breakdown) throw new Error("Breakdown not found");
  if (breakdown.status !== "success" || breakdown.breakdown.refusal) {
    throw new Error("This breakdown has no usable analysis");
  }

  const model = await getModelById(input.modelId);
  const creatorName = model?.model_name?.trim() || "Creator";

  const persona = await getPersonaByModelId(input.modelId);
  if (!persona) throw new Error("No persona found for this model — create one first");
  if (!isPersonaAdult(persona.personal_info)) {
    throw new Error("AI generation disabled — birth date required and must be 18+");
  }
  const live = await listLiveUpdates(persona.id, { includeInactive: false });
  const bundle = buildPersonaAiContext(persona, live);
  const firstLanguage = persona.personal_info.languages?.[0]?.language?.trim() || "Greek";

  const variationCount = Math.min(6, Math.max(1, Math.round(input.variationCount ?? 3)));
  const now = new Date();
  const paths = housePaths({ creatorName, flow: input.flow, accountHandle: input.accountHandle, now });

  const modelName = resolveBreakdownModel();
  const result = await callAnthropicVision({
    text: buildPrompt({
      breakdown,
      creatorName,
      personaText: bundle.contextText,
      firstLanguage,
      contentType: input.contentType,
      flow: input.flow,
      variationCount,
      paths,
      accountHandle: input.accountHandle,
    }),
    system: BRIEF_DRAFTS_SYSTEM_PROMPT,
    maxTokens: BRIEF_DRAFTS_MAX_TOKENS,
    temperature: 0.5,
    model: modelName,
    fallbackModel: AI_ASSISTANT_MODEL,
    logLabel: "creative_studio_brief_drafts",
    tools: [BRIEF_DRAFTS_TOOL as unknown as { name: string; description: string; input_schema: Record<string, unknown> }],
    toolChoice: { type: "tool", name: BRIEF_DRAFTS_TOOL_NAME },
  });

  const raw = (result?.toolInput ?? null) as Partial<BriefDraftsJson> | null;
  if (!raw) throw new Error("The AI could not write the briefs. Try again.");

  const recording = input.contentType === "creation" ? sanitizeRecording(raw.recording) : null;
  const editing = sanitizeEditing(raw.editing);
  const posting = sanitizePosting(raw.posting);
  if (!editing) throw new Error("The AI returned an unusable editing brief. Try again.");
  if (input.contentType === "creation" && !recording) {
    throw new Error("The AI returned an unusable recording brief. Try again.");
  }

  const hookText = breakdown.breakdown.hook?.text?.slice(0, 60) || breakdown.title || "Winner";
  const baseTitle = `${creatorName} · ${hookText}`;
  const priority = priorityFor(input.flow);
  const refLinks = breakdown.source_url ? [breakdown.source_url] : [];
  const flowTag = `[${flowLabel(input.flow)} · ${input.contentType === "editable" ? "Editable" : "Creation"}]`;

  /* ---- Recording (creation only) ---- */
  let recordingBriefId: string | null = null;
  if (recording) {
    const rec = await createRecordingBrief(
      {
        title: recording.title || `${baseTitle} — Recording`,
        model_id: input.modelId,
        reference_links: refLinks,
        priority,
        deadline_at: null,
        concept_why: recording.concept_why,
        setup_camera: recording.setup_camera,
        setup_framing: recording.setup_framing,
        setup_location: recording.setup_location,
        setup_outfit: recording.setup_outfit,
        setup_light: recording.setup_light,
        setup_sound: recording.setup_sound,
        setup_notes: [flowTag, recording.setup_notes].filter(Boolean).join("\n"),
        how_to_talk: recording.how_to_talk,
        how_to_act: recording.how_to_act,
        props: recording.props,
        checklist_before_upload: recording.checklist_before_upload,
        upload_path: paths.raw,
        clip_naming: "V1_take1, V1_take2, V2_take1 … (variation_take)",
        status: "draft",
        variations: recording.variations.map((v, i) => ({
          name: v.name || `V${i + 1}`,
          script_shot_list: v.script_shot_list,
          takes: v.takes,
          notes: v.notes,
        })),
        created_by: input.userId,
      },
      { notify: false },
    );
    recordingBriefId = rec.id;
  }

  /* ---- Editing (always) ---- */
  const videoCount = Math.max(1, editing.videos.length || recording?.variations.length || variationCount);
  const textGraphics = (editing.videos.length ? editing.videos : Array.from({ length: videoCount }, (_, i) => ({
    output_name: `V${i + 1}_final`,
    raw_take: "",
    special_instructions: "",
    text_on_screen: "",
  }))).map((v) => ({
    title_on_top_text: v.text_on_screen,
    title_on_top_style: "",
    subtitles: editing.subtitles,
    subtitles_style: "",
    labels: "",
    pictures: "",
  }));

  const ed = await createEditingBrief(
    {
      title: editing.title || `${baseTitle} — Editing`,
      model_id: input.modelId,
      reference_links: refLinks,
      priority,
      deadline_at: null,
      deliverables_count: videoCount,
      recording_brief_id: recordingBriefId,
      assigned_editor_id: "",
      concept: [flowTag, editing.concept].filter(Boolean).join("\n"),
      raw_footage_path:
        input.contentType === "editable"
          ? `Existing footage — check Raw Videos / Edited Videos of ${creatorName} first`
          : paths.raw,
      raw_files_takes: editing.raw_files_takes,
      cut_rules: editing.cut_rules,
      audio_voice: editing.audio_voice,
      audio_music: editing.audio_music,
      audio_notes: editing.audio_notes,
      text_graphics: textGraphics,
      do_not_add: editing.do_not_add,
      export_width: 1080,
      export_height: 1920,
      export_fps: 30,
      export_format: "MP4",
      upload_path_finals: paths.edited,
      final_check: editing.final_check,
      status: "draft",
      videos: (editing.videos.length
        ? editing.videos
        : Array.from({ length: videoCount }, (_, i) => ({
            output_name: `V${i + 1}_final`,
            raw_take: recording?.variations[i]?.name ?? "",
            special_instructions: "",
            text_on_screen: "",
          }))
      ).map((v) => ({
        output_name: v.output_name,
        raw_take: v.raw_take,
        special_instructions: [v.text_on_screen ? `Text on screen: ${v.text_on_screen}` : "", v.special_instructions]
          .filter(Boolean)
          .join("\n"),
      })),
      created_by: input.userId,
    },
    { notify: false },
  );

  /* ---- Posting (unless caller cannot manage posting briefs) ---- */
  let postingBriefId: string | null = null;
  if (input.skipPosting) {
    warnings.push("Posting brief skipped — you do not have posting_briefs:manage.");
  } else if (!posting) {
    warnings.push("The AI did not return a posting brief; create it from the editing brief later.");
  } else {
    const posts = posting.posts.length
      ? posting.posts
      : (editing.videos.length ? editing.videos : []).map((v) => ({
          video_name: v.output_name,
          text_on_screen: v.text_on_screen,
          caption: "",
          pinned_comment: "",
          notes: "",
        }));
    const pb = await createPostingBrief(
      {
        title: posting.title || `${baseTitle} — Posting`,
        model_id: input.modelId,
        account_handle: (input.accountHandle ?? "").trim().replace(/^@/, ""),
        account_type: "main",
        region: input.region ?? "Greece",
        content_type: "Trial Reels",
        priority,
        instructions_notes: [flowTag, posting.instructions_notes].filter(Boolean).join("\n"),
        video_location_path: paths.ready,
        sound_name: posting.sound_name,
        sound_link: "",
        sound_notes: posting.sound_notes,
        text_style_notes: posting.text_style_notes,
        timing_notes: posting.timing_notes,
        final_checklist: posting.final_checklist,
        status: "draft",
        editing_brief_id: ed.id,
        posts: posts.map((p) => ({
          video_name: p.video_name,
          text_on_screen: p.text_on_screen || null,
          caption: p.caption,
          pinned_comment: p.pinned_comment || null,
          notes: p.notes || null,
        })),
        created_by: input.userId,
      },
      { notify: false },
    );
    postingBriefId = pb.id;
  }

  const set: BriefDraftSet = {
    id: randomUUID(),
    model_id: input.modelId,
    model_name: creatorName,
    content_type: input.contentType,
    flow: input.flow,
    recording_brief_id: recordingBriefId,
    editing_brief_id: ed.id,
    posting_brief_id: postingBriefId,
    created_by: input.userId,
    created_at: now.toISOString(),
  };

  // Append to the breakdown row (best-effort).
  try {
    const sb = getSupabaseServiceClient();
    const { data } = await sb
      .from(BREAKDOWN_TABLE)
      .select("draft_sets")
      .eq("id", input.breakdownId)
      .maybeSingle();
    const existing = Array.isArray((data as { draft_sets?: unknown } | null)?.draft_sets)
      ? ((data as { draft_sets: unknown[] }).draft_sets as BriefDraftSet[])
      : [];
    await sb
      .from(BREAKDOWN_TABLE)
      .update({ draft_sets: [...existing, set], updated_at: now.toISOString() })
      .eq("id", input.breakdownId);
  } catch (err) {
    console.error("[creative-studio] draft_sets update failed", err);
  }

  console.info("[creative-studio] brief-drafts", {
    feature: "creative_studio_brief_drafts",
    breakdownId: input.breakdownId,
    contentType: input.contentType,
    flow: input.flow,
    recording: Boolean(recordingBriefId),
    posting: Boolean(postingBriefId),
    model: result?.model ?? modelName,
  });

  return { set, warnings };
}

export async function listDraftSets(breakdownId: string): Promise<BriefDraftSet[]> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(BREAKDOWN_TABLE)
    .select("draft_sets")
    .eq("id", breakdownId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const sets = (data as { draft_sets?: unknown } | null)?.draft_sets;
  return Array.isArray(sets) ? (sets as BriefDraftSet[]) : [];
}
