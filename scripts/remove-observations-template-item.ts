#!/usr/bin/env npx tsx
/**
 * Remove the "Παρατηρήσεις" checklist item from the Daily Marketing Routine template.
 * Observations now live on va_tasks.completed_notes instead of the phase checklist.
 *
 * Usage:
 *   npx tsx scripts/remove-observations-template-item.ts
 *   npx tsx scripts/remove-observations-template-item.ts --dry-run
 *
 * Requires: AIRTABLE_TOKEN, AIRTABLE_BASE_ID
 */

import "dotenv/config";

const DATA_BASE = "https://api.airtable.com/v0";
const DRY_RUN = process.argv.includes("--dry-run");
const TEMPLATE_NAME = "Daily Marketing Routine";
const OBSERVATIONS_TITLE = "Παρατηρήσεις";

function log(msg: string) {
  console.log(`[remove-observations-template-item] ${msg}`);
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

async function main(): Promise<void> {
  const token = process.env.AIRTABLE_TOKEN?.trim();
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();
  if (!token || !baseId) {
    console.error("Set AIRTABLE_TOKEN and AIRTABLE_BASE_ID.");
    process.exit(1);
  }

  const escTemplate = TEMPLATE_NAME.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const templateRes = await dataFetch(
    token,
    baseId,
    `task_templates?filterByFormula=${encodeURIComponent(`{name} = "${escTemplate}"`)}&maxRecords=1`,
  );
  if (!templateRes.ok) throw new Error(`List templates failed: ${await templateRes.text()}`);
  const templateData = (await templateRes.json()) as { records?: { id: string }[] };
  const templateId = templateData.records?.[0]?.id;
  if (!templateId) {
    log(`Template "${TEMPLATE_NAME}" not found — nothing to do.`);
    return;
  }

  const phasesRes = await dataFetch(
    token,
    baseId,
    `task_template_phases?filterByFormula=${encodeURIComponent(`FIND("${templateId}", ARRAYJOIN({template}))`)}`,
  );
  if (!phasesRes.ok) throw new Error(`List phases failed: ${await phasesRes.text()}`);
  const phasesData = (await phasesRes.json()) as { records?: { id: string }[] };
  const phaseIds = (phasesData.records ?? []).map((r) => r.id);
  if (phaseIds.length === 0) {
    log("No phases linked via formula — will try title-only fallback.");
  }

  const escTitle = OBSERVATIONS_TITLE.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  let toDelete: { id: string; fields?: { title?: string } }[] = [];

  if (phaseIds.length > 0) {
    const orPhase = phaseIds.map((id) => `FIND("${id}", ARRAYJOIN({phase_template}))`).join(", ");
    const formula = `AND({title} = "${escTitle}", OR(${orPhase}))`;
    const itemsRes = await dataFetch(
      token,
      baseId,
      `task_template_items?filterByFormula=${encodeURIComponent(formula)}`,
    );
    if (!itemsRes.ok) throw new Error(`List items failed: ${await itemsRes.text()}`);
    const itemsData = (await itemsRes.json()) as { records?: { id: string; fields?: { title?: string } }[] };
    toDelete = itemsData.records ?? [];
  }

  if (toDelete.length === 0) {
    const fallbackRes = await dataFetch(
      token,
      baseId,
      `task_template_items?filterByFormula=${encodeURIComponent(`{title} = "${escTitle}"`)}`,
    );
    if (!fallbackRes.ok) throw new Error(`Fallback list items failed: ${await fallbackRes.text()}`);
    const fallbackData = (await fallbackRes.json()) as { records?: { id: string; fields?: { title?: string } }[] };
    toDelete = fallbackData.records ?? [];
  }

  if (toDelete.length === 0) {
    log(`No "${OBSERVATIONS_TITLE}" template items found — already removed.`);
    return;
  }

  for (const rec of toDelete) {
    if (DRY_RUN) {
      log(`[dry-run] Would delete template item ${rec.id} (${rec.fields?.title ?? OBSERVATIONS_TITLE}).`);
      continue;
    }
    const delRes = await dataFetch(token, baseId, `task_template_items/${rec.id}`, { method: "DELETE" });
    if (!delRes.ok) throw new Error(`Delete ${rec.id} failed: ${await delRes.text()}`);
    log(`Deleted template item ${rec.id}.`);
  }

  log(`Done — removed ${toDelete.length} observation checklist item(s).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
