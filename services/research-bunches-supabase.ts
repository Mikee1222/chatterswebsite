/**
 * Supabase backend for services/research-bunches.ts
 */
import {
  publicId,
  sbDeleteByPublicId,
  sbInsert,
  sbSelectAll,
  sbSelectByPublicId,
  sbUpdateByPublicId,
  type SbRow,
} from "@/lib/supabase-data";
import { getThisWeekMonday } from "@/lib/weekly-program";
import { spawnContentItem } from "@/services/content-items";
import { resolveStageOwner } from "@/services/creator-assignments";
import type {
  BunchStatus,
  IdeaPlatform,
  ResearchBunch,
  ResearchIdea,
} from "./research-bunches";

const BUNCHES = "research_bunches";
const IDEAS = "research_ideas";

type BunchRow = SbRow & {
  bunch_id?: string | null;
  creator_model_id?: string | null;
  creator_name?: string | null;
  researcher_user_id?: string | null;
  researcher_name?: string | null;
  week?: string | null;
  status?: string | null;
  qa_by_user_id?: string | null;
  qa_by_name?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  created_at?: string | null;
  target_research?: number | null;
  target_winner?: number | null;
  deadline?: string | null;
  assigned_at?: string | null;
  created_by_name?: string | null;
  film_type?: string | null;
  qa_note?: string | null;
};

type IdeaRow = SbRow & {
  idea_id?: string | null;
  bunch_id?: string | null;
  platform?: string | null;
  idea_text?: string | null;
  reference_link?: string | null;
  checked?: boolean | null;
  qa_note?: string | null;
  spawned_item_id?: string | null;
  created_at?: string | null;
};

function mapBunch(row: BunchRow): ResearchBunch {
  return {
    id: publicId(row),
    creator_model_id: row.creator_model_id ?? "",
    creator_name: row.creator_name ?? "",
    researcher_user_id: row.researcher_user_id ?? "",
    researcher_name: row.researcher_name ?? "",
    week: row.week ?? "",
    status: (row.status as BunchStatus) ?? "draft",
    qa_by_name: row.qa_by_name ?? "",
    target_research: Number(row.target_research ?? 0),
    target_winner: Number(row.target_winner ?? 0),
    deadline: row.deadline ?? "",
    assigned_at: row.assigned_at ?? "",
    created_by_name: row.created_by_name ?? "",
    film_type: row.film_type ?? "",
    qa_note: row.qa_note ?? "",
  };
}

function mapIdea(row: IdeaRow): ResearchIdea {
  return {
    id: publicId(row),
    bunch_id: row.bunch_id ?? "",
    platform: row.platform ?? "IG",
    idea_text: row.idea_text ?? "",
    reference_link: row.reference_link ?? "",
    checked: row.checked ?? false,
    qa_note: row.qa_note ?? "",
    spawned_item_id: row.spawned_item_id ?? "",
  };
}

export async function listBunchesForResearcher(researcherRecId: string): Promise<ResearchBunch[]> {
  const rows = await sbSelectAll<BunchRow>(BUNCHES);
  return rows.filter((r) => (r.researcher_user_id ?? "") === researcherRecId).map(mapBunch);
}

export async function getBunchById(bunchId: string): Promise<ResearchBunch | null> {
  const row = await sbSelectByPublicId<BunchRow>(BUNCHES, bunchId);
  return row ? mapBunch(row) : null;
}

export async function listBunchesAwaitingQa(): Promise<ResearchBunch[]> {
  const rows = await sbSelectAll<BunchRow>(BUNCHES);
  return rows.filter((r) => r.status === "awaiting_qa").map(mapBunch);
}

export async function listIdeasForBunch(bunchRecId: string): Promise<ResearchIdea[]> {
  const rows = await sbSelectAll<IdeaRow>(IDEAS);
  return rows.filter((r) => (r.bunch_id ?? "") === bunchRecId).map(mapIdea);
}

