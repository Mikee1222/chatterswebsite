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
  const clientsTable = tablesData.tables.find(t => t.name === "clients");
  if (!clientsTable) { console.error("clients table not found"); process.exit(1); }

  const fields = [
    { name: "telegram_group_link", type: "url", description: "Client Telegram group link" },
    { name: "telegram_group_name", type: "singleLineText", description: "Client Telegram group name" },
  ];

  for (const field of fields) {
    const res = await fetch(`${META}/bases/${BASE_ID}/tables/${clientsTable.id}/fields`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ name: field.name, type: field.type }),
    });
    const data = await res.json();
    if (res.ok) console.log(`✅ Created field: ${field.name}`);
    else console.log(`⚠️ Field ${field.name}: ${JSON.stringify(data.error)}`);
    await new Promise(r => setTimeout(r, 300));
  }
  console.log("Done!");
}
main().catch(console.error);
