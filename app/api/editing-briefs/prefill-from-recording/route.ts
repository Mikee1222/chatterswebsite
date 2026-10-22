import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  buildClipFileListFromRecording,
  getRecordingBriefById,
} from "@/services/recording-briefs";
import type { EditingBrief } from "@/services/editing-briefs";
import { emptyTextGraphics } from "@/services/editing-briefs";

/**
 * Prefill a DRAFT Editing Brief from an Uploaded Recording Brief.
 * Manage-only. Never auto-publishes.
 */
export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.EDITING_BRIEFS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const recording = await getRecordingBriefById(id);
  if (!recording) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const files = buildClipFileListFromRecording(recording);
  const videos = recording.variations.map((v, i) => ({
    id: `pre_${i}`,
    brief_id: "preview",
    position: i,
    output_name: v.name || `V${i + 1}`,
    raw_take: files.filter((f) => f.includes(`V${i + 1}`) || f.toLowerCase().includes(`v${i + 1}`)).join("\n") ||
      Array.from({ length: Math.max(1, v.takes) }, (_, t) => `V${i + 1}_take${t + 1}`).join("\n"),
    special_instructions: v.notes || "",
    created_at: "",
    updated_at: "",
  }));

  const brief: EditingBrief = {
    id: "prefill",
    title: recording.title ? `Edit: ${recording.title}` : "Edit brief",
    model_id: recording.model_id,
    reference_links: recording.reference_links,
    priority: recording.priority,
    deadline_at: null,
    deliverables_count: Math.max(1, recording.variations.length || 1),
    recording_brief_id: recording.id,
    assigned_editor_id: "",
    concept: recording.concept_why,
    raw_footage_path: recording.upload_path,
    raw_files_takes: files.join("\n"),
    cut_rules: "",
    audio_voice: "keep_voice",
    audio_music: false,
    audio_notes: "",
    text_graphics: [emptyTextGraphics()],
    do_not_add: "",
    export_width: 1080,
    export_height: 1920,
    export_fps: 30,
    export_format: "MP4",
    upload_path_finals: "",
    final_check: "",
    status: "draft",
    reviewer_comment: "",
    created_by: "",
    reminder_sent_at: null,
    overdue_alerted_at: null,
    delivered_at: null,
    delivered_by: null,
    reviewed_at: null,
    reviewed_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    videos,
  };

  return NextResponse.json({ brief });
}
