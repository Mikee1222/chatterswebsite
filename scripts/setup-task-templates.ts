#!/usr/bin/env npx tsx
/**
 * One-time setup: create task template tables + seed "Daily Marketing Routine".
 *
 * Usage (from repo root):
 *   npx tsx scripts/setup-task-templates.ts
 *   npx tsx scripts/setup-task-templates.ts --dry-run
 *
 * Requires env:
 *   AIRTABLE_TOKEN — PAT with schema.bases:read + schema.bases:write + data.records:read/write
 *   AIRTABLE_BASE_ID — target base id
 */

import "dotenv/config";

const META_BASE = "https://api.airtable.com/v0/meta/bases";
const DATA_BASE = "https://api.airtable.com/v0";

const DATETIME_TZ = "Asia/Riyadh";
const datetimeOptions = {
  dateFormat: { name: "iso" as const, format: "YYYY-MM-DD" },
  timeFormat: { name: "24hour" as const, format: "HH:mm" },
  timeZone: DATETIME_TZ,
};
const checkboxOptions = { icon: "check", color: "greenBright" as const };

const DRY_RUN = process.argv.includes("--dry-run");

type MetaTable = { id: string; name: string };

function log(msg: string) {
  console.log(`[setup-task-templates] ${msg}`);
}

function logErr(msg: string) {
  console.error(`[setup-task-templates] ERROR: ${msg}`);
}

