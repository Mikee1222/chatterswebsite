/**
 * GetMySocial public REST API client (link-in-bio analytics).
 * Base: https://api.getmysocial.com/v3
 * Auth: Authorization: Bearer <GETMYSOCIAL_API_KEY> (keys look like gms_live_…).
 * Rate limits (response headers): 120/min, 10_000/day.
 * Docs surface: MCP tools at mcp.getmysocial.com + verified live endpoints.
 */

import { devLog } from "@/lib/dev-log";
import type {
  GetMySocialAnalyticsOverview,
  GetMySocialBreakdownDimension,
  GetMySocialBreakdownRow,
  GetMySocialCtr,
  GetMySocialLink,
  GetMySocialLinkMetrics,
  GetMySocialListResponse,
  GetMySocialMeta,
  GetMySocialPing,
  GetMySocialReferrerCount,
  GetMySocialShieldBucket,
  GetMySocialTimeSeriesPoint,
  GetMySocialTimeframe,
  GetMySocialTrackingParamSummary,
  GetMySocialVisitorEvent,
} from "@/types/getmysocial";

const GETMYSOCIAL_BASE_URL = "https://api.getmysocial.com";
const GETMYSOCIAL_V3 = `${GETMYSOCIAL_BASE_URL}/v3`;

/** Default pace for 120 req/min (~500ms gap). Overridable via env. */
function getMySocialMinRequestIntervalMs(): number {
  const raw = process.env["GETMYSOCIAL_MIN_REQUEST_INTERVAL_MS"];
  if (raw == null || String(raw).trim() === "") return 520;
  const n = Number.parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : 520;
}

let lastRequestStart = 0;
let fetchChain: Promise<void> = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rateLimitedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const run = fetchChain.then(async () => {
    const gap = getMySocialMinRequestIntervalMs();
    const now = Date.now();
    const wait = Math.max(0, gap - (now - lastRequestStart));
    if (wait > 0) await sleep(wait);
    lastRequestStart = Date.now();
    return fetch(input, init);
  });
  fetchChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function gmsDebug(message: string, meta?: Record<string, unknown>) {
  if (process.env["GETMYSOCIAL_DEBUG"] !== "1" && process.env["GETMYSOCIAL_DEBUG"] !== "true") {
    return;
  }
  if (meta) devLog("[getmysocial]", message, meta);
  else devLog("[getmysocial]", message);
}

export class GetMySocialApiError extends Error {
  status: number;
  code: string;
  type: string;
  requestId: string;
  body: string;
  path: string;

  constructor(
    message: string,
    status: number,
    opts?: { code?: string; type?: string; requestId?: string; body?: string; path?: string }
  ) {
    super(message);
    this.status = status;
    this.code = opts?.code ?? "";
    this.type = opts?.type ?? "";
    this.requestId = opts?.requestId ?? "";
    this.body = opts?.body ?? "";
    this.path = opts?.path ?? "";
  }
}

export function logGetMySocialFailure(
  context: string,
  err: unknown,
  extra?: Record<string, unknown>
): void {
  if (err instanceof GetMySocialApiError) {
    console.error(`[getmysocial] ${context}`, {
      status: err.status,
      code: err.code || undefined,
      type: err.type || undefined,
      requestId: err.requestId || undefined,
      path: err.path || undefined,
      body: err.body ? err.body.slice(0, 500) : undefined,
      message: err.message.slice(0, 500),
      ...extra,
    });
    return;
  }
  console.error(`[getmysocial] ${context}`, {
    message: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
    ...extra,
  });
}

export function isGetMySocialConfigured(): boolean {
  return Boolean(process.env["GETMYSOCIAL_API_KEY"]?.trim());
}

function getApiKey(): string {
  const apiKey = process.env["GETMYSOCIAL_API_KEY"]?.trim();
  if (!apiKey) {
    throw new GetMySocialApiError("GetMySocial API key is not configured.", 500, {
      code: "missing_api_key",
      type: "authentication_error",
    });
  }
  return apiKey.replace(/^Bearer\s+/i, "");
}

function gmsHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    Accept: "application/json",
  };
}

function parseErrorPayload(body: string): {
  code: string;
  type: string;
  message: string;
  requestId: string;
} {
  try {
    const parsed = JSON.parse(body) as {
      error?: {
        code?: unknown;
        type?: unknown;
        message?: unknown;
        request_id?: unknown;
      };
      message?: unknown;
    };
    const err = parsed?.error;
    if (err && typeof err === "object") {
      return {
        code: typeof err.code === "string" ? err.code : "",
        type: typeof err.type === "string" ? err.type : "",
        message: typeof err.message === "string" ? err.message : body.slice(0, 300),
        requestId: typeof err.request_id === "string" ? err.request_id : "",
      };
    }
    if (typeof parsed?.message === "string") {
      return { code: "", type: "", message: parsed.message, requestId: "" };
    }
  } catch {
    // fall through
  }
  return {
    code: "",
    type: "",
    message: body.slice(0, 300) || "Unknown GetMySocial error",
    requestId: "",
  };
}

