#!/usr/bin/env npx tsx
/**
 * Adds personal (non-_admin) notification event types to Airtable via typecast probe.
 * Idempotent if choices already exist.
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnv();
loadEnv({ path: ".env.local" });

const META_BASE = "https://api.airtable.com/v0/meta/bases";
const DATA_API = "https://api.airtable.com/v0";
const TABLE_NAME = "notifications";
const FIELD_NAME = "event_type";

const PERSONAL_EVENTS = [
  "spin_result",
  "chatter_mistake_reviewed",
  "fine_issued",
  "bonus_awarded",
  "fine_bonus_reviewed",
  "shadowban_submitted",
  "shadowban_resolved",
  "sop_quiz_passed",
  "sop_quiz_failed",
  "schedule_published",
  "login_new_device",
  "password_changed",
  // Distinct task/phase lifecycle options (A7) — previously mislabeled as task_shift_started/ended.
  "task_completed",
  "task_overdue",
  "tasks_not_started",
  "va_task_reminder",
  "va_task_assigned",
  "phase_task_completed",
  "phase_completed",
  "phase_overdue",
  "all_phases_completed",
  // Model content request lifecycle (C3).
  "model_content_request_created",
  "model_content_request_reviewed",
] as const;

function loadBaseIdFromWrangler(): string | null {
  const path = resolve(process.cwd(), "wrangler.jsonc");
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  const m = raw.match(/"AIRTABLE_BASE_ID"\s*:\s*"([^"]+)"/);
  return m?.[1] ?? null;
}

function getCredentials(): { token: string; baseId: string } {
  const token = process.env.AIRTABLE_TOKEN?.trim();
  if (!token) {
    console.error("Missing AIRTABLE_TOKEN.");
    process.exit(1);
  }
  let baseId = process.env.AIRTABLE_BASE_ID?.trim();
  if (!baseId) {
    baseId = loadBaseIdFromWrangler() ?? "";
    if (baseId) console.log("(Using AIRTABLE_BASE_ID from wrangler.jsonc)\n");
  }
  if (!baseId) {
    console.error("Missing AIRTABLE_BASE_ID.");
    process.exit(1);
  }
  return { token, baseId };
}

async function addChoiceViaTypecast(
  token: string,
  baseId: string,
  choiceName: string
): Promise<void> {
  const createRes = await fetch(`${DATA_API}/${baseId}/${encodeURIComponent(TABLE_NAME)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      typecast: true,
      records: [
        {
          fields: {
            [FIELD_NAME]: choiceName,
            user_id: "schema-sync-probe",
            category: "system",
            priority: "low",
            title: `Schema probe ${choiceName}`,
            body: `typecast probe for event_type=${choiceName}`,
            entity_type: "system",
            entity_id: "schema-sync-probe",
          },
        },
      ],
    }),
  });
  if (!createRes.ok) {
    throw new Error(
      `typecast create event_type="${choiceName}" failed (${createRes.status}): ${await createRes.text()}`
    );
  }
  const created = (await createRes.json()) as { records?: Array<{ id: string }> };
  const probeId = created.records?.[0]?.id;
  if (!probeId) {
    throw new Error(`typecast create event_type="${choiceName}" returned no record id`);
  }

  const deleteRes = await fetch(
    `${DATA_API}/${baseId}/${encodeURIComponent(TABLE_NAME)}/${probeId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!deleteRes.ok) {
    throw new Error(
      `Failed to delete typecast probe record ${probeId} (${deleteRes.status}): ${await deleteRes.text()}`
    );
  }
  console.log(`Added "${choiceName}" via typecast probe.`);
}

async function main(): Promise<void> {
  const { token, baseId } = getCredentials();
  const res = await fetch(`${META_BASE}/${baseId}/tables`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET meta tables failed: ${await res.text()}`);
  const payload = (await res.json()) as {
    tables?: Array<{
      name: string;
      fields: Array<{
        name: string;
        options?: { choices?: Array<{ name: string }> };
      }>;
    }>;
  };
  const table = payload.tables?.find((t) => t.name === TABLE_NAME);
  const field = table?.fields.find((f) => f.name === FIELD_NAME);
  const existing = new Set(
    (field?.options?.choices ?? []).map((c) => c.name.trim().toLowerCase()).filter(Boolean)
  );
  const missing = PERSONAL_EVENTS.filter((n) => !existing.has(n.toLowerCase()));

  if (missing.length === 0) {
    console.log("All personal event types already exist. Skipping.");
    return;
  }

  console.log(`Adding ${missing.length} missing personal event type(s)...`);
  for (const name of missing) {
    await addChoiceViaTypecast(token, baseId, name);
  }
  console.log("Success.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