async function metaFetch(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${META_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

async function dataFetch(token: string, baseId: string, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${DATA_BASE}/${baseId}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

async function listTables(baseId: string, token: string): Promise<MetaTable[]> {
  const res = await metaFetch(token, `/${baseId}/tables`, { method: "GET" });
  if (!res.ok) throw new Error(`GET tables failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { tables?: MetaTable[] };
  return data.tables ?? [];
}

function findTableId(tables: MetaTable[], name: string): string | null {
  return tables.find((t) => t.name === name)?.id ?? null;
}

async function createTableIfMissing(
  token: string,
  baseId: string,
  tables: MetaTable[],
  name: string,
  fields: Array<Record<string, unknown>>,
): Promise<string> {
  const existing = findTableId(tables, name);
  if (existing) {
    log(`Table "${name}" already exists (${existing}).`);
    return existing;
  }
  if (DRY_RUN) {
    log(`[dry-run] Would create table "${name}" with ${fields.length} fields.`);
    return `dry_${name}`;
  }
  const res = await metaFetch(token, `/${baseId}/tables`, {
    method: "POST",
    body: JSON.stringify({ name, description: `Created by setup-task-templates.ts`, fields }),
  });
  if (!res.ok) throw new Error(`Create table ${name} failed (${res.status}): ${await res.text()}`);
  const created = (await res.json()) as { id: string };
  log(`Created table "${name}" (${created.id}).`);
  return created.id;
}

const DAILY_MARKETING_SEED = {
  name: "Daily Marketing Routine",
  description:
    "Standard daily marketing workflow for Greek VAs: IP check, warm-up, posting, engagement, and end-of-day notes.",
  category: "marketing" as const,
  phases: [
    {
      title: "Phase 1",
      description: "",
      items: [
        {
          title: "Mobile Data",
          description: "Σιγουρέψου ότι έχεις ανοιχτά Mobile Data",
          step_type: "IP Check",
          requires_screenshot: false,
          sort_order: 0,
        },
        {
          title: "IG Scroll Time",
          description: "Πόση ώρα scrollάρισες — στόχος τουλάχιστον 15 λεπτά",
          step_type: "Warm-up",
          requires_screenshot: false,
          sort_order: 1,
        },
        {
          title: "IG Engagement comments",
          description: "Στο scroll time βρες 2 videos για engagement comments",
          step_type: "Engagement",
          requires_screenshot: true,
          sort_order: 2,
        },
        {
          title: "10 Follows IG",
          description: "Potential Sub Profiles",
          step_type: "Engagement",
          requires_screenshot: false,
          sort_order: 3,
        },
        {
          title: "Post IG reel & IG story",
          description: "",
          step_type: "Posting",
          requires_screenshot: false,
          sort_order: 4,
        },
        {
          title: "Reply σε δικά μας comments",
          description: "Τουλάχιστον 3-5 replies — στόχος να ανέβει το engagement",
          step_type: "Engagement",
          requires_screenshot: true,
          sort_order: 5,
        },
        {
          title: "25 follows IG",
          description: "5 σε Creators για niche-down του account μας και 20 σε potential subs",
          step_type: "Engagement",
          requires_screenshot: false,
          sort_order: 6,
        },
        {
          title: "Post daily story",
          description: "Ολοκληρώθηκε το IG για αυτό το Phase",
          step_type: "Posting",
          requires_screenshot: false,
          sort_order: 7,
        },
      ],
    },
    {
      title: "Phase 2",
      description: "",
      items: [
        {
          title: "Snapchat Public story post",
          description: "",
          step_type: "Posting",
          requires_screenshot: false,
          sort_order: 0,
        },
        {
          title: "1 story",
          description: "Εναλλάξ μια μέρα τοπίο, την άλλη μέρα screenshot από IG/Telegram",
          step_type: "Posting",
          requires_screenshot: false,
          sort_order: 1,
        },
        {
          title: "Spotlight post (Snapchat)",
          description: "",
          step_type: "Posting",
          requires_screenshot: false,
          sort_order: 2,
        },
        {
          title: "Add + accept 30 Friends Snapchat",
          description: "Accept και add 30 friends — χωρίς spam",
          step_type: "Engagement",
          requires_screenshot: false,
          sort_order: 3,
        },
        {
          title: "FB Friends",
          description: "Add 20 friends (potential subs) + accept requests",
          step_type: "Engagement",
          requires_screenshot: false,
          sort_order: 4,
        },
        {
          title: "Post reel & daily story (FB)",
          description: "",
          step_type: "Posting",
          requires_screenshot: false,
          sort_order: 5,
        },
        {
          title: "Reply σε comments των βίντεο μας",
          description: "Στόχος να ανέβει το engagement",
          step_type: "Engagement",
          requires_screenshot: false,
          sort_order: 6,
        },
        {
          title: "FB Friends 2nd round",
          description: "Add 20 ακόμα friends (potential subs)",
          step_type: "Engagement",
          requires_screenshot: false,
          sort_order: 7,
        },
      ],
    },
  ],
};

async function seedDailyMarketing(
  token: string,
  baseId: string,
  templatesTable: string,
  phasesTable: string,
  itemsTable: string,
): Promise<void> {
  if (DRY_RUN) {
    log("[dry-run] Would seed Daily Marketing Routine template.");
    return;
  }

  const esc = DAILY_MARKETING_SEED.name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const existingRes = await dataFetch(
    token,
    baseId,
    `${templatesTable}?filterByFormula=${encodeURIComponent(`{name} = "${esc}"`)}&maxRecords=1`,
  );
  if (!existingRes.ok) throw new Error(`Check existing template failed: ${await existingRes.text()}`);
  const existingData = (await existingRes.json()) as { records?: { id: string }[] };
  if (existingData.records?.length) {
    log(`Seed template "${DAILY_MARKETING_SEED.name}" already exists — skipped.`);
    return;
  }

  const now = new Date().toISOString();
  const templateRes = await dataFetch(token, baseId, templatesTable, {
    method: "POST",
    body: JSON.stringify({
      records: [
        {
          fields: {
            template_id: `tpl_${Date.now()}`,
            name: DAILY_MARKETING_SEED.name,
            description: DAILY_MARKETING_SEED.description,
            category: DAILY_MARKETING_SEED.category,
            is_active: true,
            created_at: now,
          },
        },
      ],
    }),
  });
  if (!templateRes.ok) throw new Error(`Create seed template failed: ${await templateRes.text()}`);
  const templateData = (await templateRes.json()) as { records: { id: string }[] };
  const templateRecId = templateData.records[0]?.id;
  if (!templateRecId) throw new Error("No template record id returned");

  for (let pi = 0; pi < DAILY_MARKETING_SEED.phases.length; pi++) {
    const phase = DAILY_MARKETING_SEED.phases[pi];
    const phaseRes = await dataFetch(token, baseId, phasesTable, {
      method: "POST",
      body: JSON.stringify({
        records: [
          {
            fields: {
              phase_template_id: `phase_tpl_${Date.now()}_${pi}`,
              template: [templateRecId],
              phase_number: pi + 1,
              title: phase.title,
              description: phase.description,
            },
          },
        ],
      }),
    });
    if (!phaseRes.ok) throw new Error(`Create seed phase failed: ${await phaseRes.text()}`);
    const phaseData = (await phaseRes.json()) as { records: { id: string }[] };
    const phaseRecId = phaseData.records[0]?.id;
    if (!phaseRecId) continue;

    for (const item of phase.items) {
      const itemRes = await dataFetch(token, baseId, itemsTable, {
        method: "POST",
        body: JSON.stringify({
          records: [
            {
              fields: {
                item_template_id: `item_tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                phase_template: [phaseRecId],
                title: item.title,
                description: item.description ?? "",
                requires_screenshot: item.requires_screenshot,
                sort_order: item.sort_order,
                step_type: item.step_type ?? "Other",
              },
            },
          ],
        }),
      });
      if (!itemRes.ok) throw new Error(`Create seed item failed: ${await itemRes.text()}`);
    }
  }

  log(`Seeded template "${DAILY_MARKETING_SEED.name}" with ${DAILY_MARKETING_SEED.phases.length} phases.`);
}

