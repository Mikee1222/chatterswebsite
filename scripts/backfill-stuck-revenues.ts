#!/usr/bin/env tsx
import { config as loadEnv } from "dotenv";
loadEnv();
loadEnv({ path: ".env.local" });

const TOKEN = process.env.AIRTABLE_TOKEN?.trim();
const BASE_ID = process.env.AIRTABLE_BASE_ID?.trim();
if (!TOKEN || !BASE_ID) { console.error("Missing env vars"); process.exit(1); }

const API = `https://api.airtable.com/v0/${BASE_ID}`;
const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

// The 6 stuck revenue IDs
const STUCK_IDS = [
  "rec2HdWvWNpYCrSM3",
  "rec7FKXz0kDGDwu8y",
  "recJxfwFN0WodDGZQ",
  "recYeOi2xEgiLX51l",
  "recToweTnJivAyDTU",
  "recCeG6yrCFc68L5t",
];

for (const id of STUCK_IDS) {
  const res = await fetch(`${API}/billing_cycle_revenues/${id}`, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({ fields: { status: "confirmed_paid" } }),
  });
  if (res.ok) console.log(`✅ ${id} → confirmed_paid`);
  else console.error(`❌ ${id}: ${await res.text()}`);
  await new Promise(r => setTimeout(r, 250));
}

// Also update the billing cycle status
const CYCLE_ID = "recZset4yA6TGUdqJ";
const cycleRes = await fetch(`${API}/billing_cycles/${CYCLE_ID}`, {
  method: "PATCH",
  headers: H,
  body: JSON.stringify({ fields: { status: "confirmed_paid" } }),
});
if (cycleRes.ok) console.log(`✅ Cycle ${CYCLE_ID} → confirmed_paid`);
else console.error(`❌ Cycle: ${await cycleRes.text()}`);

console.log("Done!");
