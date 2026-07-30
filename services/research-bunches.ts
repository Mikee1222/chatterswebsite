import {
  listAllRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { spawnContentItem } from "@/services/content-items";

const BUNCHES = "research_bunches";
const IDEAS = "research_ideas";

export type BunchStatus = "draft" | "awaiting_qa" | "changes_requested" | "approved";
export type IdeaPlatform = "IG" | "TT" | "both";

type BunchFields = {
  bunch_id?: string;
  creator_model_id?: string;
  creator_name?: string;
  researcher_user_id?: string;
  researcher_name?: string;
  week?: string;
  status?: string;
  qa_by_user_id?: string;
  qa_by_name?: string;
  submitted_at?: string;
  approved_at?: string;
  created_at?: string;
};

type IdeaFields = {
  idea_id?: string;
  bunch_id?: string;
  platform?: string;
  idea_text?: string;
  reference_link?: string;
  checked?: boolean;
  qa_note?: string;
  spawned_item_id?: string;
  created_at?: string;
};

export type ResearchBunch = {
  id: string;
  creator_model_id: string;
  creator_name: string;
  researcher_user_id: string;
  researcher_name: string;
  week: string;
  status: BunchStatus;
  qa_by_name: string;
};

export type ResearchIdea = {
  id: string;
  bunch_id: string;
  platform: string;
  idea_text: string;
  reference_link: string;
  checked: boolean;
  qa_note: string;
  spawned_item_id: string;
};

function q(v: string): string {
  return v.replace(/"/g, '""');
}

function mapBunch(rec: AirtableRecord<BunchFields>): ResearchBunch {
  const f = rec.fields;
  return {
    id: rec.id,
    creator_model_id: f.creator_model_id ?? "",
    creator_name: f.creator_name ?? "",
    researcher_user_id: f.researcher_user_id ?? "",
    researcher_name: f.researcher_name ?? "",
    week: f.week ?? "",
    status: (f.status as BunchStatus) ?? "draft",
    qa_by_name: f.qa_by_name ?? "",
  };
}

function mapIdea(rec: AirtableRecord<IdeaFields>): ResearchIdea {
  const f = rec.fields;
  return {
    id: rec.id,
    bunch_id: f.bunch_id ?? "",
    platform: f.platform ?? "IG",
    idea_text: f.idea_text ?? "",
    reference_link: f.reference_link ?? "",
    checked: f.checked ?? false,
    qa_note: f.qa_note ?? "",
    spawned_item_id: f.spawned_item_id ?? "",
  };
}

export async function listBunchesForResearcher(researcherRecId: string): Promise<ResearchBunch[]> {
  const records = await listAllRecords<BunchFields>(BUNCHES, {
    filterByFormula: `{researcher_user_id} = "${q(researcherRecId)}"`,
  });
  return records.map(mapBunch);
}

export async function getBunchById(bunchId: string): Promise<ResearchBunch | null> {
  try {
    return mapBunch(await getRecord<BunchFields>(BUNCHES, bunchId));
  } catch {
    return null;
  }
}

export async function listBunchesAwaitingQa(): Promise<ResearchBunch[]> {
  const records = await listAllRecords<BunchFields>(BUNCHES, {
    filterByFormula: `{status} = "awaiting_qa"`,
  });
  return records.map(mapBunch);
}

export async function listIdeasForBunch(bunchRecId: string): Promise<ResearchIdea[]> {
  const records = await listAllRecords<IdeaFields>(IDEAS, {
    filterByFormula: `{bunch_id} = "${q(bunchRecId)}"`,
  });
  return records.map(mapIdea);
}

export async function createBunch(input: {
  creator_model_id: string;
  creator_name: string;
  researcher_user_id: string;
  researcher_name: string;
  week: string;
}): Promise<ResearchBunch> {
  const now = new Date().toISOString();
  const rec = await createRecord<BunchFields>(BUNCHES, {
    bunch_id: `rb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ...input,
    status: "draft",
    created_at: now,
  });
  return mapBunch(rec);
}

export async function addIdea(input: {
  bunch_id: string;
  platform: IdeaPlatform;
  idea_text: string;
  reference_link?: string;
}): Promise<ResearchIdea> {
  const rec = await createRecord<IdeaFields>(IDEAS, {
    idea_id: `ri_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    bunch_id: input.bunch_id,
    platform: input.platform,
    idea_text: input.idea_text,
    ...(input.reference_link ? { reference_link: input.reference_link } : {}),
    checked: false,
    created_at: new Date().toISOString(),
  });
  return mapIdea(rec);
}

export async function deleteIdea(ideaId: string): Promise<void> {
  await deleteRecord(IDEAS, ideaId);
}

export async function submitBunch(bunchId: string): Promise<void> {
  await updateRecord<BunchFields>(BUNCHES, bunchId, {
    status: "awaiting_qa",
    submitted_at: new Date().toISOString(),
  });
}

export async function setIdeaChecked(ideaId: string, checked: boolean): Promise<void> {
  await updateRecord<IdeaFields>(IDEAS, ideaId, { checked });
}

export async function requestChanges(
  bunchId: string,
  qa: { user_id: string; name: string },
  note?: string
): Promise<void> {
  await updateRecord<BunchFields>(BUNCHES, bunchId, {
    status: "changes_requested",
    qa_by_user_id: qa.user_id,
    qa_by_name: qa.name,
  });
  if (note) {
    // Store the QA note on the first idea lacking one, or ignore — kept lightweight.
  }
}

/**
 * Approve a bunch: requires ALL ideas checked. Spawns one content_item (Creative stage)
 * per not-yet-spawned idea, links it back, and marks the bunch approved.
 */
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
      stage: "creative",
      actor_user_id: qa.user_id,
      actor_name: qa.name,
    });
    await updateRecord<IdeaFields>(IDEAS, idea.id, { spawned_item_id: item.id });
    spawned += 1;
  }

  await updateRecord<BunchFields>(BUNCHES, bunch.id, {
    status: "approved",
    approved_at: new Date().toISOString(),
    qa_by_user_id: qa.user_id,
    qa_by_name: qa.name,
  });
  return { spawned };
}
