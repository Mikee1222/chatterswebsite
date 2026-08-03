/**
 * Supabase backend for services/of-sync.ts
 * Sync OnlyFans subscribers from The Only API (MCP) into Supabase `of_subscribers`.
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { listAllModelss } from "@/services/modelss";
import { categorizeSubscriber, parseSubscriber, type OFSubscriber } from "@/services/of-subscribers";

const TABLE = "of_subscribers";
const PAGE = 100;
const MCP_BASE_URL = "https://theonlyapi.com/mcp";

type SubscriberPayload = {
  subscribers: OFSubscriber[];
  has_more: boolean;
};

// -- MCP session helpers ------------------------------------------------------

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
    console.warn("[of-sync/supabase] MCP initialize HTTP", initRes.status);
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

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

type ExistingSubscriberRow = {
  id: string;
  airtable_id: string | null;
  of_user_id: number | null;
};

async function fetchExistingForAccount(ofAccountId: string, fanIds?: number[]): Promise<ExistingSubscriberRow[]> {
  const sb = getSupabaseServiceClient();
  const cleanIds = fanIds ? [...new Set(fanIds.filter((n) => Number.isFinite(n)))] : undefined;
  let q = sb.from(TABLE).select("id, airtable_id, of_user_id").eq("of_account_id", ofAccountId);
  if (cleanIds && cleanIds.length > 0) q = q.in("of_user_id", cleanIds as number[]);
  const { data, error } = await q;
  if (error) throw new Error(`of-sync/supabase list failed: ${error.message}`);
  return (data as ExistingSubscriberRow[]) ?? [];
}

async function batchUpsertSubscribers(
  ofAccountId: string,
  modelName: string,
  subscribers: OFSubscriber[]
): Promise<{ synced: number; errors: number }> {
  if (subscribers.length === 0) return { synced: 0, errors: 0 };
  const sb = getSupabaseServiceClient();

  const existing = await fetchExistingForAccount(
    ofAccountId,
    subscribers.map((s) => s.of_user_id)
  );
  const byFan = new Map<number, ExistingSubscriberRow>();
  for (const rec of existing) {
    if (typeof rec.of_user_id === "number" && Number.isFinite(rec.of_user_id)) {
      byFan.set(rec.of_user_id, rec);
    }
  }

  const nowIso = new Date().toISOString();
  const creates: Record<string, unknown>[] = [];
  const updates: { row: ExistingSubscriberRow; fields: Record<string, unknown> }[] = [];

  for (const sub of subscribers) {
    const category = categorizeSubscriber(sub);
    const total_spent = roundMoney(sub.total_spent);
    const found = byFan.get(sub.of_user_id);
    if (found) {
      updates.push({
        row: found,
        fields: {
          total_spent,
          category,
          last_synced_at: nowIso,
        },
      });
    } else {
      creates.push({
        of_user_id: sub.of_user_id,
        of_account_id: ofAccountId,
        model_name: modelName.trim() || ofAccountId,
        display_name: sub.display_name,
        username: sub.username,
        subscribed_at: sub.subscribed_at || null,
        expires_at: sub.expires_at || null,
        last_synced_at: nowIso,
        total_spent,
        category,
      });
    }
  }

  let synced = 0;
  let errors = 0;

  for (let i = 0; i < creates.length; i += 50) {
    const chunk = creates.slice(i, i + 50);
    const { error } = await sb.from(TABLE).insert(chunk);
    if (error) {
      console.error("[of-sync/supabase] insert failed", error.message);
      errors += chunk.length;
    } else {
      synced += chunk.length;
    }
    await sleep(60);
  }

  for (let i = 0; i < updates.length; i += 50) {
    const chunk = updates.slice(i, i + 50);
    await Promise.all(
      chunk.map(async (u) => {
        const { error } = await sb.from(TABLE).update(u.fields).eq("id", u.row.id);
        if (error) {
          console.error("[of-sync/supabase] update failed", error.message);
          errors += 1;
        } else {
          synced += 1;
        }
      })
    );
    await sleep(60);
  }

  return { synced, errors };
}

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
    console.warn("[of-sync/supabase] Invalid of_account_id:", ofAccountId);
    return { synced: 0, checked: 0, errors: 1, has_more: false, next_offset: safeOffset };
  }

  const apiKey = process.env.THE_ONLY_API_KEY ?? "";
  if (!apiKey) {
    console.error("[of-sync/supabase] THE_ONLY_API_KEY is not set");
    return { synced: 0, checked: 0, errors: 1, has_more: false, next_offset: safeOffset };
  }

  const sessionId = await mcpOpenSession(apiKey);
  const mcp = await fetchSubscribersPageFromMcp(id, safeOffset, apiKey, sessionId);
  if (!mcp.ok || !mcp.payload) {
    console.warn("[of-sync/supabase] MCP page failed", id, safeOffset, mcp.status);
    return { synced: 0, checked: 0, errors: 1, has_more: false, next_offset: safeOffset };
  }

  const rawBatch = mcp.payload.subscribers;
  const checked = rawBatch.length;
  const has_more = Boolean(mcp.payload.has_more);
  const next_offset = safeOffset + PAGE;

  if (rawBatch.length === 0) {
    return { synced: 0, checked: 0, errors: 0, has_more, next_offset };
  }

  const batch = rawBatch.filter((s) => roundMoney(s.total_spent) >= minSpend);
  if (batch.length === 0) {
    return { synced: 0, checked, errors: 0, has_more, next_offset };
  }

  try {
    const res = await batchUpsertSubscribers(id, modelName, batch);
    return { synced: res.synced, checked, errors: res.errors, has_more, next_offset };
  } catch (e) {
    console.error("[of-sync/supabase] chunk failed", e);
    return { synced: 0, checked, errors: batch.length, has_more, next_offset };
  }
}

export async function syncSubscribersForAccount(
  ofAccountId: string,
  modelName: string
): Promise<{ synced: number; checked: number; errors: number }> {
  const id = ofAccountId.trim();
  if (!id || !/^\d+$/.test(id)) {
    console.warn("[of-sync/supabase] Invalid of_account_id:", ofAccountId);
    return { synced: 0, checked: 0, errors: 1 };
  }

  const apiKey = process.env.THE_ONLY_API_KEY ?? "";
  if (!apiKey) {
    console.error("[of-sync/supabase] THE_ONLY_API_KEY is not set");
    return { synced: 0, checked: 0, errors: 1 };
  }

  let all: OFSubscriber[] = [];
  try {
    all = await fetchAllSubscribersFromMcp(id, apiKey);
  } catch (e) {
    console.error("[of-sync/supabase] MCP fetch failed for", id, e);
    return { synced: 0, checked: 0, errors: 1 };
  }

  const checked = all.length;
  const minSpend = 10;
  const subscribers = all.filter((s) => roundMoney(s.total_spent) >= minSpend);

  try {
    const res = await batchUpsertSubscribers(id, modelName, subscribers);
    return { synced: res.synced, checked, errors: res.errors };
  } catch (e) {
    console.error("[of-sync/supabase] account failed", id, e);
    return { synced: 0, checked, errors: 1 };
  }
}

export async function syncAllAccounts(): Promise<void> {
  const models = await listAllModelss();
  const targets = models.filter((m) => (m.of_user_id ?? "").trim() !== "");
  for (const m of targets) {
    const ofId = (m.of_user_id ?? "").trim();
    try {
      const r = await syncSubscribersForAccount(ofId, m.model_name);
      console.log(
        `[of-sync/supabase] ${m.model_name} (${ofId}): synced=${r.synced} checked=${r.checked} errors=${r.errors}`
      );
    } catch (e) {
      console.error(`[of-sync/supabase] ${m.model_name} (${ofId}) failed`, e);
    }
  }
}
