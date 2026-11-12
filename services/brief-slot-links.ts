/**
 * Content flow glue between a bunch slot (one idea in Scripts to Write) and the editing /
 * posting briefs written for it.
 *
 *   Creative Director submits the recording brief (the slot's script)   → Pending Review
 *   CD writes the editing brief (if needed) and the posting brief       → saved as DRAFT
 *   Head of Marketing approves the recording brief                      → Approved
 *        → the slot's draft editing brief is published (the editor sees it)
 *        → the slot's draft posting brief becomes active (VAs can open it; they are told
 *          to post later, when the Marketing Manager presses "Notify VAs")
 *
 * A brief that cannot go live at approval time (e.g. an editing brief with no editor) stays
 * a draft. Once fixed, a manager opens it and presses "Publish now", which runs the same
 * activation again (POST /api/creative-scripts/[id]/activate-briefs).
 *
 * Server-only.
 */

import "server-only";

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { getWinnerVideoById } from "@/services/winner-videos";
import { transitionEditingBriefStatus } from "@/services/editing-briefs";
import { setPostingBriefStatus } from "@/services/posting-briefs";

/** True when the slot's recording brief (script) has been approved by the Head of Marketing. */
export async function isSlotRecordingBriefApproved(winnerVideoId: string): Promise<boolean> {
  const id = String(winnerVideoId ?? "").trim();
  if (!id) return false;
  const video = await getWinnerVideoById(id).catch(() => null);
  return video?.script_status === "Approved";
}

export type SlotBriefActivation = {
  editing_published: number;
  posting_activated: number;
  /** Briefs that could not go live, with the reason (e.g. no editor assigned). */
  skipped: { kind: "editing" | "posting"; id: string; title: string; reason: string }[];
};

/**
 * Called right after a recording brief is approved: every DRAFT editing / posting brief
 * linked to the slot goes live. Never throws — approval must not fail because of a brief.
 */
export async function activateBriefsForSlot(
  winnerVideoId: string,
  actorUserId: string,
  /** Limit to the brief kinds the caller may publish (the manual "Publish now" retry). */
  kinds: ("editing" | "posting")[] = ["editing", "posting"],
): Promise<SlotBriefActivation> {
  const out: SlotBriefActivation = { editing_published: 0, posting_activated: 0, skipped: [] };
  const id = String(winnerVideoId ?? "").trim();
  if (!id) return out;
  const sb = getSupabaseServiceClient();

  const { data: editing, error: eErr } = kinds.includes("editing")
    ? await sb.from("editing_briefs").select("id, title").eq("winner_video_id", id).eq("status", "draft")
    : { data: [], error: null };
  // eErr here usually means migration 20261112210000 is not applied yet: nothing is linked.
  if (!eErr) {
    for (const row of (editing ?? []) as { id: string; title: string | null }[]) {
      try {
        await transitionEditingBriefStatus({
          id: String(row.id),
          to: "published",
          capabilities: ["manage"],
          actorUserId,
        });
        out.editing_published += 1;
      } catch (err) {
        out.skipped.push({
          kind: "editing",
          id: String(row.id),
          title: String(row.title ?? ""),
          reason: err instanceof Error ? err.message : "Could not publish",
        });
      }
    }
  }

  const { data: posting, error: pErr } = kinds.includes("posting")
    ? await sb.from("posting_briefs").select("id, title").eq("winner_video_id", id).eq("status", "draft")
    : { data: [], error: null };
  if (!pErr) {
    for (const row of (posting ?? []) as { id: string; title: string | null }[]) {
      try {
        // No VA notification here: the videos do not exist yet. The Marketing Manager
        // notifies the VAs when the edited files are in the folder.
        await setPostingBriefStatus(String(row.id), "active");
        out.posting_activated += 1;
      } catch (err) {
        out.skipped.push({
          kind: "posting",
          id: String(row.id),
          title: String(row.title ?? ""),
          reason: err instanceof Error ? err.message : "Could not activate",
        });
      }
    }
  }
  return out;
}
