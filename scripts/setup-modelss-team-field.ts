#!/usr/bin/env tsx
import { config as loadEnv } from "dotenv";
loadEnv();
loadEnv({ path: ".env.local" });

const TOKEN = process.env.AIRTABLE_TOKEN?.trim();
const BASE_ID = process.env.AIRTABLE_BASE_ID?.trim();

if (!TOKEN || !BASE_ID) {
  console.error("Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID");
  process.exit(1);
}

const METADATA_BASE = "https://api.airtable.com/v0/meta";
const DATA_BASE = `https://api.airtable.com/v0/${BASE_ID}`;
const TABLE_NAME = "modelss";

async function getTableId(): Promise<string> {
  const res = await fetch(`${METADATA_BASE}/bases/${BASE_ID}/tables`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const data = await res.json() as { tables: { id: string; name: string }[] };
  const table = data.tables.find((t) => t.name === TABLE_NAME);
  if (!table) throw new Error(`Table ${TABLE_NAME} not found`);
  return table.id;
}

async function addTeamField(tableId: string): Promise<void> {
  console.log("Adding 'team' field to modelss...");
  const res = await fetch(`${METADATA_BASE}/bases/${BASE_ID}/tables/${tableId}/fields`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "team",
      type: "singleSelect",
      options: {
        choices: [
          { name: "gunzo_team", color: "blueBright" },
          { name: "chatting_agency", color: "purpleBright" },
        ],
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    // Field may already exist
    if (err.includes("already exists") || err.includes("DUPLICATE")) {
      console.log("Field 'team' already exists, skipping creation.");
      return;
    }
    throw new Error(`Failed to add field: ${err}`);
  }
  console.log("✅ Field 'team' added successfully.");
}

async function listAllRecords(): Promise<{ id: string; fields: { team?: string } }[]> {
  const out: { id: string; fields: { team?: string } }[] = [];
  let offset: string | undefined;
  for (;;) {
    const qs = new URLSearchParams({ pageSize: "100" });
    if (offset) qs.set("offset", offset);
    const res = await fetch(`${DATA_BASE}/${encodeURIComponent(TABLE_NAME)}?${qs}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const data = await res.json() as { records: { id: string; fields: { team?: string } }[]; offset?: string };
    out.push(...data.records);
    if (!data.offset) break;
    offset = data.offset;
  }
  return out;
}

async function patchRecord(id: string, team: string): Promise<void> {
  const res = await fetch(`${DATA_BASE}/${encodeURIComponent(TABLE_NAME)}/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: { team } }),
  });
  if (!res.ok) {
    console.error(`Failed to patch ${id}: ${await res.text()}`);
  }
}

async function main(): Promise<void> {
  const tableId = await getTableId();
  await addTeamField(tableId);
  
  console.log("Fetching all modelss records...");
  const records = await listAllRecords();
  console.log(`Found ${records.length} records. Setting default team=gunzo_team for records without team...`);
  
  let updated = 0;
  for (const rec of records) {
    if (!rec.fields.team) {
      await patchRecord(rec.id, "gunzo_team");
      updated++;
      // Rate limit: 5 req/sec
      await new Promise((r) => setTimeout(r, 220));
    }
  }
  
  console.log(`✅ Done. Updated ${updated} records with team=gunzo_team. ${records.length - updated} already had team set.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