async function main(): Promise<void> {
  const token = process.env.AIRTABLE_TOKEN?.trim();
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();
  if (!token || !baseId) {
    logErr("Set AIRTABLE_TOKEN and AIRTABLE_BASE_ID.");
    process.exit(1);
  }

  try {
    let tables = await listTables(baseId, token);

    const templatesTableId = await createTableIfMissing(token, baseId, tables, "task_templates", [
      { name: "template_id", type: "singleLineText" },
      { name: "name", type: "singleLineText" },
      { name: "description", type: "multilineText" },
      {
        name: "category",
        type: "singleSelect",
        options: {
          choices: [
            { name: "marketing" },
            { name: "chatting" },
            { name: "content" },
            { name: "other" },
          ],
        },
      },
      { name: "is_active", type: "checkbox", options: { ...checkboxOptions } },
      { name: "created_at", type: "dateTime", options: { ...datetimeOptions } },
    ]);

    tables = await listTables(baseId, token);
    const phasesTableId = await createTableIfMissing(token, baseId, tables, "task_template_phases", [
      { name: "phase_template_id", type: "singleLineText" },
      {
        name: "template",
        type: "multipleRecordLinks",
        options: { linkedTableId: templatesTableId },
      },
      { name: "phase_number", type: "number", options: { precision: 0 } },
      { name: "title", type: "singleLineText" },
      { name: "description", type: "multilineText" },
    ]);

    tables = await listTables(baseId, token);
    const itemsTableId = await createTableIfMissing(token, baseId, tables, "task_template_items", [
      { name: "item_template_id", type: "singleLineText" },
      {
        name: "phase_template",
        type: "multipleRecordLinks",
        options: { linkedTableId: phasesTableId },
      },
      { name: "title", type: "singleLineText" },
      { name: "description", type: "multilineText" },
      { name: "requires_screenshot", type: "checkbox", options: { ...checkboxOptions } },
      { name: "sort_order", type: "number", options: { precision: 0 } },
    ]);

    await seedDailyMarketing(token, baseId, "task_templates", "task_template_phases", "task_template_items");

    log(`Tables ready: task_templates, task_template_phases, task_template_items.`);
    log("Success.");
  } catch (e) {
    logErr(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

main();
