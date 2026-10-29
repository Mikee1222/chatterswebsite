import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getEditingBriefById } from "@/services/editing-briefs";
import type { PostingBrief } from "@/services/posting-briefs";

/**
 * Prefill a Posting Brief draft from an Approved Editing Brief.
 * Manage-only. Never auto-publishes — returns shape for the Posting Brief form.
 */
export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.POSTING_BRIEFS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const editing = await getEditingBriefById(id);
  if (!editing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const posts = editing.videos.map((v, i) => ({
    id: `pre_${i}`,
    brief_id: "preview",
    position: i,
    video_name: v.output_name || `Video ${i + 1}`,
    text_on_screen: null as string | null,
    caption: "",
    pinned_comment: null as string | null,
    notes: v.special_instructions || null,
    posted_url: null as string | null,
    posted_at: null as string | null,
    posted_by: null as string | null,
    placement: (i === 0 ? "grid" : "trial") as "grid" | "trial",
    content_source: "" as "" | "proven" | "experimental" | "recreation",
    views_24h: null as number | null,
    views_checked_at: null as string | null,
    outlier_multiple: null as number | null,
    outlier_status: "" as "" | "normal" | "outlier" | "hot",
    created_at: "",
    updated_at: "",
  }));

  // If no video rows, create one post per deliverable count
  if (!posts.length) {
    for (let i = 0; i < Math.max(1, editing.deliverables_count); i++) {
      posts.push({
        id: `pre_${i}`,
        brief_id: "preview",
        position: i,
        video_name: `Video ${i + 1}`,
        text_on_screen: null,
        caption: "",
        pinned_comment: null,
        notes: null,
        posted_url: null,
        posted_at: null,
        posted_by: null,
        placement: i === 0 ? ("grid" as const) : ("trial" as const),
        content_source: "" as const,
        views_24h: null,
        views_checked_at: null,
        outlier_multiple: null,
        outlier_status: "" as const,
        created_at: "",
        updated_at: "",
      });
    }
  }

  const brief: PostingBrief = {
    id: "prefill",
    title: editing.title ? `Post: ${editing.title}` : "Posting brief",
    model_id: editing.model_id,
    account_handle: "",
    account_type: "main",
    region: "Global",
    content_type: "Trial Reels",
    priority: editing.priority,
    instructions_notes: editing.concept,
    video_location_path: editing.upload_path_finals,
    sound_name: "",
    sound_link: "",
    sound_notes: "",
    text_style_notes: "",
    timing_notes: "",
    final_checklist: editing.final_check
      ? editing.final_check.split("\n").filter(Boolean)
      : [],
    status: "active",
    editing_brief_id: editing.id,
    created_by: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    posts,
  };

  return NextResponse.json({ brief });
}
