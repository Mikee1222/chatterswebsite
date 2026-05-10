#!/usr/bin/env tsx
/**
 * Adds account_status, shadowban fields on model_social_accounts; extends platform choices;
 * creates shadowban_reports table. Idempotent where possible.
 *
 * Requires: AIRTABLE_TOKEN (schema.bases:read+write), AIRTABLE_BASE_ID
 *
 * Usage: npx tsx scripts/add-social-account-status-fields.ts
 */

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnv();
loadEnv({ path: ".env.local" });

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
  if (!baseId) baseId = loadBaseIdFromWrangler() ?? "";
  if (!baseId) {
    console.error("Missing AIRTABLE_BASE_ID.");
    process.exit(1);
  }
  return { token, baseId };
}

type MetaField = { id: string; name: string; type: string; options?: { choices?: Array<{ id?: string; name: string; color?: string }> } };
type MetaTable = { id: string; name: string; fields: MetaField[] };

async function run(): Promise<void> {
  const { token, baseId } = getCredentials();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const tablesRes = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, { headers });
  if (!tablesRes.ok) {
    console.error("Failed to list tables:", await tablesRes.text());
    process.exit(1);
  }
  const { tables } = (await tablesRes.json()) as { tables: MetaTable[] };
  const table = tables.find((t) => t.name === "model_social_accounts");
  if (!table) {
    console.error("model_social_accounts not found");
    process.exit(1);
  }

  const fieldsUrl = `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${table.id}/fields`;
  const existingNames = new Set(table.fields.map((f) => f.name));

  async function postField(body: Record<string, unknown>, label: string) {
    const r = await fetch(fieldsUrl, { method: "POST", headers, body: JSON.stringify(body) });
    const j = (await r.json()) as { name?: string; error?: { message?: string } };
    if (!r.ok) {
      console.error(label, r.status, j);
      return;
    }
    console.log(`${label}:`, j.name ?? "ok");
  }

  if (!existingNames.has("account_status")) {
    await postField(
      {
        name: "account_status",
        type: "singleSelect",
        options: {
          choices: [
            { name: "active", color: "greenLight2" },
            { name: "shadowbanned", color: "yellowLight2" },
            { name: "banned", color: "redLight2" },
          ],
        },
      },
      "account_status",
    );
  } else {
    console.log("account_status: already exists");
  }

  if (!existingNames.has("shadowban_reported_at")) {
    await postField(
      {
        name: "shadowban_reported_at",
        type: "dateTime",
        options: {
          dateFormat: { name: "iso" },
          timeFormat: { name: "24hour" },
          timeZone: "Europe/Athens",
        },
      },
      "shadowban_reported_at",
    );
  } else {
    console.log("shadowban_reported_at: already exists");
  }

  if (!existingNames.has("shadowban_reported_by")) {
    await postField({ name: "shadowban_reported_by", type: "singleLineText" }, "shadowban_reported_by");
  } else {
    console.log("shadowban_reported_by: already exists");
  }

  if (!existingNames.has("shadowban_screenshot")) {
    await postField({ name: "shadowban_screenshot", type: "multipleAttachments" }, "shadowban_screenshot");
  } else {
    console.log("shadowban_screenshot: already exists");
  }

  const tablesRes2 = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, { headers });
  const tables2 = ((await tablesRes2.json()) as { tables: MetaTable[] }).tables ?? [];
  const accountsTable2 = tables2.find((t) => t.name === "model_social_accounts");
  const hasReportsTable = tables2.some((t) => t.name === "shadowban_reports");
  const platformField = accountsTable2?.fields.find((f) => f.name === "platform");
  if (platformField?.id && platformField.options?.choices) {
    const raw = platformField.options.choices as Array<{ id?: string; name: string; color?: string }>;
    const names = new Set(raw.map((c) => c.name));
    const toAdd: Array<{ name: string }> = [];
    if (!names.has("Telegram")) toAdd.push({ name: "Telegram" });
    if (!names.has("GetMyLinks")) toAdd.push({ name: "GetMyLinks" });
    if (toAdd.length === 0) {
      console.log("platform: Telegram/GetMyLinks already present");
    } else {
      const choices = [
        ...raw.map((c) => (c.id ? { id: c.id, name: c.name } : { name: c.name })),
        ...toAdd,
      ];
      const patchUrl = `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${accountsTable2!.id}/fields/${platformField.id}`;
      const r = await fetch(patchUrl, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          name: "platform",
          type: "singleSelect",
          options: { choices },
        }),
      });
      const text = await r.text();
      if (!r.ok) {
        console.error("platform PATCH failed:", r.status, text);
        console.error(
          "Add Telegram and GetMyLinks manually to model_social_accounts.platform if needed.",
        );
      } else {
        const d = JSON.parse(text) as { id?: string };
        console.log("platform updated:", d.id ?? "ok");
      }
    }
  }

  if (!hasReportsTable) {
    const base = `https://api.airtable.com/v0/meta/bases/${baseId}/tables`;
    const r = await fetch(base, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "shadowban_reports",
        fields: [
          { name: "report_id", type: "singleLineText" },
          { name: "account_id", type: "singleLineText" },
          { name: "model_id", type: "singleLineText" },
          { name: "model_name", type: "singleLineText" },
          { name: "platform", type: "singleLineText" },
          { name: "username", type: "singleLineText" },
          { name: "reported_by_id", type: "singleLineText" },
          { name: "reported_by_name", type: "singleLineText" },
          { name: "reported_by_role", type: "singleLineText" },
          { name: "screenshot", type: "multipleAttachments" },
          { name: "notes", type: "multilineText" },
          {
            name: "status",
            type: "singleSelect",
            options: {
              choices: [
                { name: "pending", color: "yellowLight2" },
                { name: "approved", color: "redLight2" },
                { name: "dismissed", color: "grayLight2" },
              ],
            },
          },
          { name: "reviewed_by", type: "singleLineText" },
          {
            name: "created_at",
            type: "dateTime",
            options: {
              dateFormat: { name: "iso" },
              timeFormat: { name: "24hour" },
              timeZone: "Europe/Athens",
            },
          },
          {
            name: "reviewed_at",
            type: "dateTime",
            options: {
              dateFormat: { name: "iso" },
              timeFormat: { name: "24hour" },
              timeZone: "Europe/Athens",
            },
          },
        ],
      }),
    });
    const d = (await r.json()) as { name?: string; error?: { message?: string } };
    console.log("shadowban_reports:", d.name ?? d.error?.message ?? r.status);
  } else {
    console.log("shadowban_reports: table already exists");
  }
}

run().catch(console.error);
