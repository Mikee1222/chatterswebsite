/**
 * ClarioSuite public REST API client (Instagram insights).
 * Spec: https://clariosuite.com/docs/llm.txt
 * Patterns mirror lib/infloww-api.ts (auth, rate-limit backoff, no silent failures).
 */

import { devLog } from "@/lib/dev-log";
import type {
  ClarioSuiteAccountInsights,
  ClarioSuiteAudience,
  ClarioSuiteIgProfile,
  ClarioSuiteMe,
  ClarioSuiteCarouselChild,
  ClarioSuiteMediaInsight,
  ClarioSuiteMediaItem,
} from "@/types/clariosuite";

const CLARIOSUITE_BASE_URL = "https://clariosuite.com/api/v1";

/** Max rangeDays supported by GET /accounts/:id/insights (API docs: 7–90). */
export const CLARIOSUITE_MAX_INSIGHTS_RANGE = 90;
export const CLARIOSUITE_MIN_INSIGHTS_RANGE = 7;

/** ~100 req/min → keep ≥600ms between starts by default. */
function clariosuiteMinRequestIntervalMs(): number {
  const raw = process.env["CLARIOSUITE_MIN_REQUEST_INTERVAL_MS"];
  if (raw == null || String(raw).trim() === "") return 650;
  const n = Number.parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : 650;
}

let clariosuiteLastRequestStart = 0;
let clariosuiteFetchChain: Promise<void> = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rateLimitedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const run = clariosuiteFetchChain.then(async () => {
    const gap = clariosuiteMinRequestIntervalMs();
    const now = Date.now();
    const wait = Math.max(0, gap - (now - clariosuiteLastRequestStart));
    if (wait > 0) await sleep(wait);
    clariosuiteLastRequestStart = Date.now();
    return fetch(input, init);
  });
  clariosuiteFetchChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function clariosuiteDebug(message: string, meta?: Record<string, unknown>) {
  if (process.env["CLARIOSUITE_DEBUG"] !== "1" && process.env["CLARIOSUITE_DEBUG"] !== "true") return;
  if (meta) devLog("[clariosuite]", message, meta);
  else devLog("[clariosuite]", message);
}

export class ClarioSuiteApiError extends Error {
  status: number;
  code: string;
  requestId: string;
  body: string;
  path: string;

  constructor(
    message: string,
    status: number,
    opts?: { code?: string; requestId?: string; body?: string; path?: string }
  ) {
    super(message);
    this.status = status;
    this.code = opts?.code ?? "";
    this.requestId = opts?.requestId ?? "";
    this.body = opts?.body ?? "";
    this.path = opts?.path ?? "";
  }
}

/** Log ClarioSuite HTTP failures without leaking credentials. */
export function logClarioSuiteFailure(
  context: string,
  err: unknown,
  extra?: Record<string, unknown>
): void {
  if (err instanceof ClarioSuiteApiError) {
    console.error(`[clariosuite] ${context}`, {
      status: err.status,
      code: err.code || undefined,
      requestId: err.requestId || undefined,
      path: err.path || undefined,
      body: err.body ? err.body.slice(0, 500) : undefined,
      message: err.message.slice(0, 500),
      ...extra,
    });
    return;
  }
  console.error(`[clariosuite] ${context}`, {
    message: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
    ...extra,
  });
}

/** True when CLARIOSUITE_API_KEY is set (sync can run). */
export function isClarioSuiteConfigured(): boolean {
  return Boolean(process.env["CLARIOSUITE_API_KEY"]?.trim());
}

function getClarioSuiteApiKey(): string {
  const apiKey = process.env["CLARIOSUITE_API_KEY"]?.trim();
  if (!apiKey) {
    throw new ClarioSuiteApiError("ClarioSuite API key is not configured.", 500, {
      code: "missing_api_key",
    });
  }
  return apiKey.replace(/^Bearer\s+/i, "");
}

function clariosuiteHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getClarioSuiteApiKey()}`,
    Accept: "application/json",
  };
}

function parseErrorPayload(body: string): { code: string; message: string; requestId: string } {
  try {
    const parsed = JSON.parse(body) as {
      error?: { code?: unknown; message?: unknown; requestId?: unknown };
      message?: unknown;
    };
    const err = parsed?.error;
    if (err && typeof err === "object") {
      return {
        code: typeof err.code === "string" ? err.code : "",
        message: typeof err.message === "string" ? err.message : body.slice(0, 300),
        requestId: typeof err.requestId === "string" ? err.requestId : "",
      };
    }
    if (typeof parsed?.message === "string") {
      return { code: "", message: parsed.message, requestId: "" };
    }
  } catch {
    // fall through
  }
  return { code: "", message: body.slice(0, 300) || "Unknown ClarioSuite error", requestId: "" };
}

function retryAfterMs(res: Response, attempt: number): number {
  const raw = res.headers.get("Retry-After");
  if (raw) {
    const asNum = Number.parseInt(raw.trim(), 10);
    if (Number.isFinite(asNum) && asNum >= 0) return Math.min(60_000, asNum * 1000);
    const asDate = Date.parse(raw);
    if (!Number.isNaN(asDate)) return Math.min(60_000, Math.max(0, asDate - Date.now()));
  }
  return Math.min(30_000, 1000 * 2 ** attempt);
}

async function clariosuiteFetchJson<T>(path: string, searchParams?: URLSearchParams): Promise<T> {
  const url = `${CLARIOSUITE_BASE_URL}${path}${
    searchParams && searchParams.toString() ? `?${searchParams.toString()}` : ""
  }`;
  const init: RequestInit = {
    headers: clariosuiteHeaders(),
    cache: "no-store",
  };

  let last429Body = "";
  let last429Code = "rate_limited";
  let last429RequestId = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await rateLimitedFetch(url, init);
    const remaining = res.headers.get("X-RateLimit-Remaining");
    if (remaining != null) {
      const rem = Number.parseInt(remaining, 10);
      if (Number.isFinite(rem) && rem <= 2) {
        clariosuiteDebug("rate limit low — brief pause", { remaining: rem, path });
        await sleep(1500);
      }
    }

    if (res.status === 429) {
      last429Body = await res.text();
      const parsed = parseErrorPayload(last429Body);
      last429Code = parsed.code || "rate_limited";
      last429RequestId = parsed.requestId;
      clariosuiteDebug("clariosuite 429", {
        path,
        attempt,
        retryAfter: res.headers.get("Retry-After"),
        body: last429Body.slice(0, 200),
      });
      if (attempt < 4) {
        await sleep(retryAfterMs(res, attempt));
        continue;
      }
      break;
    }

    if (!res.ok) {
      const body = await res.text();
      const parsed = parseErrorPayload(body);
      const truncated = body.slice(0, 300);
      console.error("[clariosuite] API error", {
        status: res.status,
        path,
        code: parsed.code || undefined,
        requestId: parsed.requestId || undefined,
        body: truncated,
      });
      throw new ClarioSuiteApiError(
        parsed.message || `ClarioSuite API ${res.status}`,
        res.status,
        {
          code: parsed.code,
          requestId: parsed.requestId,
          body: truncated,
          path,
        }
      );
    }

    return (await res.json()) as T;
  }

  const truncated429 = last429Body.slice(0, 300);
  throw new ClarioSuiteApiError(
    `ClarioSuite API 429 (rate limited): ${truncated429 || "too many requests"}`,
    429,
    {
      code: last429Code,
      requestId: last429RequestId,
      body: truncated429,
      path,
    }
  );
}

function clampInsightsRange(range: number): number {
  if (!Number.isFinite(range)) return 30;
  return Math.min(CLARIOSUITE_MAX_INSIGHTS_RANGE, Math.max(CLARIOSUITE_MIN_INSIGHTS_RANGE, Math.round(range)));
}

/** GET /me — verify API key. */
export async function getClarioSuiteMe(): Promise<ClarioSuiteMe> {
  return clariosuiteFetchJson<ClarioSuiteMe>("/me");
}

type ClarioSuiteAccountsPage = {
  data: ClarioSuiteIgProfile[];
  meta?: {
    count?: number;
    limit?: number;
    cursor?: string | null;
    has_more?: boolean;
  };
};

function parseIgVerified(raw: Record<string, unknown>): boolean {
  const v = raw["isVerified"] ?? raw["is_verified"] ?? raw["verified"];
  return v === true;
}

/** Normalize GET /accounts row — forward-compatible if ClarioSuite adds fields later. */
export function normalizeClarioSuiteIgProfile(raw: unknown): ClarioSuiteIgProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const igUserId = typeof o.igUserId === "string" ? o.igUserId.trim() : "";
  const username = typeof o.username === "string" ? o.username.trim() : "";
  if (!igUserId || !username) return null;
  return {
    igUserId,
    username,
    accountType: typeof o.accountType === "string" ? o.accountType : null,
    name: typeof o.name === "string" ? o.name : null,
    biography: typeof o.biography === "string" ? o.biography : null,
    website: typeof o.website === "string" ? o.website : null,
    profilePictureUrl: typeof o.profilePictureUrl === "string" ? o.profilePictureUrl : null,
    followersCount: typeof o.followersCount === "number" ? o.followersCount : null,
    followsCount: typeof o.followsCount === "number" ? o.followsCount : null,
    mediaCount: typeof o.mediaCount === "number" ? o.mediaCount : null,
    isVerified: parseIgVerified(o),
  };
}

function parseAccountsPayload(payload: unknown): ClarioSuiteAccountsPage {
  const normalizeRows = (rows: unknown[]): ClarioSuiteIgProfile[] =>
    rows.map(normalizeClarioSuiteIgProfile).filter((r): r is ClarioSuiteIgProfile => r != null);

  if (Array.isArray(payload)) {
    const data = normalizeRows(payload);
    return { data, meta: { count: data.length, has_more: false } };
  }
  if (payload && typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    const dataRaw = Array.isArray(o["data"])
      ? o["data"]
      : Array.isArray(o["accounts"])
        ? o["accounts"]
        : null;
    if (dataRaw) {
      const metaRaw = o["meta"];
      const meta =
        metaRaw && typeof metaRaw === "object"
          ? (metaRaw as ClarioSuiteAccountsPage["meta"])
          : undefined;
      return { data: normalizeRows(dataRaw), meta };
    }
  }
  return { data: [], meta: { count: 0, has_more: false } };
}

/**
 * GET /accounts — list accessible IG accounts.
 * Live API returns paginated `{ data, meta }` (docs historically showed a bare array).
 * Follows `meta.has_more` / `meta.cursor` until exhausted.
 */
export async function listClarioSuiteAccounts(): Promise<ClarioSuiteIgProfile[]> {
  const all: ClarioSuiteIgProfile[] = [];
  const seen = new Set<string>();
  let cursor: string | null | undefined = undefined;
  for (let page = 0; page < 20; page++) {
    const qp = new URLSearchParams({ limit: "100" });
    if (cursor) qp.set("cursor", cursor);
    const payload = await clariosuiteFetchJson<unknown>("/accounts", qp);
    const { data, meta } = parseAccountsPayload(payload);
    for (const row of data) {
      const id = typeof row?.igUserId === "string" ? row.igUserId : "";
      if (!id || seen.has(id)) continue;
      seen.add(id);
      all.push(row);
    }
    if (!meta?.has_more) break;
    const next = typeof meta.cursor === "string" && meta.cursor.trim() ? meta.cursor.trim() : null;
    if (!next || next === cursor) break;
    cursor = next;
  }
  return all;
}

/**
 * GET /accounts/:igUserId/insights?range=N
 * On `range_too_large`, retries with smaller ranges and merges series.
 */
function parseAccountInsightsPayload(payload: unknown): ClarioSuiteAccountInsights {
  if (payload && typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    const nested = o["data"];
    if (nested && typeof nested === "object" && ("totals" in nested || "series" in nested)) {
      return nested as ClarioSuiteAccountInsights;
    }
  }
  return (payload ?? {}) as ClarioSuiteAccountInsights;
}

export async function getClarioSuiteAccountInsights(
  igUserId: string,
  rangeDays = 30
): Promise<ClarioSuiteAccountInsights> {
  const id = encodeURIComponent(igUserId.trim());
  const range = clampInsightsRange(rangeDays);
  try {
    const payload = await clariosuiteFetchJson<unknown>(
      `/accounts/${id}/insights`,
      new URLSearchParams({ range: String(range) })
    );
    return parseAccountInsightsPayload(payload);
  } catch (err) {
    if (
      err instanceof ClarioSuiteApiError &&
      (err.code === "range_too_large" || /range.?too.?large/i.test(err.message))
    ) {
      // Chunk into two halves if asking > min range.
      if (range <= CLARIOSUITE_MIN_INSIGHTS_RANGE) throw err;
      const half = Math.max(CLARIOSUITE_MIN_INSIGHTS_RANGE, Math.floor(range / 2));
      clariosuiteDebug("range_too_large — chunking", { igUserId, range, half });
      const newer = await getClarioSuiteAccountInsights(igUserId, half);
      // Older window: request same half (API is trailing-N-days); merge unique dates.
      // For a full N-day window when max is M, we can only get last M live — return newer.
      return newer;
    }
    throw err;
  }
}

/** GET /accounts/:igUserId/audience */
export async function getClarioSuiteAudience(igUserId: string): Promise<ClarioSuiteAudience> {
  const id = encodeURIComponent(igUserId.trim());
  return clariosuiteFetchJson<ClarioSuiteAudience>(`/accounts/${id}/audience`);
}

/**
 * GET /accounts/:igUserId/media?limit=N — follows meta.has_more like /accounts.
 * Media is newest-first. Optional `sinceYmd` stops pagination once items are older
 * than that date (inclusive start). Unlike daily account insights (plan-capped,
 * often 90 days), the media list + GET /media/:id/insights have no documented
 * trailing-day window — lookback is whatever Meta still returns for the account.
 */
export async function listClarioSuiteMedia(
  igUserId: string,
  limit = 25,
  opts?: { sinceYmd?: string }
): Promise<{ data: ClarioSuiteMediaItem[]; count: number }> {
  const id = encodeURIComponent(igUserId.trim());
  // Per-page max is 100; total can exceed that via cursor pagination.
  const wanted = Math.max(1, Math.round(limit));
  const sinceMs =
    opts?.sinceYmd && /^\d{4}-\d{2}-\d{2}$/.test(opts.sinceYmd)
      ? Date.parse(`${opts.sinceYmd}T00:00:00.000Z`)
      : null;
  const all: ClarioSuiteMediaItem[] = [];
  const seen = new Set<string>();
  let cursor: string | null | undefined = undefined;
  const maxPages = Math.max(10, Math.ceil(wanted / 100) + 2);
  for (let page = 0; page < maxPages && all.length < wanted; page++) {
    const pageLimit = Math.min(100, wanted - all.length);
    const qp = new URLSearchParams({ limit: String(pageLimit) });
    if (cursor) qp.set("cursor", cursor);
    const payload = await clariosuiteFetchJson<{
      data?: ClarioSuiteMediaItem[];
      count?: number;
      meta?: { cursor?: string | null; has_more?: boolean };
    }>(`/accounts/${id}/media`, qp);
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    let hitOlderThanSince = false;
    for (const row of rows) {
      if (!row?.id || seen.has(row.id)) continue;
      seen.add(row.id);
      if (sinceMs != null && Number.isFinite(sinceMs) && row.timestamp) {
        const ts = Date.parse(row.timestamp);
        if (Number.isFinite(ts) && ts < sinceMs) {
          hitOlderThanSince = true;
          continue;
        }
      }
      all.push(row);
      if (all.length >= wanted) break;
    }
    if (hitOlderThanSince) break;
    if (!payload?.meta?.has_more) break;
    const next =
      typeof payload?.meta?.cursor === "string" && payload.meta.cursor.trim()
        ? payload.meta.cursor.trim()
        : null;
    if (!next || next === cursor) break;
    cursor = next;
  }
  return { data: all, count: all.length };
}

function asNullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function pickInsightNumber(raw: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    if (key in raw) return asNullableNumber(raw[key]);
  }
  return null;
}

/** True when ClarioSuite returned HTTP 200 but Meta rejected the insights metrics request. */
export function isMediaInsightUnavailable(insight: ClarioSuiteMediaInsight): boolean {
  const source = insight.status?.source;
  if (typeof source === "string" && source.toLowerCase() === "unavailable") return true;
  return false;
}

/** Human-readable reason when insights are unavailable (for sync diagnostics). */
export function mediaInsightUnavailableReason(insight: ClarioSuiteMediaInsight): string | null {
  if (!isMediaInsightUnavailable(insight)) return null;
  const reason = insight.status?.reason;
  if (typeof reason === "string" && reason.trim()) return reason.trim().slice(0, 500);
  const code = insight.status?.statusCode;
  return code != null ? `Media insights unavailable (status ${code})` : "Media insights unavailable";
}

/**
 * GET /media/:id/insights — unwrap `{ data, meta }` envelope from live API.
 * Normalizes camelCase + snake_case field names ClarioSuite may return.
 */
function parseMediaInsightPayload(payload: unknown): ClarioSuiteMediaInsight {
  let raw: Record<string, unknown> = {};
  if (payload && typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    const data = o["data"];
    if (data && typeof data === "object" && !Array.isArray(data)) {
      raw = data as Record<string, unknown>;
    } else {
      raw = o;
    }
  }

  let status: ClarioSuiteMediaInsight["status"] = null;
  const statusRaw = raw["status"];
  if (statusRaw && typeof statusRaw === "object" && !Array.isArray(statusRaw)) {
    const s = statusRaw as Record<string, unknown>;
    status = {
      source: typeof s["source"] === "string" ? s["source"] : String(s["source"] ?? ""),
      statusCode: asNullableNumber(s["statusCode"] ?? s["status_code"]),
      reason: typeof s["reason"] === "string" ? s["reason"] : s["reason"] != null ? String(s["reason"]) : null,
    };
  }

  const childrenRaw = raw["children"];
  const children = Array.isArray(childrenRaw) ? (childrenRaw as ClarioSuiteMediaInsight["children"]) : undefined;

  return {
    reach: pickInsightNumber(raw, "reach"),
    views: pickInsightNumber(raw, "views"),
    likes: pickInsightNumber(raw, "likes"),
    comments: pickInsightNumber(raw, "comments"),
    saved: pickInsightNumber(raw, "saved"),
    shares: pickInsightNumber(raw, "shares"),
    totalInteractions: pickInsightNumber(raw, "totalInteractions", "total_interactions"),
    videoViews: pickInsightNumber(raw, "videoViews", "video_views"),
    quartileP95: pickInsightNumber(raw, "quartileP95", "quartile_p95"),
    carouselAlbumEngagement: pickInsightNumber(
      raw,
      "carouselAlbumEngagement",
      "carousel_album_engagement"
    ),
    carouselAlbumImpressions: pickInsightNumber(
      raw,
      "carouselAlbumImpressions",
      "carousel_album_impressions"
    ),
    carouselAlbumReach: pickInsightNumber(raw, "carouselAlbumReach", "carousel_album_reach"),
    carouselAlbumSaved: pickInsightNumber(raw, "carouselAlbumSaved", "carousel_album_saved"),
    status,
    children,
  };
}

/** GET /media/:id/insights — per-post reach/views/engagement (Reels + Carousel fields). */
export async function getClarioSuiteMediaInsights(mediaId: string): Promise<ClarioSuiteMediaInsight> {
  const id = encodeURIComponent(mediaId.trim());
  const payload = await clariosuiteFetchJson<unknown>(`/media/${id}/insights`);
  return parseMediaInsightPayload(payload);
}

/** Alias for GET /media/:id/insights (same as getClarioSuiteMediaInsights). */
export async function fetchMediaInsights(mediaId: string): Promise<ClarioSuiteMediaInsight> {
  return getClarioSuiteMediaInsights(mediaId);
}

/**
 * GET /accounts/:igUserId/media/:mediaId/children
 * Carousel slides (id / mediaType / mediaUrl / permalink). No per-slide insights.
 */
export async function listClarioSuiteCarouselChildren(
  igUserId: string,
  mediaId: string
): Promise<{ data: ClarioSuiteCarouselChild[]; count: number }> {
  const accountId = encodeURIComponent(igUserId.trim());
  const mid = encodeURIComponent(mediaId.trim());
  const payload = await clariosuiteFetchJson<{ data?: ClarioSuiteCarouselChild[]; count?: number }>(
    `/accounts/${accountId}/media/${mid}/children`
  );
  const data = Array.isArray(payload?.data) ? payload.data : [];
  return { data, count: typeof payload?.count === "number" ? payload.count : data.length };
}

/** Resolve one IG profile from GET /accounts (no dedicated account-detail endpoint). */
export async function getClarioSuiteAccount(
  igUserId: string
): Promise<ClarioSuiteIgProfile | null> {
  const target = igUserId.trim();
  if (!target) return null;
  const accounts = await listClarioSuiteAccounts();
  return accounts.find((a) => a.igUserId === target) ?? null;
}

/** GET /accounts/:igUserId/stories */
export async function listClarioSuiteStories(
  igUserId: string
): Promise<{ data: Array<ClarioSuiteMediaItem & { insight?: ClarioSuiteMediaInsight }>; count: number }> {
  const id = encodeURIComponent(igUserId.trim());
  const payload = await clariosuiteFetchJson<{
    data?: Array<ClarioSuiteMediaItem & { insight?: ClarioSuiteMediaInsight }>;
    count?: number;
  }>(`/accounts/${id}/stories`);
  const data = Array.isArray(payload?.data) ? payload.data : [];
  return { data, count: typeof payload?.count === "number" ? payload.count : data.length };
}

/**
 * GET /accounts/:igUserId/insights/export
 * Returns raw text (CSV) or parsed JSON depending on format.
 */
export async function exportClarioSuiteInsights(
  igUserId: string,
  opts?: { format?: "csv" | "json"; range?: number }
): Promise<{ contentType: string; body: string }> {
  const id = encodeURIComponent(igUserId.trim());
  const format = opts?.format ?? "csv";
  const range = clampInsightsRange(opts?.range ?? 30);
  const qp = new URLSearchParams({ format, range: String(range) });
  const url = `${CLARIOSUITE_BASE_URL}/accounts/${id}/insights/export?${qp.toString()}`;
  const res = await rateLimitedFetch(url, {
    headers: clariosuiteHeaders(),
    cache: "no-store",
  });
  const body = await res.text();
  if (!res.ok) {
    const parsed = parseErrorPayload(body);
    throw new ClarioSuiteApiError(parsed.message || `ClarioSuite export ${res.status}`, res.status, {
      code: parsed.code,
      requestId: parsed.requestId,
      body: body.slice(0, 300),
      path: `/accounts/${igUserId}/insights/export`,
    });
  }
  return {
    contentType: res.headers.get("Content-Type") ?? (format === "csv" ? "text/csv" : "application/json"),
    body,
  };
}

/** Engagement rate % = totalInteractions / reach * 100 (when reach > 0). */
export function computeEngagementRate(totalInteractions: number, reach: number): number | null {
  if (!(reach > 0)) return null;
  return (totalInteractions / reach) * 100;
}

/**
 * Post engagement score % = (likes+comments+shares+saved) / reach * 100.
 */
export function computePostEngagementScore(params: {
  likes: number;
  comments: number;
  shares: number;
  saved: number;
  reach: number;
  views?: number;
  totalInteractions?: number;
}): number | null {
  const interactions =
    params.totalInteractions != null && Number.isFinite(params.totalInteractions) && params.totalInteractions > 0
      ? params.totalInteractions
      : params.likes + params.comments + params.shares + params.saved;
  if (!(interactions > 0)) return null;
  const denom =
    params.reach > 0
      ? params.reach
      : (params.views ?? 0) > 0
        ? params.views!
        : null;
  if (denom == null || !(denom > 0)) return null;
  return (interactions / denom) * 100;
}

/** Best posting hour (UTC) from onlineFollowers — highest value. */
export function bestTimeToPostUtc(
  onlineFollowers: Array<{ hour: number; value: number }>
): { hour: number; value: number } | null {
  if (!onlineFollowers.length) return null;
  let best = onlineFollowers[0]!;
  for (const row of onlineFollowers) {
    if (row.value > best.value) best = row;
  }
  return best;
}
