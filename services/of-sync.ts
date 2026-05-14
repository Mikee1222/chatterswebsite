/**
 * Sync OnlyFans subscribers from The Only API (MCP) into Airtable `of_subscribers`.
 */

import {
  batchCreateRecords,
  batchUpdateRecords,
  listAllRecords,
  invalidateListRecordsReadCacheForTable,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { OF_SUBSCRIBERS_TABLE } from "@/lib/airtable-schema";
import { listAllModelss } from "@/services/modelss";
import { categorizeSubscriber, parseSubscriber, type OFSubscriber } from "@/services/of-subscribers";

const MCP_BASE_URL = "https://theonlyapi.com/mcp";
const TABLE = OF_SUBSCRIBERS_TABLE;
const PAGE = 100;

type SubscriberPayload = {
  subscribers: OFSubscriber[];
  has_more: boolean;
};

function parseToolResponseToPayload(toolRaw: string): SubscriberPayload | null {
  try {
    const dataLine = toolRaw.split("\n").find((line) => line.startsWith("data:"));
    if (!dataLine) return null;

    const jsonStr = dataLine.slice(5).trim();
    const mcpResult = JSON.parse(jsonStr) as {
      result?: {
        content?: Array<{ type: string; text?: string }>;
      };
    };

    const textBlock = mcpResult.result?.content?.find((c) => c.type === "text");
    if (!textBlock?.text) return null;

    const payload = JSON.parse(textBlock.text) as {
      subscribers?: unknown[];
      page?: { has_more?: boolean };
    };

    const rawSubs = payload.subscribers ?? [];
    const subscribers = rawSubs.map((s) => parseSubscriber(s as Record<string, unknown>));
    const has_more = payload.page?.has_more ?? false;
    return { subscribers, has_more };
  } catch {
    return null;
  }
}

async function mcpOpenSession(apiKey: string): Promise<string> {
  const authHeader = `Bearer ${apiKey}`;
  const initRes = await fetch(MCP_BASE_URL, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "gunzo-dashboard", version: "1.0.0" },
      },
    }),
    cache: "no-store",
  });

  const sessionId =
    initRes.headers.get("mcp-session-id") ??
    initRes.headers.get("Mcp-Session-Id") ??
    initRes.headers.get("MCP-Session-Id") ??
    "";

  await initRes.text();
  if (!initRes.ok) {
    console.warn("[of-sync] MCP initialize HTTP", initRes.status);
  }

  if (sessionId) {
    await fetch(MCP_BASE_URL, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": sessionId,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
      cache: "no-store",
    }).catch(() => {});
  }

  return sessionId;
}

async function fetchSubscribersPageFromMcp(
  ofAccountId: string,
  offset: number,
  apiKey: string,
  sessionId: string
): Promise<{ ok: boolean; status: number; payload: SubscriberPayload | null }> {
  const authHeader = `Bearer ${apiKey}`;
  const toolRes = await fetch(MCP_BASE_URL, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "of_list_subscribers",
        arguments: {
          of_user_id: ofAccountId,
          limit: PAGE,
          offset,
          type: "all",
        },
      },
    }),
    cache: "no-store",
  });

  const toolRaw = await toolRes.text();
  if (!toolRes.ok) {
    return { ok: false, status: toolRes.status, payload: null };
  }

  const payload = parseToolResponseToPayload(toolRaw);
  return {
    ok: true,
    status: toolRes.status,
    payload: payload ?? { subscribers: [], has_more: false },
  };
}

async function fetchAllSubscribersFromMcp(ofAccountId: string, apiKey: string) {
  const sessionId = await mcpOpenSession(apiKey);
  const all: OFSubscriber[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const mcp = await fetchSubscribersPageFromMcp(ofAccountId, offset, apiKey, sessionId);
    if (!mcp.ok || !mcp.payload) {
      throw new Error(`MCP of_list_subscribers failed (HTTP ${mcp.status})`);
    }
    const batch = mcp.payload.subscribers;
    all.push(...batch);
    hasMore = Boolean(mcp.payload.has_more);
    offset += PAGE;
    if (batch.length === 0) break;
    await new Promise((r) => setTimeout(r, 120));
  }
  return all;
}

type SubscriberFields = {
  of_user_id?: number;
  of_account_id?: string;
  model_name?: string;
  display_name?: string;
  username?: string;
  subscribed_at?: string;
  expires_at?: string;
  last_synced_at?: string;
  total_spent?: number;
  category?: string;
};

