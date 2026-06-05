#!/usr/bin/env tsx
import { config as loadEnv } from "dotenv";
loadEnv();
loadEnv({ path: ".env.local" });

const TOKEN = process.env.AIRTABLE_TOKEN?.trim();
const BASE_ID = process.env.AIRTABLE_BASE_ID?.trim();
if (!TOKEN || !BASE_ID) { console.error("Missing env vars"); process.exit(1); }

const API = `https://api.airtable.com/v0/${BASE_ID}`;
const H = { Authorization: `Bearer ${TOKEN}` };

async function listAll(): Promise<any[]> {
  const out: any[] = [];
  let offset: string | undefined;
  for (;;) {
    const qs = new URLSearchParams({ pageSize: "100" });
    if (offset) qs.set("offset", offset);
    const res = await fetch(`${API}/payment_submissions?${qs}`, { headers: H });
    const data = await res.json() as any;
    if (data.error) { console.error("Error:", data.error); break; }
    out.push(...(data.records ?? []));
    if (!data.offset) break;
    offset = data.offset;
    await new Promise(r => setTimeout(r, 250));
  }
  return out;
}

const all = await listAll();
console.log("Total records:", all.length);

const pending = all.filter(r => r.fields.status === "pending_review");
console.log("Pending review count:", pending.length);
pending.forEach((r: any) => {
  console.log("Pending:", r.id, "client:", JSON.stringify(r.fields.client));
});
