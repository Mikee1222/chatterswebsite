#!/usr/bin/env npx tsx
/**
 * One-time setup: create rewards-system tables in Airtable via the Meta API,
 * then seed default spin wheel prizes when `spin_wheel_prizes` is newly created.
 *
 * Usage (from repo root):
 *   npx tsx scripts/setup-rewards-system.ts --dry-run
 *   npx tsx scripts/setup-rewards-system.ts
 *
 * Requires env:
 *   AIRTABLE_TOKEN — PAT with schema.bases:read + schema.bases:write (+ data.records:write for seeding)
 *   AIRTABLE_BASE_ID — target base id
 */

import "dotenv/config";

const META_BASE = "https://api.airtable.com/v0/meta/bases";
const DATA_API = "https://api.airtable.com/v0";

/** IANA zone aligned with other setup scripts (UTC+3, no DST). */
const DATETIME_TZ = "Asia/Riyadh";

const datetimeOptions = {
  dateFormat: { name: "iso" as const, format: "YYYY-MM-DD" },
  timeFormat: { name: "24hour" as const, format: "HH:mm" },
  timeZone: DATETIME_TZ,
};

const dateOptionsIso = {
  dateFormat: { name: "iso" as const, format: "YYYY-MM-DD" },
};

const checkboxOptions = { icon: "check", color: "greenBright" as const };

function log(msg: string) {
  console.log(`[setup-rewards-system] ${msg}`);
}

function logErr(msg: string) {
  console.error(`[setup-rewards-system] ERROR: ${msg}`);
}

const DRY_RUN = process.argv.includes("--dry-run");