export type GetMySocialScopeParams = {
  link_id?: string;
  link_ids?: string[];
  team_id?: string;
};

export type GetMySocialTimeParams = {
  timeframe?: GetMySocialTimeframe;
  start_date?: string;
  end_date?: string;
  timezone?: string;
  interval?: "day" | "hour";
};

export type GetMySocialListParams = GetMySocialScopeParams &
  GetMySocialTimeParams & {
    limit?: number;
    cursor?: string;
    sort?: string;
    top?: number;
  };

function appendScope(qs: URLSearchParams, scope?: GetMySocialScopeParams) {
  if (!scope) return;
  if (scope.link_id?.trim()) qs.set("link_id", scope.link_id.trim());
  if (scope.team_id?.trim()) qs.set("team_id", scope.team_id.trim());
  if (Array.isArray(scope.link_ids) && scope.link_ids.length) {
    for (const id of scope.link_ids) {
      const t = id?.trim();
      if (t) qs.append("link_ids", t);
    }
  }
}

function appendTime(qs: URLSearchParams, time?: GetMySocialTimeParams) {
  if (!time) return;
  if (time.timeframe) qs.set("timeframe", time.timeframe);
  if (time.start_date?.trim()) qs.set("start_date", time.start_date.trim());
  if (time.end_date?.trim()) qs.set("end_date", time.end_date.trim());
  if (time.timezone?.trim()) qs.set("timezone", time.timezone.trim());
  if (time.interval) qs.set("interval", time.interval);
}

async function gmsFetchJson<T>(
  path: string,
  query?: Record<string, string | number | undefined | null> | URLSearchParams,
  opts?: { accept?: string; raw?: boolean }
): Promise<T> {
  const qs =
    query instanceof URLSearchParams
      ? query
      : (() => {
          const p = new URLSearchParams();
          if (query) {
            for (const [k, v] of Object.entries(query)) {
              if (v == null || v === "") continue;
              p.set(k, String(v));
            }
          }
          return p;
        })();
  const url = `${path.startsWith("http") ? path : `${GETMYSOCIAL_V3}${path}`}${
    qs.toString() ? `?${qs}` : ""
  }`;
  const relativePath = path.startsWith("http") ? path : path;

  const maxAttempts = 4;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      gmsDebug("request", { path: relativePath, attempt });
      const res = await rateLimitedFetch(url, {
        method: "GET",
        headers: {
          ...gmsHeaders(),
          ...(opts?.accept ? { Accept: opts.accept } : {}),
        },
        cache: "no-store",
      });
      const body = await res.text();
      if (res.status === 429 && attempt < maxAttempts) {
        const retryAfter = Number.parseInt(res.headers.get("retry-after") ?? "", 10);
        await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : 1500 * attempt);
        continue;
      }
      if (!res.ok) {
        const parsed = parseErrorPayload(body);
        throw new GetMySocialApiError(parsed.message || `HTTP ${res.status}`, res.status, {
          code: parsed.code,
          type: parsed.type,
          requestId: parsed.requestId || res.headers.get("x-request-id") || "",
          body,
          path: relativePath,
        });
      }
      if (opts?.raw) return body as unknown as T;
      if (!body.trim()) return {} as T;
      return JSON.parse(body) as T;
    } catch (err) {
      lastErr = err;
      if (err instanceof GetMySocialApiError && err.status !== 429) throw err;
      if (attempt >= maxAttempts) break;
      await sleep(500 * attempt);
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new GetMySocialApiError("GetMySocial request failed", 500, { path: relativePath });
}

function listParamsToQs(params?: GetMySocialListParams): URLSearchParams {
  const qs = new URLSearchParams();
  appendScope(qs, params);
  appendTime(qs, params);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.cursor) qs.set("cursor", params.cursor);
  if (params?.sort) qs.set("sort", params.sort);
  if (params?.top != null) qs.set("top", String(params.top));
  return qs;
}

