#!/usr/bin/env tsx
/**
 * Diagnostic: approved payment_submissions vs billing_cycle_revenues status.
 * Usage: npx tsx scripts/debug-revenue-status.ts [clientId]
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const CLIENT_ID = process.argv[2] ?? "rectmag7DEI1AUlFq";

if (!TOKEN || !BASE_ID) {
  console.error("Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID in .env.local");
  process.exit(1);
}

type AirtableListResponse = {
  records?: Array<{ id: string; fields: Record<string, unknown> }>;
  offset?: string;
};

async function listAll(
  table: string,
  filterByFormula?: string,
  fields?: string[]
): Promise<Array<{ id: string; fields: Record<string, unknown> }>> {
  const all: Array<{ id: string; fields: Record<string, unknown> }> = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams({ pageSize: "100" });
    if (filterByFormula) params.set("filterByFormula", filterByFormula);
    if (fields?.length) {
      for (const field of fields) params.append("fields[]", field);
    }
    if (offset) params.set("offset", offset);

    const res = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${table}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${table} list failed (${res.status}): ${text}`);
    }
    const data = (await res.json()) as AirtableListResponse;
    all.push(...(data.records ?? []));
    offset = data.offset;
  } while (offset);

  return all;
}

function linkedIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}

async function getCycleKind(cycleId: string): Promise<string | undefined> {
  const res = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/billing_cycles/${cycleId}?fields[]=kind&fields[]=status`,
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
  if (!res.ok) return undefined;
  const data = (await res.json()) as { fields?: Record<string, unknown> };
  return typeof data.fields?.kind === "string" ? data.fields.kind : undefined;
}

function formulaLinkedContains(fieldName: string, recordId: string): string {
  return `FIND("${recordId}", ARRAYJOIN({${fieldName}}) & "") > 0`;
}

async function main() {
  console.log(`Client filter: ${CLIENT_ID}\n`);

  const allApproved = await listAll("payment_submissions", '{status} = "approved"', [
    "status",
    "client",
    "billing_cycle",
    "submitted_datetime",
  ]);

  const submissions = allApproved.filter((s) =>
    linkedIds(s.fields.client).includes(CLIENT_ID)
  );

  console.log(`Total approved submissions (all clients): ${allApproved.length}`);
  console.log(`Approved submissions for client ${CLIENT_ID}: ${submissions.length}\n`);

  const toCheck = submissions.length > 0 ? submissions.slice(0, 10) : allApproved.slice(0, 10);
  if (submissions.length === 0 && allApproved.length > 0) {
    console.log("No approved submissions for target client; checking first 10 approved globally instead.\n");
  }

  let mismatchCount = 0;
  const statusSummary = new Map<string, number>();

  for (const sub of toCheck) {
    const cycleId = linkedIds(sub.fields.billing_cycle)[0];
    const clientId = linkedIds(sub.fields.client)[0] ?? CLIENT_ID;

    console.log("\n---");
    console.log(`Submission: ${sub.id}`);
    console.log(`  submitted: ${sub.fields.submitted_datetime ?? "?"}`);
    console.log(`  billing_cycle: ${cycleId ?? "none"}`);

    if (!cycleId) {
      console.log("  SKIP: no billing_cycle link");
      continue;
    }

    const kind = await getCycleKind(cycleId);
    console.log(`  cycle kind: ${kind ?? "unknown"}`);

    const revenueFilter = `AND(${formulaLinkedContains("billing_cycle", cycleId)}, ${formulaLinkedContains("client", clientId)})`;
    const revenues = await listAll("billing_cycle_revenues", revenueFilter, [
      "status",
      "client",
      "billing_cycle",
      "model",
    ]);

    console.log(`  revenues for client+cycle: ${revenues.length}`);

    if (revenues.length === 0) {
      console.log("  NOTE: no revenue rows found for this client+cycle");
      continue;
    }

    const statuses = revenues.map((r) => String(r.fields.status ?? "(empty)"));
    for (const st of statuses) {
      statusSummary.set(st, (statusSummary.get(st) ?? 0) + 1);
    }

    const notConfirmed = statuses.filter((s) => s !== "confirmed_paid");
    if (notConfirmed.length > 0) {
      mismatchCount++;
      console.log(`  MISMATCH: ${notConfirmed.length}/${statuses.length} revenues NOT confirmed_paid`);
    } else {
      console.log(`  OK: all ${statuses.length} revenues are confirmed_paid`);
    }

    for (const r of revenues) {
      console.log(
        `    revenue ${r.id} status=${r.fields.status ?? "(empty)"} model=${linkedIds(r.fields.model)[0] ?? "?"}`
      );
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Checked ${toCheck.length} approved submission(s)`);
  console.log(`Submissions with non-confirmed_paid revenues: ${mismatchCount}`);
  console.log("Revenue status distribution across checked rows:");
  for (const [status, count] of [...statusSummary.entries()].sort()) {
    console.log(`  ${status}: ${count}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
