import { getRecord, updateRecord, listAllRecords } from "@/lib/airtable-server";
import { getThisWeekMonday } from "@/lib/weekly-program";
import { spawnContentItem } from "@/services/content-items";

type WinnerFields = {
  winner_tier?: string;
  recreate_count?: number;
  pipeline_elements?: string;
  assigned_creator_id?: string;
  assigned_creator_name?: string;
  reference_model_id?: string;
  reference_model_name?: string;
  content_item_ids?: string;
  views_at_submission?: number;
  status?: string;
  submitted_at?: string;
};

export type WinnerLibraryEntry = {
  id: string;
  reference: string;
  tier: "winner" | "super_winner";
  views: number | null;
  elements: string;
  recreate_count: number;
  spawned: number;
};

function defaultCount(tier: string): number {
  return tier === "super_winner" ? 10 : 3;
}

/** Winners available for recreation (Manos' library). Excludes rejected. */
export async function listWinnerLibrary(): Promise<WinnerLibraryEntry[]> {
  const recs = await listAllRecords<WinnerFields>("winner_videos", {
    filterByFormula: `NOT({status} = "rejected")`,
  });
  return recs
    .map((r) => {
      const f = r.fields;
      const tier = (f.winner_tier === "super_winner" ? "super_winner" : "winner") as "winner" | "super_winner";
      const cnt = Number(f.recreate_count);
      return {
        id: r.id,
        reference: (f.reference_model_name || f.reference_model_id || "winner").toString(),
        tier,
        views: typeof f.views_at_submission === "number" ? f.views_at_submission : null,
        elements: (f.pipeline_elements ?? "").toString(),
        recreate_count: cnt > 0 ? cnt : defaultCount(tier),
        spawned: (f.content_item_ids ?? "").split(",").filter(Boolean).length,
      };
    })
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
}

/** Manos edits the tier / recreate count / "elements to change" for a winner. */
export async function updateWinnerLibraryEntry(
  id: string,
  patch: { tier?: "winner" | "super_winner"; recreate_count?: number; elements?: string }
): Promise<void> {
  const fields: WinnerFields = {};
  if (patch.tier) fields.winner_tier = patch.tier;
  if (typeof patch.recreate_count === "number") fields.recreate_count = patch.recreate_count;
  if (patch.elements !== undefined) fields.pipeline_elements = patch.elements;
  await updateRecord<WinnerFields>("winner_videos", id, fields);
}

/**
 * Spawn `count` recreate content_items (Creative stage) from a winner into the current week's bunch.
 * count defaults to the winner's recreate_count / tier default. Unused winners stay in the library.
 */
export async function spawnRecreatesFromWinner(
  winnerId: string,
  actor: { user_id: string; user_name: string },
  countOverride?: number
): Promise<{ count: number; tier: string }> {
  const rec = await getRecord<WinnerFields>("winner_videos", winnerId);
  const f = rec.fields;
  const tier = (f.winner_tier ?? "winner").trim() || "winner";
  const explicit = Number(f.recreate_count);
  const count = countOverride && countOverride > 0 ? countOverride : explicit > 0 ? explicit : defaultCount(tier);
  const creatorId = String(f.assigned_creator_id ?? f.reference_model_id ?? "").trim();
  const creatorName = String(f.assigned_creator_name ?? f.reference_model_name ?? "").trim();
  const elements = (f.pipeline_elements ?? "").toString().trim();
  const week = getThisWeekMonday();

  const existing = (f.content_item_ids ?? "").split(",").filter(Boolean);
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const item = await spawnContentItem({
      title: `Recreate: ${creatorName || "winner"}${elements ? ` — ${elements.slice(0, 60)}` : ""} #${existing.length + i + 1}`,
      creator_model_id: creatorId,
      creator_name: creatorName,
      week,
      source: "winner_recreate",
      winner_video_id: winnerId,
      stage: "creative",
      actor_user_id: actor.user_id,
      actor_name: actor.user_name,
    });
    ids.push(item.id);
  }
  await updateRecord<WinnerFields>("winner_videos", winnerId, { content_item_ids: [...existing, ...ids].join(",") });
  return { count: ids.length, tier };
}
