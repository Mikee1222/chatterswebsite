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
  const tablesData = await tablesRes.json() as { tables?: { id: string; name: string }[] };
  const modelssTable = tablesData.tables?.find((t) => t.name === "modelss");
  if (!modelssTable) { console.error("modelss not found"); process.exit(1); }

  const fields = [
    { name: "paypal_email", type: "singleLineText" },
    { name: "paypal_link", type: "url" },
    { name: "revolut_tag", type: "singleLineText" },
    { name: "payment_notes", type: "multilineText" },
    { name: "payment_threshold_eur", type: "number", options: { precision: 0 } },
  ];

  for (const field of fields) {
    const res = await fetch(`${META}/bases/${BASE_ID}/tables/${modelssTable.id}/fields`, {
      method: "POST",
      headers: H,
      body: JSON.stringify(field),
    });
    const data = await res.json() as { error?: { message?: string } };
    if (res.ok) console.log(`✅ Created: ${field.name}`);
    else console.log(`⚠️ ${field.name}: ${data.error?.message ?? res.status}`);
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log("Done!");
}

main().catch(console.error);