async function metaFetch(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  const url = `${META_BASE}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

async function dataFetch(token: string, baseId: string, tableName: string, init: RequestInit = {}): Promise<Response> {
  const url = `${DATA_API}/${baseId}/${encodeURIComponent(tableName)}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

type MetaTable = { id: string; name: string };

async function listTables(baseId: string, token: string): Promise<MetaTable[]> {
  const res = await metaFetch(token, `/${baseId}/tables`, { method: "GET" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET tables failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { tables?: MetaTable[] };
  return data.tables ?? [];
}

type TablePlan = {
  name: string;
  description: string;
  fields: Array<Record<string, unknown>>;
};

function tablePlans(): TablePlan[] {
  return [
    {
      name: "chatter_points",
      description: "Chatter rewards: points, level, streak (setup-rewards-system.ts)",
      fields: [
        { name: "user_id", type: "singleLineText" },
        { name: "total_points", type: "number", options: { precision: 0 } },
        {
          name: "level",
          type: "singleSelect",
          options: {
            choices: [{ name: "Bronze" }, { name: "Silver" }, { name: "Gold" }, { name: "Diamond" }],
          },
        },
        { name: "streak_days", type: "number", options: { precision: 0 } },
        { name: "last_active", type: "date", options: { ...dateOptionsIso } },
        { name: "spins_available", type: "number", options: { precision: 0 } },
      ],
    },
    {
      name: "points_transactions",
      description: "Point ledger entries (setup-rewards-system.ts)",
      fields: [
        { name: "user_id", type: "singleLineText" },
        { name: "points", type: "number", options: { precision: 0 } },
        { name: "reason", type: "singleLineText" },
        {
          name: "category",
          type: "singleSelect",
          options: {
            choices: [
              { name: "shift" },
              { name: "whale" },
              { name: "custom" },
              { name: "streak" },
              { name: "challenge" },
              { name: "manual" },
              { name: "penalty" },
            ],
          },
        },
        { name: "reference_id", type: "singleLineText" },
        { name: "created_at", type: "dateTime", options: { ...datetimeOptions } },
      ],
    },
    {
      name: "challenges",
      description: "Gamified challenges (setup-rewards-system.ts)",
      fields: [
        { name: "title", type: "singleLineText" },
        { name: "description", type: "multilineText" },
        {
          name: "target_metric",
          type: "singleSelect",
          options: {
            choices: [
              { name: "transactions" },
              { name: "whales_added" },
              { name: "shift_hours" },
              { name: "customs_completed" },
              { name: "whale_status_upgrades" },
            ],
          },
        },
        { name: "target_value", type: "number", options: { precision: 0 } },
        { name: "reward_points", type: "number", options: { precision: 0 } },
        { name: "start_date", type: "date", options: { ...dateOptionsIso } },
        { name: "end_date", type: "date", options: { ...dateOptionsIso } },
        { name: "active", type: "checkbox", options: { ...checkboxOptions } },
        { name: "created_by", type: "singleLineText" },
        { name: "assigned_users", type: "singleLineText" },
      ],
    },
    {
      name: "challenge_progress",
      description: "Per-user challenge progress (setup-rewards-system.ts)",
      fields: [
        { name: "challenge_id", type: "singleLineText" },
        { name: "user_id", type: "singleLineText" },
        { name: "current_value", type: "number", options: { precision: 0 } },
        { name: "completed", type: "checkbox", options: { ...checkboxOptions } },
        { name: "completed_at", type: "dateTime", options: { ...datetimeOptions } },
      ],
    },
    {
      name: "spin_wheel_prizes",
      description: "Spin wheel prize definitions (setup-rewards-system.ts)",
      fields: [
        { name: "label", type: "singleLineText" },
        {
          name: "prize_type",
          type: "singleSelect",
          options: {
            choices: [
              { name: "cash" },
              { name: "extra_break" },
              { name: "double_points" },
              { name: "mystery" },
              { name: "points" },
            ],
          },
        },
        { name: "prize_value", type: "singleLineText" },
        { name: "probability", type: "number", options: { precision: 0 } },
        { name: "active", type: "checkbox", options: { ...checkboxOptions } },
        { name: "color", type: "singleLineText" },
      ],
    },
    {
      name: "spin_wheel_spins",
      description: "Spin wheel history (setup-rewards-system.ts)",
      fields: [
        { name: "user_id", type: "singleLineText" },
        { name: "prize_id", type: "singleLineText" },
        { name: "prize_label", type: "singleLineText" },
        { name: "created_at", type: "dateTime", options: { ...datetimeOptions } },
        { name: "claimed", type: "checkbox", options: { ...checkboxOptions } },
      ],
    },
  ];
}

const DEFAULT_SPIN_PRIZES: Array<{
  label: string;
  prize_type: string;
  prize_value: string;
  probability: number;
  color: string;
}> = [
  { label: "€10 Bonus", prize_type: "cash", prize_value: "10", probability: 10, color: "#ec4899" },
  { label: "€5 Bonus", prize_type: "cash", prize_value: "5", probability: 20, color: "#f97316" },
  { label: "+200 Points", prize_type: "points", prize_value: "200", probability: 25, color: "#8b5cf6" },
  { label: "+100 Points", prize_type: "points", prize_value: "100", probability: 30, color: "#3b82f6" },
  { label: "Double Points", prize_type: "double_points", prize_value: "next_shift", probability: 10, color: "#10b981" },
  { label: "+15 min Break", prize_type: "extra_break", prize_value: "15", probability: 5, color: "#f59e0b" },
];

async function seedSpinWheelPrizes(baseId: string, token: string): Promise<void> {
  const records = DEFAULT_SPIN_PRIZES.map((p) => ({
    fields: {
      label: p.label,
      prize_type: p.prize_type,
      prize_value: p.prize_value,
      probability: p.probability,
      active: true,
      color: p.color,
    },
  }));

  const res = await dataFetch(token, baseId, "spin_wheel_prizes", {
    method: "POST",
    body: JSON.stringify({ records }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Seed spin_wheel_prizes failed (${res.status}): ${text}`);
  }
  log(`Seeded ${DEFAULT_SPIN_PRIZES.length} rows into spin_wheel_prizes.`);
}

async function main(): Promise<void> {
  const token = process.env.AIRTABLE_TOKEN?.trim();
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();

  if (!token || !baseId) {
    logErr("Set AIRTABLE_TOKEN and AIRTABLE_BASE_ID (e.g. in .env at repo root).");
    process.exit(1);
  }

  if (DRY_RUN) {
    log("Dry run: no tables or records will be created.");
  }

  const plans = tablePlans();
  const createdOrWould: string[] = [];
  const skipped: string[] = [];
  let failed: string | null = null;
  let seedSpin = false;

  try {
    log(`Using base id: ${baseId.slice(0, 8)}…`);
    const tables = await listTables(baseId, token);
    const byName = new Map(tables.map((t) => [t.name, t]));

    for (const plan of plans) {
      if (byName.has(plan.name)) {
        log(`Table "${plan.name}" already exists, skipping`);
        skipped.push(plan.name);
        continue;
      }

      if (DRY_RUN) {
        log(`Would create table "${plan.name}" (${plan.fields.length} fields)`);
        createdOrWould.push(plan.name);
        if (plan.name === "spin_wheel_prizes") {
          seedSpin = true;
          log(`Would seed ${DEFAULT_SPIN_PRIZES.length} default prizes into spin_wheel_prizes`);
        }
        continue;
      }

      log(`Creating table "${plan.name}" (${plan.fields.length} fields)…`);
      const res = await metaFetch(token, `/${baseId}/tables`, {
        method: "POST",
        body: JSON.stringify({
          name: plan.name,
          description: plan.description,
          fields: plan.fields,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        failed = `${plan.name}: ${res.status} ${text}`;
        logErr(`Create table "${plan.name}" failed (${res.status}): ${text}`);
        break;
      }

      const created = (await res.json()) as { id?: string; name?: string };
      log(`Created table "${created.name ?? plan.name}" (id: ${created.id ?? "unknown"})`);
      createdOrWould.push(plan.name);
      byName.set(plan.name, { id: created.id ?? "", name: plan.name });
      if (plan.name === "spin_wheel_prizes") {
        seedSpin = true;
      }
    }

    if (!DRY_RUN && !failed && seedSpin) {
      await seedSpinWheelPrizes(baseId, token);
    } else if (!DRY_RUN && !seedSpin) {
      log("spin_wheel_prizes was not created in this run — skipping prize seed (table already existed).");
    }

    log(`— Summary${DRY_RUN ? " (dry run)" : ""} —`);
    log(
      `${DRY_RUN ? "Would create" : "Created"} (${createdOrWould.length}): ${createdOrWould.length ? createdOrWould.join(", ") : "(none)"}`
    );
    log(`Skipped (${skipped.length}): ${skipped.length ? skipped.join(", ") : "(none)"}`);
    log(
      `${DRY_RUN ? "Would seed spin_wheel_prizes" : "Seeded spin_wheel_prizes"}: ${seedSpin ? `yes (${DEFAULT_SPIN_PRIZES.length} rows)` : "no"}`
    );
    if (failed) {
      log(`Failed: ${failed}`);
      process.exit(1);
    }
    log(DRY_RUN ? "Dry run finished." : "Done.");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logErr(msg);
    process.exit(1);
  }
}

main();