/** GET / — service meta (no auth required, but we still send key when present). */
export async function getGetMySocialMeta(): Promise<GetMySocialMeta> {
  const res = await rateLimitedFetch(GETMYSOCIAL_BASE_URL, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const body = await res.text();
  if (!res.ok) {
    throw new GetMySocialApiError(`Meta HTTP ${res.status}`, res.status, {
      body,
      path: "/",
    });
  }
  return JSON.parse(body) as GetMySocialMeta;
}

/** GET /v3/_ping — auth + connectivity check. */
export async function getGetMySocialPing(): Promise<GetMySocialPing> {
  return gmsFetchJson<GetMySocialPing>("/_ping");
}

export async function getGetMySocialAnalyticsOverview(
  params?: GetMySocialListParams
): Promise<GetMySocialAnalyticsOverview> {
  return gmsFetchJson<GetMySocialAnalyticsOverview>(
    "/analytics/overview",
    listParamsToQs(params)
  );
}

export async function listGetMySocialAnalyticsLinks(
  params?: GetMySocialListParams
): Promise<GetMySocialListResponse<GetMySocialLinkMetrics>> {
  return gmsFetchJson("/analytics/links", listParamsToQs(params));
}

export async function listGetMySocialVisitors(
  params?: GetMySocialListParams
): Promise<GetMySocialListResponse<GetMySocialVisitorEvent>> {
  return gmsFetchJson("/analytics/visitors", listParamsToQs(params));
}

export async function getGetMySocialTimeSeries(
  params?: GetMySocialListParams
): Promise<GetMySocialListResponse<GetMySocialTimeSeriesPoint>> {
  return gmsFetchJson("/analytics/time-series", listParamsToQs(params));
}

export async function getGetMySocialButtonsTimeSeries(
  params?: GetMySocialListParams
): Promise<GetMySocialListResponse<GetMySocialTimeSeriesPoint>> {
  return gmsFetchJson("/analytics/buttons/time-series", listParamsToQs(params));
}

export async function listGetMySocialReferrers(
  params?: GetMySocialListParams
): Promise<GetMySocialListResponse<GetMySocialReferrerCount>> {
  return gmsFetchJson("/analytics/referrers", listParamsToQs(params));
}

export async function getGetMySocialShield(
  params?: GetMySocialListParams
): Promise<GetMySocialListResponse<GetMySocialShieldBucket>> {
  return gmsFetchJson("/analytics/shield", listParamsToQs(params));
}

export async function getGetMySocialCtr(
  linkId: string,
  params?: Omit<GetMySocialListParams, "link_id">
): Promise<GetMySocialCtr> {
  const qs = listParamsToQs({ ...params, link_id: linkId });
  return gmsFetchJson("/analytics/ctr", qs);
}

export async function getGetMySocialBreakdown(
  dimension: GetMySocialBreakdownDimension,
  params?: GetMySocialListParams
): Promise<GetMySocialListResponse<GetMySocialBreakdownRow>> {
  return gmsFetchJson(`/analytics/breakdowns/${dimension}`, listParamsToQs(params));
}

export async function listGetMySocialTrackingParams(
  params?: GetMySocialListParams
): Promise<GetMySocialListResponse<GetMySocialTrackingParamSummary>> {
  return gmsFetchJson("/analytics/tracking-params", listParamsToQs(params));
}

export async function getGetMySocialTrackingParamTimeSeries(
  name: string,
  value: string,
  params?: GetMySocialListParams
): Promise<GetMySocialListResponse<GetMySocialTimeSeriesPoint>> {
  const qs = listParamsToQs(params);
  qs.set("value", value);
  return gmsFetchJson(
    `/analytics/tracking-params/${encodeURIComponent(name)}/time-series`,
    qs
  );
}

export async function exportGetMySocialTrackingParamCsv(
  name: string,
  params?: GetMySocialListParams
): Promise<string> {
  const qs = listParamsToQs(params);
  return gmsFetchJson(
    `/analytics/tracking-params/${encodeURIComponent(name)}/export.csv`,
    qs,
    { accept: "text/csv, application/json", raw: true }
  );
}

export async function listGetMySocialLinks(
  params?: { limit?: number; cursor?: string }
): Promise<GetMySocialListResponse<GetMySocialLink>> {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.cursor) qs.set("cursor", params.cursor);
  return gmsFetchJson("/links", qs);
}

export async function getGetMySocialLink(linkId: string): Promise<GetMySocialLink> {
  return gmsFetchJson(`/links/${encodeURIComponent(linkId)}`);
}

/** Paginate GET /v3/links until exhausted (or maxPages). */
export async function listAllGetMySocialLinks(opts?: {
  pageSize?: number;
  maxPages?: number;
}): Promise<GetMySocialLink[]> {
  const pageSize = opts?.pageSize ?? 100;
  const maxPages = opts?.maxPages ?? 50;
  const out: GetMySocialLink[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const res = await listGetMySocialLinks({ limit: pageSize, cursor });
    out.push(...(res.data ?? []));
    if (!res.has_more || !res.next_cursor) break;
    cursor = res.next_cursor;
  }
  return out;
}
