#!/usr/bin/env npx tsx
/**
 * One-time setup: create Link-in-Bio Airtable tables via Meta API.
 *
 * Tables: link_pages → link_page_blocks, link_page_analytics
 *
 * Usage:
 *   npm run setup:link-pages-tables
 *   npm run setup:link-pages-tables -- --dry-run
 *
 * Requires: AIRTABLE_TOKEN, AIRTABLE_BASE_ID (schema.bases:read + schema.bases:write)
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnv();
loadEnv({ path: ".env.local" });

type MetaTable = { id: string; name: string };

const DATETIME_TZ = "Asia/Riyadh";
const datetimeOptions = {
  dateFormat: { name: "iso" as const, format: "YYYY-MM-DD" },
  timeFormat: { name: "24hour" as const, format: "HH:mm" },
  timeZone: DATETIME_TZ,
};
const checkboxOptions = { icon: "check", color: "greenBright" as const };

const DRY_RUN = process.argv.includes("--dry-run");

function log(msg: string) {
  console.log(`[setup-link-pages-tables] ${msg}`);
}

function logErr(msg: string) {
  console.error(`[setup-link-pages-tables] ERROR: ${msg}`);
}

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
    logErr("Missing AIRTABLE_TOKEN (set in .env / .env.local).");
    process.exit(1);
  }
  let baseId = process.env.AIRTABLE_BASE_ID?.trim();
  if (!baseId) {
    baseId = loadBaseIdFromWrangler() ?? "";
    if (baseId) log("(Using AIRTABLE_BASE_ID from wrangler.jsonc)");
  }
  if (!baseId) {
    logErr("Missing AIRTABLE_BASE_ID.");
    process.exit(1);
  }
  return { token, baseId };
}

async function metaFetch(baseId: string, token: string, path: string, init: RequestInit = {}): Promise<Response> {
  const url = `https://api.airtable.com/v0/meta/bases/${baseId}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

async function listTables(baseId: string, token: string): Promise<MetaTable[]> {
  const res = await metaFetch(baseId, token, "/tables", { method: "GET" });
  if (!res.ok) throw new Error(`GET tables failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { tables?: MetaTable[] };
  return data.tables ?? [];
}

function linkPagesFields(): Array<Record<string, unknown>> {
  return [
    { name: "page_id", type: "singleLineText" },
    { name: "model_id", type: "singleLineText" },
    { name: "slug", type: "singleLineText" },
    {
      name: "status",
      type: "singleSelect",
      options: { choices: [{ name: "draft" }, { name: "published" }, { name: "archived" }] },
    },
    { name: "title", type: "singleLineText" },
    { name: "bio", type: "multilineText" },
    { name: "profile_photo_url", type: "url" },
    {
      name: "background_type",
      type: "singleSelect",
      options: { choices: [{ name: "color" }, { name: "gradient" }, { name: "image" }] },
    },
    { name: "background_value", type: "singleLineText" },
    {
      name: "theme",
      type: "singleSelect",
      options: {
        choices: [{ name: "dark" }, { name: "light" }, { name: "minimal" }, { name: "neon" }, { name: "gold" }],
      },
    },
    { name: "primary_color", type: "singleLineText" },
    { name: "accent_color", type: "singleLineText" },
    {
      name: "font",
      type: "singleSelect",
      options: { choices: [{ name: "modern" }, { name: "elegant" }, { name: "bold" }, { name: "minimal" }] },
    },
    { name: "custom_domain", type: "singleLineText" },
    { name: "show_powered_by", type: "checkbox", options: { ...checkboxOptions } },
    { name: "meta_description", type: "multilineText" },
    { name: "verified", type: "checkbox", options: { ...checkboxOptions } },
    { name: "created_at", type: "dateTime", options: { ...datetimeOptions } },
    { name: "updated_at", type: "dateTime", options: { ...datetimeOptions } },
  ];
}

function linkPageBlocksFields(): Array<Record<string, unknown>> {
  return [
    { name: "block_id", type: "singleLineText" },
    { name: "page_id", type: "singleLineText" },
    {
      name: "block_type",
      type: "singleSelect",
      options: {
        choices: [
          { name: "link" },
          { name: "bio_text" },
          { name: "photo_grid" },
          { name: "countdown" },
          { name: "social_bar" },
          { name: "spacer" },
          { name: "heading" },
        ],
      },
    },
    { name: "sort_order", type: "number", options: { precision: 0 } },
    { name: "is_visible", type: "checkbox", options: { ...checkboxOptions } },
    { name: "label", type: "singleLineText" },
    { name: "url", type: "url" },
    { name: "icon", type: "singleLineText" },
    { name: "sublabel", type: "singleLineText" },
    {
      name: "style",
      type: "singleSelect",
      options: {
        choices: [
          { name: "default" },
          { name: "prominent" },
          { name: "subtle" },
          { name: "pill" },
          { name: "card" },
        ],
      },
    },
    { name: "platform", type: "singleLineText" },
    { name: "custom_button_color", type: "singleLineText" },
    { name: "photo_urls", type: "multilineText" },
    { name: "countdown_target", type: "dateTime", options: { ...datetimeOptions } },
    { name: "heading_text", type: "singleLineText" },
    { name: "created_at", type: "dateTime", options: { ...datetimeOptions } },
    { name: "updated_at", type: "dateTime", options: { ...datetimeOptions } },
  ];
}

function linkPageAnalyticsFields(): Array<Record<string, unknown>> {
  return [
    { name: "event_id", type: "singleLineText" },
    { name: "page_id", type: "singleLineText" },
    { name: "block_id", type: "singleLineText" },
    {
      name: "event_type",
      type: "singleSelect",
      options: { choices: [{ name: "page_view" }, { name: "link_click" }] },
    },
    { name: "ip_address", type: "singleLineText" },
    { name: "country", type: "singleLineText" },
    { name: "city", type: "singleLineText" },
    { name: "region", type: "singleLineText" },
    {
      name: "device_type",
      type: "singleSelect",
      options: { choices: [{ name: "mobile" }, { name: "desktop" }, { name: "tablet" }] },
    },
    { name: "browser", type: "singleLineText" },
    { name: "os", type: "singleLineText" },
    { name: "referrer", type: "singleLineText" },
    { name: "user_agent", type: "multilineText" },
    { name: "session_id", type: "singleLineText" },
    { name: "timestamp", type: "dateTime", options: { ...datetimeOptions } },
    { name: "utm_source", type: "singleLineText" },
    { name: "utm_medium", type: "singleLineText" },
    { name: "utm_campaign", type: "singleLineText" },
  ];
}

async function createTableIfMissing(
  baseId: string,
  token: string,
  tables: MetaTable[],
  name: string,
  fields: Array<Record<string, unknown>>,
  description?: string
): Promise<void> {
  if (tables.some((t) => t.name === name)) {
    log(`Skip — table already exists: ${name}`);
    return;
  }
  if (DRY_RUN) {
    log(`[dry-run] Would create table: ${name} (${fields.length} fields)`);
    return;
  }
  const body: Record<string, unknown> = { name, fields };
  if (description) body.description = description;
  const res = await metaFetch(baseId, token, "/tables", { method: "POST", body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) {
    logErr(`Failed ${name}: ${JSON.stringify(data, null, 2)}`);
    throw new Error(`Create table ${name} failed (${res.status})`);
  }
  log(`Created table: ${(data as { name?: string }).name ?? name}`);
}

async function main(): Promise<void> {
  const { token, baseId } = getCredentials();
  log(`Base: ${baseId}${DRY_RUN ? " (dry-run)" : ""}`);

  let tables = await listTables(baseId, token);

  await createTableIfMissing(
    baseId,
    token,
    tables,
    "link_pages",
    linkPagesFields(),
    "Link-in-bio pages for models"
  );
  tables = await listTables(baseId, token);

  await createTableIfMissing(
    baseId,
    token,
    tables,
    "link_page_blocks",
    linkPageBlocksFields(),
    "Content blocks for link-in-bio pages"
  );
  tables = await listTables(baseId, token);

  await createTableIfMissing(
    baseId,
    token,
    tables,
    "link_page_analytics",
    linkPageAnalyticsFields(),
    "Analytics events for link-in-bio pages"
  );

  log("Done.");
}

main().catch((err) => {
  logErr(String(err));
  process.exit(1);
});
