#!/usr/bin/env tsx
import { config as loadEnv } from "dotenv";
loadEnv();
loadEnv({ path: ".env.local" });

const TOKEN = process.env.AIRTABLE_TOKEN?.trim();
const BASE_ID = process.env.AIRTABLE_BASE_ID?.trim();

async function main() {
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
  const data = await res.json() as any;
  const table = data.tables.find((t: any) => t.name === "billing_cycle_revenues");
  const modelField = table?.fields.find((f: any) => f.name === "model");
  console.log("model field linkedTableId:", modelField?.options?.linkedTableId);
  console.log("modelss table id:", data.tables.find((t: any) => t.name === "modelss")?.id);
  console.log("old models table id:", data.tables.find((t: any) => t.name === "models")?.id);
}

main().catch(console.error);
