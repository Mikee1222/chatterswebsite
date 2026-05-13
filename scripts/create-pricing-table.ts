#!/usr/bin/env npx tsx
/**
 * Creates `pricing_rows` + `pricing_specials` (Metadata API) and seeds (Data API).
 *
 * Usage: npx tsx scripts/create-pricing-table.ts
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const ROWS_TABLE = "pricing_rows";
const SPECIALS_TABLE = "pricing_specials";

type MetaTable = { id: string; name: string };
const checkboxOpts = { icon: "check" as const, color: "greenBright" as const };

type Mt = "high" | "medium" | "low";
type St = "high" | "medium" | "low" | "medium_low";

type RowSeed = {
  model_tier: Mt;
  spender_tier: St;
  video_number: number;
  price_normal: string;
  price_negotiation: string;
  description: string;
  notes: string;
};

async function metaFetch(path: string, init?: RequestInit): Promise<Response> {
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();
  const token = process.env.AIRTABLE_TOKEN?.trim();
  if (!baseId || !token) throw new Error("Missing AIRTABLE_BASE_ID or AIRTABLE_TOKEN");
  return fetch(`https://api.airtable.com/v0/meta/bases/${baseId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

async function dataFetch(path: string, init?: RequestInit): Promise<Response> {
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();
  const token = process.env.AIRTABLE_TOKEN?.trim();
  if (!baseId || !token) throw new Error("Missing AIRTABLE_BASE_ID or AIRTABLE_TOKEN");
  return fetch(`https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

async function listTables(): Promise<MetaTable[]> {
  const res = await metaFetch("/tables");
  const data = (await res.json()) as { tables?: MetaTable[]; error?: unknown };
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data.tables ?? [];
}

async function tableEmpty(name: string): Promise<boolean> {
  const q = new URLSearchParams({ pageSize: "1", maxRecords: "1" });
  const res = await dataFetch(`${encodeURIComponent(name)}?${q.toString()}`);
  const data = (await res.json()) as { records?: unknown[] };
  if (!res.ok) throw new Error(await res.text());
  return (data.records?.length ?? 0) === 0;
}

async function createRowsTable(): Promise<void> {
  const body = {
    name: ROWS_TABLE,
    description: "Per-model-tier × spender-tier video pricing grid.",
    fields: [
      {
        name: "row_key",
        type: "singleLineText",
        description: "Stable primary label: model_tier|spender_tier|video_number (required by Airtable primary field).",
      },
      {
        name: "model_tier",
        type: "singleSelect",
        options: {
          choices: [
            { name: "high", color: "yellowBright" },
            { name: "medium", color: "blueLight2" },
            { name: "low", color: "grayLight2" },
          ],
        },
      },
      {
        name: "spender_tier",
        type: "singleSelect",
        options: {
          choices: [
            { name: "high", color: "greenLight2" },
            { name: "medium", color: "cyanLight2" },
            { name: "low", color: "orangeLight2" },
            { name: "medium_low", color: "purpleLight2" },
          ],
        },
      },
      { name: "video_number", type: "number", options: { precision: 0 } },
      { name: "price_normal", type: "singleLineText" },
      { name: "price_negotiation", type: "singleLineText" },
      { name: "description", type: "multilineText" },
      { name: "notes", type: "multilineText" },
      { name: "is_active", type: "checkbox", options: checkboxOpts },
      { name: "sort_order", type: "number", options: { precision: 0 } },
    ],
  };
  const res = await metaFetch("/tables", { method: "POST", body: JSON.stringify(body) });
  const data = (await res.json()) as { error?: unknown };
  if (!res.ok) throw new Error(JSON.stringify(data));
  console.log(`Created table: ${ROWS_TABLE}`);
}

async function createSpecialsTable(): Promise<void> {
  const body = {
    name: SPECIALS_TABLE,
    description: "Special pricing rows (sextape, customs, video calls).",
    fields: [
      { name: "label", type: "singleLineText" },
      { name: "price_normal", type: "singleLineText" },
      { name: "price_negotiation", type: "singleLineText" },
      { name: "description", type: "multilineText" },
      { name: "models_applicable", type: "singleLineText" },
      { name: "is_active", type: "checkbox", options: checkboxOpts },
      { name: "sort_order", type: "number", options: { precision: 0 } },
    ],
  };
  const res = await metaFetch("/tables", { method: "POST", body: JSON.stringify(body) });
  const data = (await res.json()) as { error?: unknown };
  if (!res.ok) throw new Error(JSON.stringify(data));
  console.log(`Created table: ${SPECIALS_TABLE}`);
}

function buildAllRowSeeds(): RowSeed[] {
  const highHigh: Omit<RowSeed, "model_tier" | "spender_tier">[] = [
    { video_number: 1, price_normal: "25 – 40", price_negotiation: "22 – 30", description: "Με ρούχα, τρίβεσαι, sexy κινήσεις, λίγο tease.", notes: "" },
    { video_number: 2, price_normal: "50 – 75", price_negotiation: "45 – 60", description: "Γδύσιμο, δείχνεις στήθος", notes: "" },
    { video_number: 3, price_normal: "100 – 130", price_negotiation: "85 – 115", description: "Γυμνή, τρίβεσαι ή στοματικό σε dildo.", notes: "" },
    { video_number: 4, price_normal: "150 – 180", price_negotiation: "130 – 160", description: "Παίζει με το μουνί της / τρίβει πούτσα", notes: "" },
    { video_number: 5, price_normal: "200 – 250", price_negotiation: "170 – 220", description: "Δονητής μέσα σε μουνί, σε τρανς πίσω τρύπα", notes: "" },
    { video_number: 6, price_normal: "300+", price_negotiation: "270+", description: "Χύνεις", notes: "" },
  ];
  const highMed: Omit<RowSeed, "model_tier" | "spender_tier">[] = [
    { video_number: 1, price_normal: "15 – 20", price_negotiation: "TW", description: "Με ρούχα, τρίβεσαι, sexy κινήσεις, λίγο tease.", notes: "" },
    { video_number: 2, price_normal: "34 – 40", price_negotiation: "TW", description: "Γδύσιμο, δείχνεις στήθος", notes: "" },
    {
      video_number: 3,
      price_normal: "58 – 60",
      price_negotiation: "48 – 54",
      description: "Γυμνή, τρίβεσαι ή στοματικό σε dildo.",
      notes: "Μπορείς να δώσεις και δώρο φωτό στο negotiation (nude no pussy)",
    },
    {
      video_number: 4,
      price_normal: "95 – 102",
      price_negotiation: "79 – 83",
      description: "Παίζει με το μουνί της / τρίβει πούτσα",
      notes: "Μπορείς να δώσεις και δώρο φωτό στο negotiation (nude, no pussy)",
    },
    {
      video_number: 5,
      price_normal: "148 – 162",
      price_negotiation: "105 – 120",
      description: "Δονητής μέσα σε μουνί, σε τρανς πίσω τρύπα",
      notes: "Μπορείς να δώσεις και δώρο βίντεο μικρής διάρκειας τύπου mass message",
    },
    {
      video_number: 6,
      price_normal: "200+",
      price_negotiation: "185 – 199",
      description: "Χύνεις",
      notes: "Μπορείς να δώσεις δώρο βιντεάκι παλιό 1 λεπτό",
    },
  ];
  const highLow: Omit<RowSeed, "model_tier" | "spender_tier">[] = [
    { video_number: 1, price_normal: "6 – 8", price_negotiation: "TW", description: "Φωτό όχι nude με εσώρουχα", notes: "" },
    { video_number: 2, price_normal: "12 – 16", price_negotiation: "TW", description: "Παλιό σκριπτ — Με ρούχα, τρίβεσαι, sexy κινήσεις, λίγο tease.", notes: "" },
    { video_number: 3, price_normal: "18 – 24", price_negotiation: "TW", description: "Παλιό σκριπτ — Γδύσιμο, δείχνεις στήθος", notes: "" },
    { video_number: 4, price_normal: "28 – 35", price_negotiation: "TW", description: "Παλιό σκριπτ — Γυμνή, τρίβεσαι ή στοματικό σε dildo.", notes: "" },
    { video_number: 5, price_normal: "54 – 69", price_negotiation: "42 – 49", description: "Παλιό σκριπτ — Παίζει με το μουνί της / τρίβει πούτσα", notes: "" },
    { video_number: 6, price_normal: "85 – 102", price_negotiation: "78 – 83", description: "Παλιό σκριπτ — Δονητής μέσα σε μουνί, σε τρανς πίσω τρύπα", notes: "" },
    { video_number: 7, price_normal: "120 – 150", price_negotiation: "105 – 115", description: "Παλιό σκριπτ — Χύνεις", notes: "" },
  ];
  const medMed: Omit<RowSeed, "model_tier" | "spender_tier">[] = [
    { video_number: 1, price_normal: "12 – 15", price_negotiation: "TW", description: "Με ρούχα, τρίβεσαι, sexy κινήσεις, λίγο tease.", notes: "" },
    { video_number: 2, price_normal: "28 – 32", price_negotiation: "24 – 26", description: "Γδύσιμο, δείχνεις στήθος", notes: "" },
    {
      video_number: 3,
      price_normal: "48 – 56",
      price_negotiation: "40 – 45",
      description: "Γυμνή, τρίβεσαι ή στοματικό σε dildo.",
      notes: "Μπορείς να δώσεις και δώρο φωτό στο negotiation (nude no pussy)",
    },
    {
      video_number: 4,
      price_normal: "78 – 89",
      price_negotiation: "65 – 75",
      description: "Παίζει με το μουνί της / τρίβει πούτσα",
      notes: "Μπορείς να δώσεις και δώρο φωτό στο negotiation (nude, no pussy)",
    },
    {
      video_number: 5,
      price_normal: "105 – 120",
      price_negotiation: "90 – 105",
      description: "Δονητής μέσα σε μουνί, σε τρανς πίσω τρύπα",
      notes: "Μπορείς να δώσεις και δώρο βίντεο μικρής διάρκειας τύπου mass message",
    },
    {
      video_number: 6,
      price_normal: "150+",
      price_negotiation: "130+",
      description: "Χύνεις",
      notes: "Μπορείς να δώσεις δώρο βιντεάκι παλιό 1 λεπτό",
    },
  ];
  const lowMedLow: Omit<RowSeed, "model_tier" | "spender_tier">[] = [
    { video_number: 1, price_normal: "9 – 12", price_negotiation: "TW", description: "Με ρούχα, τρίβεσαι, sexy κινήσεις, λίγο tease.", notes: "" },
    { video_number: 2, price_normal: "24 – 28", price_negotiation: "TW", description: "Γδύσιμο, δείχνεις στήθος", notes: "" },
    { video_number: 3, price_normal: "45 – 52", price_negotiation: "39 – 45", description: "Γυμνή, τρίβεσαι ή στοματικό σε dildo.", notes: "" },
    { video_number: 4, price_normal: "69 – 78", price_negotiation: "59 – 65", description: "Παίζει με το μουνί της / τρίβει πούτσα", notes: "" },
    { video_number: 5, price_normal: "89 – 100+", price_negotiation: "82 – 88", description: "Δονητής μέσα σε μουνί, σε τρανς πίσω τρύπα", notes: "" },
    { video_number: 6, price_normal: "100+", price_negotiation: "No Negotiation", description: "Χύνεις", notes: "" },
  ];

  const tag = (mt: Mt, st: St, rows: Omit<RowSeed, "model_tier" | "spender_tier">[]): RowSeed[] =>
    rows.map((r) => ({ ...r, model_tier: mt, spender_tier: st }));

  return [
    ...tag("high", "high", highHigh),
    ...tag("high", "medium", highMed),
    ...tag("high", "low", highLow),
    ...tag("medium", "high", highHigh),
    ...tag("medium", "medium", medMed),
    ...tag("medium", "low", highLow),
    ...tag("low", "high", medMed),
    ...tag("low", "medium_low", lowMedLow),
  ];
}

async function seedRows(): Promise<void> {
  const seeds = buildAllRowSeeds();
  let sort = 1;
  const withSort = seeds.map((s) => ({ ...s, sort_order: sort++ }));
  for (let i = 0; i < withSort.length; i += 10) {
    const chunk = withSort.slice(i, i + 10);
    const records = chunk.map((r) => ({
      fields: {
        row_key: `${r.model_tier}|${r.spender_tier}|v${r.video_number}`,
        model_tier: r.model_tier,
        spender_tier: r.spender_tier,
        video_number: r.video_number,
        price_normal: r.price_normal,
        price_negotiation: r.price_negotiation,
        description: r.description,
        notes: r.notes || "",
        is_active: true,
        sort_order: r.sort_order,
      },
    }));
    const res = await dataFetch(encodeURIComponent(ROWS_TABLE), {
      method: "POST",
      body: JSON.stringify({ records }),
    });
    if (!res.ok) throw new Error(await res.text());
    console.log(`Seeded pricing_rows batch ${i / 10 + 1}`);
  }
}

async function seedSpecials(): Promise<void> {
  const specials = [
    {
      label: "SexTape",
      price_normal: "200+",
      price_negotiation: "180 – 200",
      description:
        "Sextapes κάτω από 1 λεπτό μπορούν να πουληθούν και 150. Αναλόγως πάντα τον spender και το model — Ask Mike ή τον Tsakiri",
      models_applicable: "ALL",
      sort_order: 1,
    },
    {
      label: "Customs",
      price_normal: "150 – 300+",
      price_negotiation: "-",
      description:
        "Αναλόγως το custom πάντα. 1. Customs πάνω από 2-3 λεπτά με fully nude περιεχόμενο είναι 200. 2. ANAL Customs (αν κάνει το μοντέλ) είναι πάνω από 300.",
      models_applicable: "ALL",
      sort_order: 2,
    },
    {
      label: "Video Calls",
      price_normal: "200 – 250+",
      price_negotiation: "-",
      description: "10 – 15 λεπτά",
      models_applicable: "Lina, Sabrina",
      sort_order: 3,
    },
  ];
  const records = specials.map((s) => ({
    fields: {
      ...s,
      is_active: true,
    },
  }));
  const res = await dataFetch(encodeURIComponent(SPECIALS_TABLE), {
    method: "POST",
    body: JSON.stringify({ records }),
  });
  if (!res.ok) throw new Error(await res.text());
  console.log(`Seeded ${specials.length} pricing_specials`);
}

async function main(): Promise<void> {
  const tables = await listTables();
  const names = new Set(tables.map((t) => t.name));
  if (!names.has(ROWS_TABLE)) await createRowsTable();
  else console.log(`${ROWS_TABLE} exists — skip create`);
  if (!names.has(SPECIALS_TABLE)) await createSpecialsTable();
  else console.log(`${SPECIALS_TABLE} exists — skip create`);

  if (await tableEmpty(ROWS_TABLE)) await seedRows();
  else console.log(`${ROWS_TABLE} not empty — skip row seed`);

  if (await tableEmpty(SPECIALS_TABLE)) await seedSpecials();
  else console.log(`${SPECIALS_TABLE} not empty — skip specials seed`);

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
