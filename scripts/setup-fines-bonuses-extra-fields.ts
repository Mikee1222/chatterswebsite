#!/usr/bin/env tsx
/**
 * Adds extra-revenue review fields to fines_and_bonuses (Metadata API).
 * Usage: npx tsx scripts/setup-fines-bonuses-extra-fields.ts
 */
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
  const tablesData = await tablesRes.json() as { tables?: { id: string; name: string; fields?: { name: string }[] }[] };
  const table = tablesData.tables?.find((t) => t.name === "fines_and_bonuses");
  if (!table) { console.error("fines_and_bonuses not found"); process.exit(1); }

  const existing = new Set((table.fields ?? []).map((f) => f.name));

  const fields: Record<string, unknown>[] = [
    {
      name: "category",
      type: "singleSelect",
      options: { choices: [{ name: "extra_revenue" }, { name: "standard" }] },
    },
    {
      name: "status",
      type: "singleSelect",
      options: {
        choices: [
          { name: "pending_review" },
          { name: "approved" },
          { name: "rejected" },
        ],
      },
    },
    {
      name: "source",
      type: "singleSelect",
      options: {
        choices: [
          { name: "chatter_submission" },
          { name: "admin" },
          { name: "spin_wheel" },
        ],
      },
    },
    {
      name: "payment_method",
      type: "singleSelect",
      options: {
        choices: [{ name: "PayPal" }, { name: "Revolut" }, { name: "Other" }],
      },
    },
    { name: "payment_source", type: "singleLineText" },
    { name: "model_id", type: "singleLineText" },
    { name: "model_name", type: "singleLineText" },
    { name: "screenshot_url", type: "url" },
  ];

  for (const field of fields) {
    const name = field.name as string;
    if (existing.has(name)) {
      console.log(`⏭ Already exists: ${name}`);
      continue;
    }
    const res = await fetch(`${META}/bases/${BASE_ID}/tables/${table.id}/fields`, {
      method: "POST",
      headers: H,
      body: JSON.stringify(field),
    });
    const data = await res.json() as { error?: { message?: string } };
    if (res.ok) {
      console.log(`✅ Created: ${name}`);
      existing.add(name);
    } else {
      console.log(`⚠️ ${name}: ${data.error?.message ?? res.status}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log("Done!");
}

main().catch(console.error);
