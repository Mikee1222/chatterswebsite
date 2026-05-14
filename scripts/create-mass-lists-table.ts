#!/usr/bin/env npx tsx
/**
 * Creates Airtable table `mass_lists` (Metadata API) and seeds default rows (Data API).
 *
 * Usage (from repo root):
 *   npx tsx scripts/create-mass-lists-table.ts
 *
 * Requires: AIRTABLE_TOKEN, AIRTABLE_BASE_ID (schema.bases:read + schema.bases:write for create)
 *
 * Idempotent:
 * - If `mass_lists` already exists, skips table creation.
 * - Seeds defaults only when the table has zero records.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const TABLE_NAME = "mass_lists";

type MetaTable = { id: string; name: string };

const dateTimeAthens = {
  dateFormat: { name: "iso" as const },
  timeFormat: { name: "24hour" as const },
  timeZone: "Europe/Athens",
};

const checkboxOpts = { icon: "check" as const, color: "greenBright" as const };

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
  if (!res.ok) throw new Error(`GET tables failed (${res.status}): ${JSON.stringify(data)}`);
  return data.tables ?? [];
}

async function tableHasAnyRecords(): Promise<boolean> {
  const q = new URLSearchParams({ pageSize: "1", maxRecords: "1" });
  const res = await dataFetch(`${encodeURIComponent(TABLE_NAME)}?${q.toString()}`);
  const data = (await res.json()) as { records?: unknown[]; error?: unknown };
  if (!res.ok) {
    throw new Error(`List ${TABLE_NAME} failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return (data.records?.length ?? 0) > 0;
}

type SeedRow = {
  emoji: string;
  name: string;
  type: "include" | "exclude";
  description: string;
  is_different_mass: boolean;
  applies_to_all_models: boolean;
  model_names?: string;
  is_active: boolean;
  sort_order: number;
};

const DEFAULT_ROWS: SeedRow[] = [
  {
    emoji: "📱",
    name: "Fans",
    type: "include",
    description: "Άτομα που έχουν κάνει subscribe στο profile",
    is_different_mass: false,
    applies_to_all_models: true,
    is_active: true,
    sort_order: 1,
  },
  {
    emoji: "📱",
    name: "Following",
    type: "include",
    description: "Άτομα που έχουν γίνει follow από το profile του model",
    is_different_mass: false,
    applies_to_all_models: true,
    is_active: true,
    sort_order: 2,
  },
  {
    emoji: "⭐",
    name: "Freeloaders",
    type: "include",
    description: "Άτομα που δεν έχουν να κάνουν spend πάνω από 20-30$",
    is_different_mass: false,
    applies_to_all_models: true,
    is_active: true,
    sort_order: 3,
  },
  {
    emoji: "⏳",
    name: "Non-converting fans",
    type: "exclude",
    description: "Είναι οι τύποι που δεν θα χαλάνε λεφτά, σε καμία περίπτωση",
    is_different_mass: false,
    applies_to_all_models: true,
    is_active: true,
    sort_order: 4,
  },
  {
    emoji: "🚫",
    name: "Do Not Send MASS",
    type: "exclude",
    description: "Άτομα που δεν θέλουν πλέον να τους στέλνουμε ή δεν πρέπει να τους στείλουμε mass",
    is_different_mass: false,
    applies_to_all_models: true,
    is_active: true,
    sort_order: 5,
  },
  {
    emoji: "💸",
    name: "Special Treatment",
    type: "exclude",
    description: "Άτομα που έχουν λεφτά και θέλουν ειδική μεταχείριση για να πάρουμε παραπάνω",
    is_different_mass: false,
    applies_to_all_models: true,
    is_active: true,
    sort_order: 6,
  },
  {
    emoji: "🐋",
    name: "Whales",
    type: "exclude",
    description: "1k+ spend σε λιγότερο από μήνα",
    is_different_mass: false,
    applies_to_all_models: true,
    is_active: true,
    sort_order: 7,
  },
  {
    emoji: "🔇",
    name: "Muted",
    type: "exclude",
    description: "Άτομα που έχουν γίνει mute",
    is_different_mass: false,
    applies_to_all_models: true,
    is_active: true,
    sort_order: 8,
  },
  {
    emoji: "🔕",
    name: "No Money At This Time",
    type: "exclude",
    description: "Δεν έχει λεφτά αυτήν την περίοδο",
    is_different_mass: false,
    applies_to_all_models: true,
    is_active: true,
    sort_order: 9,
  },
  {
    emoji: "🏳",
    name: "Ξένος - Do Not Send MASS",
    type: "exclude",
    description: "Μιλάει αγγλικά ή οποιαδήποτε άλλη γλώσσα από ελληνικά",
    is_different_mass: false,
    applies_to_all_models: true,
    is_active: true,
    sort_order: 10,
  },
  {
    emoji: "🏆",
    name: "V.I.P.",
    type: "exclude",
    description: "Άτομα που έχουν αγοράσει και έχουν μπει στην VIP",
    is_different_mass: false,
    applies_to_all_models: true,
    is_active: true,
    sort_order: 11,
  },
  {
    emoji: "❗️",
    name: "Custom Await",
    type: "exclude",
    description: "Άτομα που περιμένουν custom",
    is_different_mass: false,
    applies_to_all_models: true,
    is_active: true,
    sort_order: 12,
  },
  {
    emoji: "💡",
    name: "Case Study Whale",
    type: "exclude",
    description: "Whales που είναι σε case study",
    is_different_mass: false,
    applies_to_all_models: false,
    model_names: "",
    is_active: true,
    sort_order: 13,
  },
  {
    emoji: "🩷",
    name: "Women",
    type: "include",
    description: "Γυναίκες",
    is_different_mass: true,
    applies_to_all_models: false,
    model_names: "",
    is_active: true,
    sort_order: 14,
  },
  {
    emoji: "💀",
    name: "Got Scammed",
    type: "exclude",
    description: "Άτομα που έφαγαν scam",
    is_different_mass: false,
    applies_to_all_models: false,
    model_names: "",
    is_active: true,
    sort_order: 15,
  },
  {
    emoji: "🙏",
    name: "Υποτακτικός",
    type: "include",
    description: "Άτομα που είναι submissive στις προτιμήσεις τους",
    is_different_mass: true,
    applies_to_all_models: false,
    model_names: "",
    is_active: true,
    sort_order: 16,
  },
];

function rowToFields(row: SeedRow, createdAtIso: string): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    name: row.name,
    emoji: row.emoji,
    type: row.type,
    description: row.description,
    is_different_mass: row.is_different_mass,
    applies_to_all_models: row.applies_to_all_models,
    is_active: row.is_active,
    sort_order: row.sort_order,
    created_at: createdAtIso,
  };
  if (row.model_names !== undefined) {
    fields.model_names = row.model_names;
  }
  return fields;
}

async function createMassListsTable(): Promise<void> {
  const body = {
    name: TABLE_NAME,
    description: "Mass DM list categories (include/exclude) for whale / fan targeting.",
    fields: [
      { name: "name", type: "singleLineText" },
      { name: "emoji", type: "singleLineText" },
      {
        name: "type",
        type: "singleSelect",
        options: {
          choices: [
            { name: "include", color: "greenLight2" },
            { name: "exclude", color: "redLight2" },
          ],
        },
      },
      { name: "description", type: "multilineText" },
      { name: "is_different_mass", type: "checkbox", options: checkboxOpts },
      { name: "applies_to_all_models", type: "checkbox", options: checkboxOpts },
      { name: "model_names", type: "multilineText" },
      { name: "is_active", type: "checkbox", options: checkboxOpts },
      { name: "sort_order", type: "number", options: { precision: 0 } },
      { name: "created_at", type: "dateTime", options: dateTimeAthens },
    ],
  };

  const res = await metaFetch("/tables", { method: "POST", body: JSON.stringify(body) });
  const data = (await res.json()) as { name?: string; error?: unknown };
  if (!res.ok) {
    console.error(`Create ${TABLE_NAME} failed:`, res.status, data);
    throw new Error(JSON.stringify(data));
  }
  console.log(`Created table: ${data.name ?? TABLE_NAME}`);
}

async function seedMassLists(): Promise<void> {
  const createdAt = new Date().toISOString();
  const chunks: SeedRow[][] = [];
  for (let i = 0; i < DEFAULT_ROWS.length; i += 10) {
    chunks.push(DEFAULT_ROWS.slice(i, i + 10));
  }

  for (let c = 0; c < chunks.length; c++) {
    const records = chunks[c]!.map((row) => ({ fields: rowToFields(row, createdAt) }));
    const res = await dataFetch(encodeURIComponent(TABLE_NAME), {
      method: "POST",
      body: JSON.stringify({ records }),
    });
    const data = (await res.json()) as { records?: unknown[]; error?: unknown };
    if (!res.ok) {
      console.error(`Seed batch ${c + 1} failed:`, res.status, data);
      throw new Error(JSON.stringify(data));
    }
    console.log(`Seeded batch ${c + 1}/${chunks.length} (${records.length} records).`);
  }
  console.log(`Done: ${DEFAULT_ROWS.length} default rows in ${TABLE_NAME}.`);
}

async function main(): Promise<void> {
  const tables = await listTables();
  const existing = tables.find((t) => t.name === TABLE_NAME);
  if (existing) {
    console.log(`Table already exists: ${TABLE_NAME} (${existing.id}) — skipping creation.`);
  } else {
    await createMassListsTable();
  }

  const hasRows = await tableHasAnyRecords();
  if (hasRows) {
    console.log(`${TABLE_NAME} is not empty — skipping seed.`);
    return;
  }

  await seedMassLists();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
