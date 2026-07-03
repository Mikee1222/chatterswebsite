#!/usr/bin/env npx tsx
/**
 * One-time setup: add PDF Maker meta/config fields and seed skit-brief template defaults.
 *
 * Usage:
 *   npx tsx scripts/setup-pdf-maker-skit-brief.ts
 *   npx tsx scripts/setup-pdf-maker-skit-brief.ts --dry-run
 */

import "dotenv/config";

const META_BASE = "https://api.airtable.com/v0/meta/bases";
const DATA_BASE = "https://api.airtable.com/v0";

const DRY_RUN = process.argv.includes("--dry-run");

const SKIT_BRIEF_RECORD_ID = "recrWHtArEog3Zx7k";
const PDF_DOCUMENTS_TABLE = "pdf_documents";
const PDF_TEMPLATES_TABLE = "pdf_templates";

const SKIT_DEFAULT_SECTIONS = [
  { title: "Reference Link", content: "", sectionStyle: "reference_link" },
  { title: "Πλήρες Ελληνικό Script", content: "", sectionStyle: "script_breakdown" },
  { title: "Special Instructions", content: "", sectionStyle: "normal" },
];

const SKIT_TEMPLATE_CONFIG = {
  defaultMetaFields: [
    { label: "TYPE", value: "" },
    { label: "MODEL", value: "" },
    { label: "ΗΜΕΡΟΜΗΝΙΑ ΓΥΡΙΣΜΑΤΟΣ", value: "" },
  ],
  defaultFooterText: "Gunzo Agency · Final Production Brief · Εμπιστευτικό έγγραφο",
};

type MetaTable = { id: string; name: string; fields?: { id: string; name: string }[] };

function log(msg: string) {
  console.log(`[setup-pdf-maker-skit-brief] ${msg}`);
}

async function metaFetch(token: string, baseId: string, path: string, init: RequestInit = {}) {
  return fetch(`${META_BASE}/${baseId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

async function dataFetch(token: string, baseId: string, path: string, init: RequestInit = {}) {
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
  const res = await metaFetch(token, baseId, "/tables");
  if (!res.ok) throw new Error(`GET tables failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { tables?: MetaTable[] };
  return data.tables ?? [];
}

function findTable(tables: MetaTable[], name: string): MetaTable | null {
  return tables.find((t) => t.name === name) ?? null;
}

function hasField(table: MetaTable, fieldName: string): boolean {
  return (table.fields ?? []).some((f) => f.name.toLowerCase() === fieldName.toLowerCase());
}

async function createFieldIfMissing(
  token: string,
  baseId: string,
  table: MetaTable,
  fieldName: string,
  description: string,
) {
  if (hasField(table, fieldName)) {
    log(`Field "${fieldName}" already exists on ${table.name}`);
    return;
  }

  const body = {
    name: fieldName,
    type: "multilineText",
    description,
  };

  if (DRY_RUN) {
    log(`[dry-run] Would create field "${fieldName}" on ${table.name}`);
    return;
  }

  const res = await metaFetch(token, baseId, `/tables/${table.id}/fields`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Create field "${fieldName}" failed (${res.status}): ${await res.text()}`);
  log(`Created field "${fieldName}" on ${table.name}`);
}

async function main() {
  const token = process.env.AIRTABLE_TOKEN?.trim();
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();
  if (!token || !baseId) {
    throw new Error("Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID");
  }

  const tables = await listTables(baseId, token);
  const docsTable = findTable(tables, PDF_DOCUMENTS_TABLE);
  const templatesTable = findTable(tables, PDF_TEMPLATES_TABLE);
  if (!docsTable || !templatesTable) {
    throw new Error("pdf_documents or pdf_templates table not found");
  }

  await createFieldIfMissing(
    token,
    baseId,
    docsTable,
    "Meta Fields",
    "JSON array of up to 3 header meta fields ({label, value}).",
  );

  await createFieldIfMissing(
    token,
    baseId,
    templatesTable,
    "Template Config",
    "JSON template defaults: defaultMetaFields, defaultFooterText.",
  );

  const patch = {
    records: [
      {
        id: SKIT_BRIEF_RECORD_ID,
        fields: {
          "Default Sections": JSON.stringify(SKIT_DEFAULT_SECTIONS, null, 2),
          "Template Config": JSON.stringify(SKIT_TEMPLATE_CONFIG, null, 2),
        },
      },
    ],
  };

  if (DRY_RUN) {
    log("[dry-run] Would update skit-brief template defaults");
    return;
  }

  const res = await dataFetch(token, baseId, `${PDF_TEMPLATES_TABLE}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Update skit-brief failed (${res.status}): ${await res.text()}`);
  log("Updated skit-brief template defaults");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
