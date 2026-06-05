#!/usr/bin/env tsx
import { config as loadEnv } from "dotenv";
loadEnv();
loadEnv({ path: ".env.local" });

const TOKEN = process.env.AIRTABLE_TOKEN?.trim();
const BASE_ID = process.env.AIRTABLE_BASE_ID?.trim();
if (!TOKEN || !BASE_ID) { console.error("Missing env vars"); process.exit(1); }

const META = `https://api.airtable.com/v0/meta`;
const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

async function main() {
  const tablesRes = await fetch(`${META}/bases/${BASE_ID}/tables`, { headers: H });
  const tablesData = await tablesRes.json() as { tables: { id: string; name: string }[] };
  const usersTable = tablesData.tables.find(t => t.name === "users");
  if (!usersTable) { console.error("users table not found"); process.exit(1); }

  const res = await fetch(`${META}/bases/${BASE_ID}/tables/${usersTable.id}/fields`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ name: "telegram_username", type: "singleLineText" }),
  });
  const data = await res.json();
  if (res.ok) console.log("✅ Created field: telegram_username");
  else console.log(`⚠️ ${JSON.stringify(data.error)}`);

  // Pre-populate existing chatters
  const API = `https://api.airtable.com/v0/${BASE_ID}`;
  const KNOWN: Record<string, string> = {
    "Hlias Zarifes": "elias_drag",
    "Edgar": "Edgar200055",
    "Giannis Katsikas": "giannhskts",
    "Apostolis": "apo_dl",
    "Anastasis Haroupas": "Anastasiss99",
  };

  // Fetch all users
  const usersRes = await fetch(`${API}/users?pageSize=100`, { headers: H });
  const usersData = await usersRes.json() as { records: { id: string; fields: { full_name?: string } }[] };

  for (const rec of usersData.records) {
    const name = rec.fields.full_name ?? "";
    const tg = KNOWN[name];
    if (!tg) continue;

    const patchRes = await fetch(`${API}/users/${rec.id}`, {
      method: "PATCH",
      headers: H,
      body: JSON.stringify({ fields: { telegram_username: tg } }),
    });
    if (patchRes.ok) console.log(`✅ Set ${name} → @${tg}`);
    else console.error(`❌ Failed ${name}: ${await patchRes.text()}`);
    await new Promise(r => setTimeout(r, 250));
  }
  console.log("Done!");
}
main().catch(console.error);
