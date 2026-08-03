/**
 * Supabase backend for services/winner-recreates.ts
 */
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { publicId, sbSelectByPublicId, sbUpdateByPublicId, type SbRow } from "@/lib/supabase-data";
import { getThisWeekMonday } from "@/lib/weekly-program";
import { spawnContentItem } from "@/services/content-items";
import type { WinnerLibraryEntry } from "./winner-recreates";

type WinnerRow = SbRow & {
  winner_tier?: string | null;
  recreate_count?: number | null;
  pipeline_elements?: string | null;
  assigned_creator_id?: string | null;
  assigned_creator_name?: string | null;
  reference_model_id?: string | null;
  reference_model_name?: string | null;
  content_item_ids?: string | null;
  views_at_submission?: number | null;
  status?: string | null;
  submitted_at?: string | null;
  video_link?: string | null;
};

function defaultCount(tier: string): number {
  return tier === "super_winner" ? 10 : 3;
}

export async function listWinnerLibrary(): Promise<WinnerLibraryEntry[]> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("winner_videos")
    .select("*")
    .neq("status", "rejected")
    .not("winner_tier", "is", null)
    .neq("winner_tier", "");
  if (error) throw new Error(`listWinnerLibrary: ${error.message}`);
  const recs = (data ?? []) as unknown as WinnerRow[];
  return recs
    .map((f) => {
      const tier = (f.winner_tier === "super_winner" ? "super_winner" : "winner") as "winner" | "super_winner";
      const cnt = Number(f.recreate_count);
      return {
        id: publicId(f),
        reference: (f.reference_model_name || f.reference_model_id || "winner").toString(),
        video_link: (f.video_link ?? "").toString(),
        tier,
        views: typeof f.views_at_submission === "number" ? f.views_at_submission : null,
        elements: (f.pipeline_elements ?? "").toString(),
        recreate_count: cnt > 0 ? cnt : defaultCount(tier),
        spawned: (f.content_item_ids ?? "").split(",").filter(Boolean).length,
      };
    })
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
}

export async function updateWinnerLibraryEntry(
  id: string,
  patch: { tier?: "winner" | "super_winner"; recreate_count?: number; elements?: string }
): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (patch.tier) fields.winner_tier = patch.tier;
  if (typeof patch.recreate_count === "number") fields.recreate_count = patch.recreate_count;
  if (patch.elements !== undefined) fields.pipeline_elements = patch.elements;
  if (!Object.keys(fields).length) return;
  await sbUpdateByPublicId("winner_videos", id, fields);
}

export async function submitPipelineWinner(input: {
  video_link: string;
  creator_model_id: string;
  creator_name: string;
  elements: string;
  tier: "winner" | "super_winner";
  submitted_by_id: string;
  submitted_by_name: string;
}): Promise<string> {
  const { createWinnerVideo } = await import("@/services/winner-videos");
  const v = await createWinnerVideo({
    reference_model_name: input.creator_name || "winner",
    reference_model_id: input.creator_model_id,
    content_type: "UGC",
    video_link: input.video_link,
    note: input.elements,
    submitted_by_id: input.submitted_by_id,
    submitted_by_name: input.submitted_by_name,
  });
  await sbUpdateByPublicId("winner_videos", v.id, {
    winner_tier: input.tier,
    pipeline_elements: input.elements,
    assigned_creator_name: input.creator_name,
  });
  return v.id;
}

export async function spawnRecreatesFromWinner(
  winnerId: string,
  actor: { user_id: string; user_name: string },
  countOverride?: number
): Promise<{ count: number; tier: string }> {
  const rec = await sbSelectByPublicId<WinnerRow>("winner_videos", winnerId);
  if (!rec) throw new Error(`winner_videos ${winnerId} not found`);
  const tier = (rec.winner_tier ?? "winner")?.trim() || "winner";
  const explicit = Number(rec.recreate_count);
  const count = countOverride && countOverride > 0 ? countOverride : explicit > 0 ? explicit : defaultCount(tier);
  const creatorId = String(rec.assigned_creator_id ?? rec.reference_model_id ?? "").trim();
  const creatorName = String(rec.assigned_creator_name ?? rec.reference_model_name ?? "").trim();
  const elements = (rec.pipeline_elements ?? "").toString().trim();
  const videoLink = (rec.video_link ?? "").toString().trim();
  const week = getThisWeekMonday();

  const existing = (rec.content_item_ids ?? "").split(",").filter(Boolean);
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const item = await spawnContentItem({
      title: `Recreate: ${creatorName || "winner"}${elements ? ` — ${elements.slice(0, 60)}` : ""} #${existing.length + i + 1}`,
      creator_model_id: creatorId,
      creator_name: creatorName,
      week,
      source: "winner_recreate",
      winner_video_id: winnerId,
      ...(videoLink ? { reference_link: videoLink } : {}),
      stage: "creative",
      actor_user_id: actor.user_id,
      actor_name: actor.user_name,
    });
    ids.push(item.id);
  }
  await sbUpdateByPublicId("winner_videos", winnerId, { content_item_ids: [...existing, ...ids].join(",") });
  return { count: ids.length, tier };
}
