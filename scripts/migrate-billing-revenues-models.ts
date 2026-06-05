#!/usr/bin/env tsx
import { config as loadEnv } from "dotenv";
loadEnv();
loadEnv({ path: ".env.local" });

const TOKEN = process.env.AIRTABLE_TOKEN?.trim();
const BASE_ID = process.env.AIRTABLE_BASE_ID?.trim();
if (!TOKEN || !BASE_ID) { console.error("Missing env vars"); process.exit(1); }

const API = `https://api.airtable.com/v0/${BASE_ID}`;
const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

// Old models ID → New modelss ID
const ID_MAP: Record<string, string> = {
  "rec1V2Aal3PcNDOi7": "rec3LzkuHyMkUgb4m", // Stella
  "rec3JLkQ9JNO17ITN": "recG1jdOuQAE5UV2Y", // Elisavet
  "rec6iQfOQNQ8kA6Yu": "rec7jwVGwQZ5uYXKl", // Eirini
  "rec712WdB8YDYhmKX": "recRYzE3HViBXRl0k", // Stefania
  "recEakQudtDu2mAXh": "recOzM1qmbUIzWUiR", // Dianna
  "recXyCWkn7DJdwJww": "recq7xz385YNmqqE2", // Chrysa
  "recdpfsdMj23DUjtP": "rec0IuyyDDK9AgmAd", // Gavriela
  "recjPl9hZUUSY9tiM": "rec2LJI8PmRlHE9q5", // Katerina
  "recpkcwVp3WbmhQuS": "recxGew2CD6UlBoPf", // Ariandi
  "recsKwb77cVRaaeh2": "recgmObP5ezDeEPDs", // Marilia
  "rectOlVIdPaHzdyXK": "rec4xhKEJllCmeDjC", // Antigoni
  // Erina, Eva, Theano — stopped, no mapping needed
};

async function listAll(table: string): Promise<any[]> {
  const out: any[] = [];
  let offset: string | undefined;
  for (;;) {
    const qs = new URLSearchParams({ pageSize: "100" });
    if (offset) qs.set("offset", offset);
    const res = await fetch(`${API}/${encodeURIComponent(table)}?${qs}`, { headers: H });
    const data = await res.json() as any;
    out.push(...data.records);
    if (!data.offset) break;
    offset = data.offset;
    await new Promise(r => setTimeout(r, 250));
  }
  return out;
}

async function main() {
  console.log("Fetching billing_cycle_revenues...");
  const revenues = await listAll("billing_cycle_revenues");
  console.log(`Found ${revenues.length} revenue records`);

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const rec of revenues) {
    const modelIds: string[] = Array.isArray(rec.fields.model) ? rec.fields.model : [];
    if (modelIds.length === 0) { skipped++; continue; }

    const oldId = modelIds[0];
    const newId = ID_MAP[oldId];

    if (!newId) {
      // Already pointing to modelss or inactive model
      if (Object.values(ID_MAP).includes(oldId)) {
        skipped++; // Already migrated
      } else {
        console.log(`  NO MAPPING for ${oldId} in record ${rec.id}`);
        notFound++;
      }
      continue;
    }

    const res = await fetch(`${API}/billing_cycle_revenues/${rec.id}`, {
      method: "PATCH",
      headers: H,
      body: JSON.stringify({ fields: { model: [newId] } }),
    });

    if (res.ok) {
      console.log(`  ✅ ${rec.id}: ${oldId} → ${newId}`);
      updated++;
    } else {
      console.error(`  ❌ ${rec.id}: ${await res.text()}`);
    }

    await new Promise(r => setTimeout(r, 220));
  }

  console.log(`\n✅ Done: ${updated} updated, ${skipped} skipped, ${notFound} no mapping`);
}

main().catch(e => { console.error(e); process.exit(1); });
