#!/usr/bin/env npx tsx
/**
 * Seeds default rows into mistake_reasons (idempotent if reason_id already present).
 * Run after: npx tsx scripts/create-mistakes-tables.ts
 *
 * Usage: npx tsx scripts/seed-mistake-reasons.ts
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const TABLE = "mistake_reasons";

type ReasonSeed = { label: string; category: "Low" | "Medium" | "High"; points: number };

const reasons: ReasonSeed[] = [
  { label: "Cold Tone", category: "Low", points: 5 },
  { label: "Not answering in 4 min (SEXTING)", category: "Low", points: 5 },
  { label: "Bad PPV Caption", category: "Low", points: 5 },
  { label: "PPV Spam", category: "Low", points: 5 },
  { label: "Not using his name in the right situations", category: "Low", points: 5 },
  { label: "Not acting like a real person and acting like a robot", category: "Medium", points: 10 },
  { label: "Not updating notes after getting info", category: "Medium", points: 10 },
  { label: "Not updating the lists", category: "Medium", points: 10 },
  { label: "Messing up Personality & Identity", category: "Medium", points: 10 },
  { label: "Not getting enough info", category: "Medium", points: 10 },
  { label: "Rushing up the sale", category: "Medium", points: 10 },
  { label: "Not Doing Aftercare", category: "Medium", points: 10 },
  { label: "Messing up the script", category: "Medium", points: 10 },
  { label: "Wrong Emotional Behavior", category: "Medium", points: 10 },
  { label: "Missed Whale Signal", category: "Medium", points: 10 },
  { label: "Forgets past context", category: "Medium", points: 10 },
  { label: "Missed emotional hook", category: "Medium", points: 10 },
  { label: "Bad KIPS", category: "Medium", points: 10 },
  { label: "Messing up the prices", category: "High", points: 20 },
  { label: "Talking to Case Study Whale", category: "High", points: 20 },
  { label: "Forcing the chat to be sexualized", category: "High", points: 20 },
  { label: "Not Respecting the Customer (by insulting)", category: "High", points: 20 },
  { label: "Oversexual Behavior", category: "High", points: 20 },
  { label: "Being Greedy", category: "High", points: 20 },
  { label: "Giving Up too quick", category: "High", points: 20 },
  { label: "Didn't report new whale", category: "High", points: 20 },
  { label: "Other", category: "Low", points: 5 },
];

async function airtableListAllRecordIds(baseId: string, token: string): Promise<string[]> {
  const ids: string[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLE)}`);
    url.searchParams.set("fields[]", "reason_id");
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`List ${TABLE}: ${res.status} ${t}`);
    }
    const json = (await res.json()) as { records?: { id: string }[]; offset?: string };
    for (const r of json.records ?? []) ids.push(r.id);
    offset = json.offset;
  } while (offset);
  return ids;
}

async function main() {
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();
  const token = process.env.AIRTABLE_TOKEN?.trim();
  if (!baseId || !token) throw new Error("Missing AIRTABLE_BASE_ID or AIRTABLE_TOKEN");

  const existingIds = await airtableListAllRecordIds(baseId, token);
  if (existingIds.length > 0) {
    console.log(`mistake_reasons already has ${existingIds.length} row(s). Skipping seed (delete rows first to re-seed).`);
    return;
  }

  const now = new Date().toISOString();
  const records = reasons.map((r, i) => {
    const sort_order = i + 1;
    const reason_id = `mr_${String(sort_order).padStart(3, "0")}`;
    return {
      fields: {
        reason_id,
        label: r.label,
        category: r.category,
        points_deduction: r.points,
        active: true,
        sort_order,
      },
    };
  });

  const chunkSize = 10;
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const res = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLE)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ records: chunk }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("Batch create failed:", res.status, data);
      throw new Error(JSON.stringify(data));
    }
    console.log(`Inserted ${chunk.length} reason(s) (${i + 1}–${i + chunk.length} of ${records.length}).`);
  }

  console.log(`Seeded ${records.length} mistake reasons. (${now})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
