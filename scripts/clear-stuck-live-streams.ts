#!/usr/bin/env tsx
import { config as loadEnv } from "dotenv";
loadEnv();
loadEnv({ path: ".env.local" });

const TOKEN = process.env.AIRTABLE_TOKEN?.trim();
const BASE_ID = process.env.AIRTABLE_BASE_ID?.trim();
const API = `https://api.airtable.com/v0/${BASE_ID}`;
const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

async function main() {
  const res = await fetch(`${API}/model_live_streams?filterByFormula=AND(OR({status}="in_progress",{status}="live"),{actual_end}="")`, { headers: H });
  const data = await res.json() as any;
  console.log("Stuck streams:", data.records?.length ?? 0);

  for (const rec of data.records ?? []) {
    console.log("Ending stuck stream:", rec.id, "status:", rec.fields.status);
    const patch = await fetch(`${API}/model_live_streams/${rec.id}`, {
      method: "PATCH",
      headers: H,
      body: JSON.stringify({ fields: { status: "ended", actual_end: new Date().toISOString() } }),
    });
    if (patch.ok) console.log("✅ Ended:", rec.id);
    else console.error("❌ Failed:", await patch.text());
    await new Promise(r => setTimeout(r, 250));
  }
  console.log("Done!");
}
main().catch(console.error);