export async function createManagerBunch(input: {
  creator_model_id: string;
  creator_name: string;
  target_research: number;
  target_winner: number;
  deadline?: string;
  film_type?: "self_record" | "filmer";
  created_by_name: string;
}): Promise<{ bunch: ResearchBunch; researcher: { user_id: string; user_name: string } | null }> {
  const researcher = await resolveStageOwner(input.creator_model_id, "researcher");
  const now = new Date().toISOString();
  const row = await sbInsert<BunchRow>(BUNCHES, {
    bunch_id: `rb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    creator_model_id: input.creator_model_id,
    creator_name: input.creator_name,
    researcher_user_id: researcher?.user_id ?? "",
    researcher_name: researcher?.user_name ?? "",
    week: getThisWeekMonday(),
    status: "collecting",
    target_research: input.target_research,
    target_winner: input.target_winner,
    ...(input.deadline ? { deadline: input.deadline } : {}),
    film_type: input.film_type ?? "self_record",
    assigned_at: now,
    created_by_name: input.created_by_name,
    created_at: now,
  });
  return { bunch: mapBunch(row), researcher };
}

export async function addIdea(input: {
  bunch_id: string;
  platform: IdeaPlatform;
  idea_text: string;
  reference_link?: string;
}): Promise<ResearchIdea> {
  const row = await sbInsert<IdeaRow>(IDEAS, {
    idea_id: `ri_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    bunch_id: input.bunch_id,
    platform: input.platform,
    idea_text: input.idea_text,
    ...(input.reference_link ? { reference_link: input.reference_link } : {}),
    checked: false,
    created_at: new Date().toISOString(),
  });
  return mapIdea(row);
}

export async function deleteIdea(ideaId: string): Promise<void> {
  await sbDeleteByPublicId(IDEAS, ideaId);
}

export async function submitBunch(bunchId: string): Promise<void> {
  await sbUpdateByPublicId<BunchRow>(BUNCHES, bunchId, {
    status: "awaiting_qa",
    submitted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function setIdeaChecked(ideaId: string, checked: boolean): Promise<void> {
  await sbUpdateByPublicId<IdeaRow>(IDEAS, ideaId, {
    checked,
    updated_at: new Date().toISOString(),
  });
}

export async function requestChanges(
  bunchId: string,
  qa: { user_id: string; name: string },
  note?: string
): Promise<void> {
  await sbUpdateByPublicId<BunchRow>(BUNCHES, bunchId, {
    status: "changes_requested",
    qa_by_user_id: qa.user_id,
    qa_by_name: qa.name,
    ...(note ? { qa_note: note } : {}),
    updated_at: new Date().toISOString(),
  });
}

export async function approveBunch(
  bunch: ResearchBunch,
  qa: { user_id: string; name: string }
): Promise<{ spawned: number }> {
  const ideas = await listIdeasForBunch(bunch.id);
  if (ideas.length === 0) throw new Error("Το bunch δεν έχει ιδέες.");
  const unchecked = ideas.filter((i) => !i.checked);
  if (unchecked.length > 0) {
    throw new Error(`${unchecked.length} ιδέες δεν είναι ✓ ακόμα.`);
  }
  let spawned = 0;
  for (const idea of ideas) {
    if (idea.spawned_item_id) continue;
    const item = await spawnContentItem({
      title: idea.idea_text.slice(0, 120) || "Untitled idea",
      creator_model_id: bunch.creator_model_id,
      creator_name: bunch.creator_name,
      week: bunch.week,
      source: "research",
      research_idea_id: idea.id,
      ...(bunch.film_type ? { film_type: bunch.film_type as "self_record" | "filmer" } : {}),
      ...(bunch.deadline ? { deadline: bunch.deadline } : {}),
      stage: "creative",
      actor_user_id: qa.user_id,
      actor_name: qa.name,
    });
    await sbUpdateByPublicId<IdeaRow>(IDEAS, idea.id, {
      spawned_item_id: item.id,
      updated_at: new Date().toISOString(),
    });
    spawned += 1;
  }
  await sbUpdateByPublicId<BunchRow>(BUNCHES, bunch.id, {
    status: "approved",
    approved_at: new Date().toISOString(),
    qa_by_user_id: qa.user_id,
    qa_by_name: qa.name,
    updated_at: new Date().toISOString(),
  });
  return { spawned };
}