function escapeFormulaString(s: string): string {
  return s.replace(/"/g, '""');
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Airtable formula: account + OR of fan ids (one MCP page, max PAGE ids). */
function filterFormulaForFanChunk(accountEsc: string, fanIds: number[]): string {
  const uniq = [...new Set(fanIds.filter((n) => Number.isFinite(n)))];
  if (uniq.length === 0) {
    return `AND({of_account_id}="${accountEsc}", FALSE())`;
  }
  const orPart = uniq.map((id) => `{of_user_id}=${id}`).join(", ");
  return `AND({of_account_id}="${accountEsc}", OR(${orPart}))`;
}

/** Small delay between Airtable batches to reduce 429s (queue + retries handle the rest). */
async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch one MCP page (limit PAGE) and upsert rows at or above spend threshold to Airtable.
 * Still walks every MCP page (`has_more` from full page); only rows with total_spent >= minSpend are written.
 * For large accounts the client calls this repeatedly with increasing `offset`.
 */
export async function syncSubscribersChunkForAccount(
  ofAccountId: string,
  modelName: string,
  offset: number,
  options?: { highValueOnly?: boolean }
): Promise<{ synced: number; checked: number; errors: number; has_more: boolean; next_offset: number }> {
  const id = ofAccountId.trim();
  const safeOffset = Math.max(0, Math.floor(offset));
  const minSpend = options?.highValueOnly === true ? 500 : 10;

  if (!id || !/^\d+$/.test(id)) {
    console.warn("[of-sync] Invalid of_account_id:", ofAccountId);
    return { synced: 0, checked: 0, errors: 1, has_more: false, next_offset: safeOffset };
  }

  const apiKey = process.env.THE_ONLY_API_KEY ?? "";
  if (!apiKey) {
    console.error("[of-sync] THE_ONLY_API_KEY is not set");
    return { synced: 0, checked: 0, errors: 1, has_more: false, next_offset: safeOffset };
  }

  const sessionId = await mcpOpenSession(apiKey);
  const mcp = await fetchSubscribersPageFromMcp(id, safeOffset, apiKey, sessionId);
  if (!mcp.ok || !mcp.payload) {
    console.warn("[of-sync] MCP page failed", id, safeOffset, mcp.status);
    return { synced: 0, checked: 0, errors: 1, has_more: false, next_offset: safeOffset };
  }

  const rawBatch = mcp.payload.subscribers;
  const checked = rawBatch.length;
  const has_more = Boolean(mcp.payload.has_more);
  const next_offset = safeOffset + PAGE;

  if (rawBatch.length === 0) {
    invalidateListRecordsReadCacheForTable(TABLE);
    return { synced: 0, checked: 0, errors: 0, has_more, next_offset };
  }

  const batch = rawBatch.filter((s) => roundMoney(s.total_spent) >= minSpend);

  if (batch.length === 0) {
    return { synced: 0, checked, errors: 0, has_more, next_offset };
  }

  const esc = escapeFormulaString(id);
  const fanIds = batch.map((s) => s.of_user_id);
  let existing: AirtableRecord<SubscriberFields>[] = [];
  try {
    existing = await listAllRecords<SubscriberFields>(TABLE, {
      filterByFormula: filterFormulaForFanChunk(esc, fanIds),
      _caller: "of-sync-chunk",
    });
  } catch (e) {
    console.error("[of-sync] Airtable list failed for chunk", id, safeOffset, e);
    return { synced: 0, checked, errors: batch.length, has_more, next_offset };
  }

  const byFan = new Map<number, string>();
  for (const rec of existing) {
    const uid = rec.fields.of_user_id;
    if (typeof uid === "number" && Number.isFinite(uid)) {
      byFan.set(uid, rec.id);
    }
  }

  const nowIso = new Date().toISOString();
  const creates: Record<string, unknown>[] = [];
  const updates: { id: string; fields: Record<string, unknown> }[] = [];

  for (const sub of batch) {
    const category = categorizeSubscriber(sub);
    const total_spent = roundMoney(sub.total_spent);
    const airtableId = byFan.get(sub.of_user_id);
    if (airtableId) {
      updates.push({
        id: airtableId,
        fields: {
          total_spent,
          category,
          last_synced_at: nowIso,
        },
      });
    } else {
      creates.push({
        of_user_id: sub.of_user_id,
        of_account_id: id,
        model_name: modelName.trim() || id,
        display_name: sub.display_name,
        username: sub.username,
        subscribed_at: sub.subscribed_at || undefined,
        expires_at: sub.expires_at || undefined,
        last_synced_at: nowIso,
        total_spent,
        category,
      });
    }
  }

  let synced = 0;
  let errors = 0;

  for (let i = 0; i < creates.length; i += 10) {
    const chunk = creates.slice(i, i + 10);
    try {
      await batchCreateRecords(TABLE, chunk);
      synced += chunk.length;
    } catch (e) {
      console.error("[of-sync] batchCreateRecords failed", e);
      errors += chunk.length;
    }
    await sleep(150);
  }

  for (let i = 0; i < updates.length; i += 10) {
    const chunk = updates.slice(i, i + 10);
    try {
      await batchUpdateRecords(TABLE, chunk);
      synced += chunk.length;
    } catch (e) {
      console.error("[of-sync] batchUpdateRecords failed", e);
      errors += chunk.length;
    }
    await sleep(150);
  }

  invalidateListRecordsReadCacheForTable(TABLE);
  return { synced, checked, errors, has_more, next_offset };
}

export async function syncSubscribersForAccount(
  ofAccountId: string,
  modelName: string
): Promise<{ synced: number; checked: number; errors: number }> {
  const id = ofAccountId.trim();
  if (!id || !/^\d+$/.test(id)) {
    console.warn("[of-sync] Invalid of_account_id:", ofAccountId);
    return { synced: 0, checked: 0, errors: 1 };
  }

  const apiKey = process.env.THE_ONLY_API_KEY ?? "";
  if (!apiKey) {
    console.error("[of-sync] THE_ONLY_API_KEY is not set");
    return { synced: 0, checked: 0, errors: 1 };
  }

  let all: OFSubscriber[] = [];
  try {
    all = await fetchAllSubscribersFromMcp(id, apiKey);
  } catch (e) {
    console.error("[of-sync] MCP fetch failed for", id, e);
    return { synced: 0, checked: 0, errors: 1 };
  }

  const checked = all.length;
  const minSpend = 10;
  const subscribers = all.filter((s) => roundMoney(s.total_spent) >= minSpend);

  const esc = escapeFormulaString(id);
  const filterByFormula = `{of_account_id} = "${esc}"`;
  let existing: AirtableRecord<SubscriberFields>[] = [];
  try {
    existing = await listAllRecords<SubscriberFields>(TABLE, {
      filterByFormula,
      _caller: "of-sync",
    });
  } catch (e) {
    console.error("[of-sync] Airtable list failed for", id, e);
    return { synced: 0, checked, errors: 1 };
  }

  const byFan = new Map<number, string>();
  for (const rec of existing) {
    const uid = rec.fields.of_user_id;
    if (typeof uid === "number" && Number.isFinite(uid)) {
      byFan.set(uid, rec.id);
    }
  }

  const nowIso = new Date().toISOString();
  const creates: Record<string, unknown>[] = [];
  const updates: { id: string; fields: Record<string, unknown> }[] = [];

  for (const sub of subscribers) {
    const category = categorizeSubscriber(sub);
    const total_spent = roundMoney(sub.total_spent);
    const airtableId = byFan.get(sub.of_user_id);
    if (airtableId) {
      updates.push({
        id: airtableId,
        fields: {
          total_spent,
          category,
          last_synced_at: nowIso,
        },
      });
    } else {
      creates.push({
        of_user_id: sub.of_user_id,
        of_account_id: id,
        model_name: modelName.trim() || id,
        display_name: sub.display_name,
        username: sub.username,
        subscribed_at: sub.subscribed_at || undefined,
        expires_at: sub.expires_at || undefined,
        last_synced_at: nowIso,
        total_spent,
        category,
      });
    }
  }

  let synced = 0;
  let errors = 0;

  for (let i = 0; i < creates.length; i += 10) {
    const chunk = creates.slice(i, i + 10);
    try {
      await batchCreateRecords(TABLE, chunk);
      synced += chunk.length;
    } catch (e) {
      console.error("[of-sync] batchCreateRecords failed", e);
      errors += chunk.length;
    }
    await sleep(150);
  }

  for (let i = 0; i < updates.length; i += 10) {
    const chunk = updates.slice(i, i + 10);
    try {
      await batchUpdateRecords(TABLE, chunk);
      synced += chunk.length;
    } catch (e) {
      console.error("[of-sync] batchUpdateRecords failed", e);
      errors += chunk.length;
    }
    await sleep(150);
  }

  invalidateListRecordsReadCacheForTable(TABLE);
  return { synced, checked, errors };
}

export async function syncAllAccounts(): Promise<void> {
  const models = await listAllModelss();
  const targets = models.filter((m) => (m.of_user_id ?? "").trim() !== "");
  for (const m of targets) {
    const ofId = (m.of_user_id ?? "").trim();
    try {
      const r = await syncSubscribersForAccount(ofId, m.model_name);
      console.log(`[of-sync] ${m.model_name} (${ofId}): synced=${r.synced} checked=${r.checked} errors=${r.errors}`);
    } catch (e) {
      console.error(`[of-sync] ${m.model_name} (${ofId}) failed`, e);
    }
  }
}
