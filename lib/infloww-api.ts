import type { InflowwEarnings, InflowwEarningsResponse, InflowwModel, InflowwTransaction } from "@/types/infloww";
import { athensYmdEndUtcMs, athensYmdStartUtcMs, getTodayYmdAthens, ymdInAthens } from "@/lib/airtable-datetime";
import { devLog } from "@/lib/dev-log";

const INFLOWW_BASE_URL = "https://openapi.infloww.com/v1";

/** Min gap between Infloww request *starts* (ms). Override with `INFLOWW_MIN_REQUEST_INTERVAL_MS` (e.g. 11000 under a 360/h cap). */
function inflowwMinRequestIntervalMs(): number {
  const raw = process.env["INFLOWW_MIN_REQUEST_INTERVAL_MS"];
  if (raw == null || String(raw).trim() === "") return 200;
  const n = Number.parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : 200;
}

let inflowwLastRequestStart = 0;
/** Serialize all Infloww HTTP calls so spacing + retries apply globally (avoids parallel bursts). */
let inflowwFetchChain: Promise<void> = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rateLimitedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const run = inflowwFetchChain.then(async () => {
    const gap = inflowwMinRequestIntervalMs();
    const now = Date.now();
    const wait = Math.max(0, gap - (now - inflowwLastRequestStart));
    if (wait > 0) await sleep(wait);
    inflowwLastRequestStart = Date.now();
    return fetch(input, init);
  });
  inflowwFetchChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/** OnlyFans platform fee (20%). Transaction amounts are treated as gross. */
export const INFLOWW_ONLYFANS_NET_MULTIPLIER = 0.8;

function netFromGross(gross: number): number {
  return gross * INFLOWW_ONLYFANS_NET_MULTIPLIER;
}

function inflowwDebug(message: string, meta?: Record<string, unknown>) {
  if (process.env["INFLOWW_DEBUG"] !== "1" && process.env["INFLOWW_DEBUG"] !== "true") return;
  if (meta) devLog("[infloww]", message, meta);
  else devLog("[infloww]", message);
}

export class InflowwApiError extends Error {
  status: number;
  /** Truncated response body (no secrets). Empty when unavailable. */
  body: string;
  path: string;

  constructor(message: string, status: number, opts?: { body?: string; path?: string }) {
    super(message);
    this.status = status;
    this.body = opts?.body ?? "";
    this.path = opts?.path ?? "";
  }
}

/** Log Infloww HTTP failures without leaking credentials. */
export function logInflowwFailure(
  context: string,
  err: unknown,
  extra?: Record<string, unknown>
): void {
  if (err instanceof InflowwApiError) {
    console.error(`[infloww] ${context}`, {
      status: err.status,
      path: err.path || undefined,
      body: err.body ? err.body.slice(0, 500) : undefined,
      message: err.message.slice(0, 500),
      ...extra,
    });
    return;
  }
  console.error(`[infloww] ${context}`, {
    message: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
    ...extra,
  });
}

function getInflowwEnv() {
  const oid = process.env["INFLOWW_AGENCY_OID"]?.trim();
  const apiKey = process.env["INFLOWW_API_KEY"]?.trim();
  if (!oid || !apiKey) {
    throw new InflowwApiError("Infloww credentials are not configured.", 500);
  }
  return { oid, apiKey };
}

/**
 * `Authorization` value for openapi.infloww.com.
 * - Default / `raw`: send the key as-is (after stripping a leading `Bearer ` if present).
 * - `bearer`: send `Bearer <key>` (OpenAPI often documents this form).
 * Set `INFLOWW_AUTH_SCHEME=bearer` or `INFLOWW_AUTH_SCHEME=raw` in env (e.g. wrangler vars / secrets).
 */
function inflowwAuthorizationHeaderValue(apiKey: string): string {
  const scheme = (process.env["INFLOWW_AUTH_SCHEME"] ?? "raw").trim().toLowerCase();
  const withoutBearerPrefix = apiKey.replace(/^Bearer\s+/i, "");
  if (scheme === "bearer") {
    return `Bearer ${withoutBearerPrefix}`;
  }
  return withoutBearerPrefix;
}

function inflowwHeaders(): Record<string, string> {
  const { apiKey, oid } = getInflowwEnv();
  // Infloww Open API: INFLOWW_API_KEY → Authorization (raw or Bearer via INFLOWW_AUTH_SCHEME);
  // INFLOWW_AGENCY_OID → x-oid header (agency / organisation id in Infloww).
  return {
    Authorization: inflowwAuthorizationHeaderValue(apiKey),
    "x-oid": oid,
    Accept: "application/json",
  };
}

/**
 * Infloww transaction payloads use **minor units (cents)** for monetary fields such as
 * `transactionAmount` / `amount` / `gross` — convert to dollars **once here** only.
 */
function transactionAmount(r: Record<string, unknown>): number {
  const keys = [
    "transactionAmount",
    "transaction_amount",
    "amount",
    "gross",
    "grossAmount",
    "gross_amount",
    "totalAmount",
    "total_amount",
    "revenue",
    "net",
    "value",
    "total",
    "sum",
    "amountUsd",
    "amount_usd",
    "payout",
    "earning",
    "amountCents",
    "amount_cents",
    "cents",
    "amountInCents",
    "amount_in_cents",
  ] as const;

  for (const k of keys) {
    const v = r[k];
    if (v == null || v === "") continue;
    const n = typeof v === "number" ? v : Number.parseFloat(String(v));
    if (Number.isNaN(n)) continue;
    return n / 100;
  }
  return 0;
}

/**
 * Parse `from` / `to` YYYY-MM-DD (Athens business calendar, same +3 convention as `getTodayYmdAthens`)
 * into Infloww transaction window (unix ms).
 */
function inflowwRangeToMs(from: string, to: string): { startMs: number; endMs: number } {
  const startMs = athensYmdStartUtcMs(from);
  let endMs = athensYmdEndUtcMs(to);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    throw new InflowwApiError("Invalid from/to date range.", 400);
  }
  // Infloww rejects endTime in the future ("must be a past or present time").
  const safeEnd = Date.now() - 2000;
  if (endMs > safeEnd) {
    endMs = safeEnd;
  }
  if (endMs < startMs) {
    throw new InflowwApiError("Invalid from/to date range: end is before start after capping to now.", 400);
  }
  return { startMs, endMs };
}

async function inflowwFetchJson<T>(path: string, searchParams?: URLSearchParams): Promise<T> {
  const url = `${INFLOWW_BASE_URL}${path}${searchParams && searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  // Never cache authenticated Infloww responses — stale 200s can mask expired keys.
  const init: RequestInit = {
    headers: inflowwHeaders(),
    cache: "no-store",
  };

  let last429Body = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await rateLimitedFetch(url, init);
    if (res.status === 429) {
      last429Body = await res.text();
      inflowwDebug("infloww 429", { path, attempt, body: last429Body.slice(0, 200) });
      if (attempt < 3) await sleep(2000 * (attempt + 1));
      continue;
    }
    if (!res.ok) {
      const body = await res.text();
      const truncated = body.slice(0, 300);
      console.error("[infloww] API error", {
        status: res.status,
        path,
        body: truncated,
      });
      throw new InflowwApiError(`Infloww API ${res.status}: ${truncated}`, res.status, {
        body: truncated,
        path,
      });
    }
    return (await res.json()) as T;
  }
  const truncated429 = last429Body.slice(0, 300);
  console.error("[infloww] API error", { status: 429, path, body: truncated429 });
  throw new InflowwApiError(`Infloww API 429 (rate limited): ${truncated429}`, 429, {
    body: truncated429,
    path,
  });
}

function pickArray(payload: unknown, depth = 0): unknown[] {
  if (depth > 4) return [];
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    const candidateKeys = [
      "data",
      "results",
      "items",
      "creators",
      "employees",
      "transactions",
      "records",
      "list",
      "rows",
      "content",
    ];
    for (const k of candidateKeys) {
      const maybe = o[k];
      if (Array.isArray(maybe)) return maybe;
    }
    const nested = o["data"];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const inner = pickArray(nested, depth + 1);
      if (inner.length) return inner;
    }
  }
  return [];
}

function nextCursorFrom(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const o = payload as Record<string, unknown>;
  const c = o["nextCursor"] ?? o["cursor"] ?? o["next_cursor"] ?? o["pageCursor"];
  if (typeof c === "string" && c.length > 0) return c;
  return undefined;
}

function mapCreatorRow(row: unknown, idx: number): InflowwModel {
  const r = (row ?? {}) as Record<string, unknown>;
  const nested =
    r["creator"] && typeof r["creator"] === "object" ? (r["creator"] as Record<string, unknown>) : null;
  const id = String(
    r["id"] ??
      r["creatorId"] ??
      r["creator_id"] ??
      r["userId"] ??
      r["user_id"] ??
      nested?.["id"] ??
      nested?.["creatorId"] ??
      idx
  );
  const name = String(
    r["name"] ??
      r["username"] ??
      r["displayName"] ??
      r["display_name"] ??
      nested?.["name"] ??
      nested?.["username"] ??
      `Creator ${idx + 1}`
  );
  const platformPidRaw =
    r["platformPid"] ??
    r["platform_pid"] ??
    nested?.["platformPid"] ??
    nested?.["platform_pid"];
  const platformPid =
    platformPidRaw != null && String(platformPidRaw).trim() !== ""
      ? String(platformPidRaw).trim()
      : undefined;
  return { id, name, platformPid };
}

const INFLOWW_MODELS_CACHE_TTL_MS = 15 * 60 * 1000;
let inflowwModelsCache: { fetchedAt: number; models: InflowwModel[] } | null = null;

/** Drop cached creator list (e.g. after renaming models in Infloww). */
export function invalidateInflowwModelsCache(): void {
  inflowwModelsCache = null;
}

/** GET /creators — paginated with cursor + limit (max 100). Cached in-process to cut duplicate `/creators` chains. */
async function fetchInflowwModelsUncached(): Promise<InflowwModel[]> {
  const out: InflowwModel[] = [];
  let cursor: string | undefined;
  let pages = 0;
  const MAX_PAGES = 200;
  do {
    pages += 1;
    if (pages > MAX_PAGES) break;
    const qp = new URLSearchParams({ limit: "100" });
    if (cursor) qp.set("cursor", cursor);
    const payload = await inflowwFetchJson<unknown>("/creators", qp);
    const rows = pickArray(payload);
    inflowwDebug("creators page", { page: pages, rowCount: rows.length, hasNextCursor: Boolean(nextCursorFrom(payload)) });
    for (let i = 0; i < rows.length; i++) {
      out.push(mapCreatorRow(rows[i], out.length + i));
    }
    cursor = nextCursorFrom(payload);
    if (rows.length === 0) break;
  } while (cursor);
  return out;
}

export async function getInflowwModels(): Promise<InflowwModel[]> {
  const now = Date.now();
  if (inflowwModelsCache && now - inflowwModelsCache.fetchedAt < INFLOWW_MODELS_CACHE_TTL_MS) {
    return inflowwModelsCache.models;
  }
  const models = await fetchInflowwModelsUncached();
  inflowwModelsCache = { fetchedAt: now, models };
  return models;
}

/** Coerce API scalar to unix ms (handles seconds vs ms and numeric strings). */
function coerceScalarToUnixMs(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number" && Number.isFinite(v)) {
    if (v <= 0 || v > 1e15) return 0;
    return v < 1e12 ? Math.round(v * 1000) : Math.round(v);
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (/^\d{10,13}$/.test(s)) {
      const n = Number(s);
      if (!Number.isFinite(n)) return 0;
      return s.length <= 10 ? Math.round(n * 1000) : Math.round(n);
    }
    const p = Date.parse(s);
    return Number.isNaN(p) ? 0 : p;
  }
  return 0;
}

const TRANSACTION_TIME_KEYS: readonly string[] = [
  "timestamp",
  "createdAt",
  "created_at",
  "time",
  "date",
  "occurredAt",
  "occurred_at",
  "eventTime",
  "event_time",
  "transactionTime",
  "transaction_time",
  "paidAt",
  "paid_at",
  "postedAt",
  "posted_at",
  "completedAt",
  "completed_at",
  "updatedAt",
  "updated_at",
  "txnAt",
  "txn_at",
];

function transactionTimestampMs(r: Record<string, unknown>): number {
  for (const k of TRANSACTION_TIME_KEYS) {
    const ms = coerceScalarToUnixMs(r[k]);
    if (ms > 0) return ms;
  }
  return 0;
}

/** Parse transaction time from numeric fields or ISO / YYYY-MM-DD date strings. */
function parseTransactionTimeMs(r: Record<string, unknown>): number {
  const n = transactionTimestampMs(r);
  if (n > 0) return n;
  for (const k of [
    "transactionDate",
    "transaction_date",
    "businessDate",
    "business_date",
    "day",
    "period",
    "settlementDate",
    "settlement_date",
    "eventDate",
    "event_date",
    "valueDate",
    "value_date",
    "postingDate",
    "posting_date",
  ]) {
    const v = r[k];
    if (typeof v === "string") {
      const s = v.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const p = Date.parse(s.slice(0, 10) + "T12:00:00");
        if (!Number.isNaN(p)) return p;
      }
    }
  }
  return 0;
}

/** First `YYYY-MM-DD` found on the row (shallow), for APIs that omit unix timestamps. */
function extractCalendarYmdFromRecord(r: Record<string, unknown>): string | null {
  const preferred = [
    "businessDate",
    "business_date",
    "transactionDate",
    "transaction_date",
    "settlementDate",
    "settlement_date",
    "day",
    "period",
    "eventDate",
    "valueDate",
    "postingDate",
    "date",
  ];
  const tryVal = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const m = v.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    const head = m?.[1];
    return head ?? null;
  };
  for (const k of preferred) {
    const y = tryVal(r[k]);
    if (y) return y;
  }
  for (const v of Object.values(r)) {
    const y = tryVal(v);
    if (y) return y;
  }
  return null;
}

/** Calendar YYYY-MM-DD in local timezone for a wall-clock instant. */
function localYmdFromMs(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Stable noon-UTC ISO for a calendar day (sortable, works with `slice(0,10)` keys). */
function stableNoonUtcIsoFromLocalYmd(ymd: string): string {
  const parts = ymd.split("-").map((x) => Number.parseInt(x, 10));
  if (parts.length !== 3 || parts.some((x) => Number.isNaN(x))) return `${ymd}T12:00:00.000Z`;
  const y = parts[0]!;
  const mo = parts[1]!;
  const da = parts[2]!;
  return new Date(Date.UTC(y, mo - 1, da, 12, 0, 0)).toISOString();
}

function agencyCutFromNet(net: number, modelId: string, agencyCutPercentByModelId: Readonly<Record<string, number>>): number {
  const raw = agencyCutPercentByModelId[modelId] ?? agencyCutPercentByModelId[String(modelId)] ?? 0;
  const pct = typeof raw === "number" && Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0;
  if (pct <= 0) return 0;
  return net * (pct / 100);
}

/** Query `startTime` / `endTime`: default `unix_ms`; set `INFLOWW_TX_TIME_FORMAT=iso` for RFC3339 strings. */
function txTimeQueryParams(startMs: number, endMs: number): { startTime: string; endTime: string } {
  const fmt = (process.env["INFLOWW_TX_TIME_FORMAT"] ?? "unix_ms").trim().toLowerCase();
  if (fmt === "iso" || fmt === "rfc3339" || fmt === "datetime") {
    return {
      startTime: new Date(startMs).toISOString(),
      endTime: new Date(endMs).toISOString(),
    };
  }
  return { startTime: String(startMs), endTime: String(endMs) };
}

function mapTransactionRow(
  row: unknown,
  idx: number,
  creatorId: string,
  creatorName: string,
  range: { startMs: number; endMs: number }
): InflowwTransaction {
  const r = (row ?? {}) as Record<string, unknown>;
  const id = String(r["id"] ?? r["transactionId"] ?? r["transaction_id"] ?? `${creatorId}-${idx}`);
  const amount = transactionAmount(r);
  const ts = parseTransactionTimeMs(r);
  const ymd =
    ts > 0
      ? localYmdFromMs(ts)
      : extractCalendarYmdFromRecord(r) ?? localYmdFromMs(range.startMs);
  const date = stableNoonUtcIsoFromLocalYmd(ymd);
  const tx: InflowwTransaction = {
    id,
    model_id: String(r["creatorId"] ?? r["creator_id"] ?? r["modelId"] ?? r["model_id"] ?? creatorId),
    model_name: String(r["creatorName"] ?? r["creator_name"] ?? r["modelName"] ?? r["model_name"] ?? creatorName),
    amount,
    date,
  };
  if (r["type"] != null) {
    tx.type = String(r["type"]);
  }
  return tx;
}

function filterTransactionsByRange(
  txs: InflowwTransaction[],
  startMs: number,
  endMs: number
): InflowwTransaction[] {
  return txs.filter((t) => {
    const ms = Date.parse(t.date);
    if (Number.isNaN(ms)) return true;
    return ms >= startMs && ms <= endMs;
  });
}


/** GET /transactions for one creator; paginates with cursor (limit max 100). */
export async function fetchInflowwTransactionsForCreator(
  creatorId: string,
  startMs: number,
  endMs: number,
  creatorName: string
): Promise<InflowwTransaction[]> {
  try {
    const out: InflowwTransaction[] = [];
    let cursor: string | undefined;
    const times = txTimeQueryParams(startMs, endMs);
    const range = { startMs, endMs };
    let pages = 0;
    const MAX_PAGES = 200;
    do {
      pages += 1;
      if (pages > MAX_PAGES) break;
      const qp = new URLSearchParams({
        creatorId,
        startTime: times.startTime,
        endTime: times.endTime,
        limit: "100",
      });
      if (cursor) qp.set("cursor", cursor);
      const payload = await inflowwFetchJson<unknown>("/transactions", qp);
      const rows = pickArray(payload);
      inflowwDebug("transactions page", {
        creatorId,
        page: pages,
        rowCount: rows.length,
        hasNextCursor: Boolean(nextCursorFrom(payload)),
      });
      for (let i = 0; i < rows.length; i++) {
        out.push(mapTransactionRow(rows[i], out.length + i, creatorId, creatorName, range));
      }
      cursor = nextCursorFrom(payload);
      if (rows.length === 0) break;
    } while (cursor);
    return filterTransactionsByRange(out, startMs, endMs);
  } catch (e) {
    // Infloww returns 400 for unknown creator id / bad status mapping — treat as no rows so dashboards still load.
    if (e instanceof InflowwApiError && e.status === 400) {
      inflowwDebug("transactions skipped (400)", { creatorId, message: e.message });
      return [];
    }
    throw e;
  }
}

/** Roll up transactions into per–creator per–calendar-day rows (stable noon-UTC `date` per row). */
export function aggregateTransactionsToEarnings(
  transactions: InflowwTransaction[],
  agencyCutPercentByModelId: Readonly<Record<string, number>> = {}
): InflowwEarnings[] {
  const byModelAndDay = new Map<string, InflowwEarnings>();

  for (const tx of transactions) {
    const raw = tx.date.trim();
    const calendarDay =
      /^\d{4}-\d{2}-\d{2}/.test(raw)
        ? raw.slice(0, 10)
        : (() => {
            const ms = Date.parse(raw);
            return Number.isNaN(ms) || ms <= 0 ? "1970-01-01" : localYmdFromMs(ms);
          })();
    const key = `${tx.model_id}|${calendarDay}`;

    let row = byModelAndDay.get(key);
    if (!row) {
      row = {
        model_id: tx.model_id,
        model_name: tx.model_name,
        gross_earnings: 0,
        net_earnings: 0,
        agency_cut: 0,
        date: stableNoonUtcIsoFromLocalYmd(calendarDay),
      };
      byModelAndDay.set(key, row);
    }

    row.gross_earnings += tx.amount;
    const netAdd = netFromGross(tx.amount);
    row.net_earnings += netAdd;
    row.agency_cut += agencyCutFromNet(netAdd, tx.model_id, agencyCutPercentByModelId);
    if (tx.model_name) row.model_name = tx.model_name;
  }

  return Array.from(byModelAndDay.values()).sort(
    (a, b) => a.date.localeCompare(b.date) || a.model_id.localeCompare(b.model_id)
  );
}

export async function getInflowwTransactions(params: {
  from: string;
  to: string;
  modelId?: string;
}): Promise<InflowwTransaction[]> {
  const { startMs, endMs } = inflowwRangeToMs(params.from, params.to);
  const creators = await getInflowwModels();
  const idSet = new Map(creators.map((c) => [c.id, c.name] as const));
  let targets: [string, string][];
  if (params.modelId) {
    const name = idSet.get(params.modelId) ?? params.modelId;
    targets = [[params.modelId, name]];
  } else {
    targets = creators.map((c): [string, string] => [c.id, c.name]);
  }

  const all: InflowwTransaction[] = [];
  for (const [cid, name] of targets) {
    const txs = await fetchInflowwTransactionsForCreator(cid, startMs, endMs, name);
    all.push(...txs);
  }
  all.sort((a, b) => a.date.localeCompare(b.date));
  return all;
}

export async function getInflowwEarnings(params: {
  from: string;
  to: string;
  modelId?: string;
  agencyCutPercentByModelId?: Readonly<Record<string, number>>;
}): Promise<InflowwEarnings[]> {
  const txs = await getInflowwTransactions(params);
  return aggregateTransactionsToEarnings(txs, params.agencyCutPercentByModelId ?? {});
}

/**
 * Single pass: creators + transactions + derived earnings (avoids duplicate Infloww calls).
 */
export async function getInflowwEarningsSnapshot(params: {
  from: string;
  to: string;
  modelId?: string;
  /** Per Infloww `model_id`: agency share of **net** (after OF 20%), as percent 0–100. */
  agencyCutPercentByModelId?: Readonly<Record<string, number>>;
}): Promise<InflowwEarningsResponse> {
  const { startMs, endMs } = inflowwRangeToMs(params.from, params.to);
  const agencyPct = params.agencyCutPercentByModelId ?? {};
  const models = await getInflowwModels();
  const idToName = new Map(models.map((m) => [m.id, m.name] as const));

  const targets: [string, string][] = params.modelId
    ? [[params.modelId, idToName.get(params.modelId) ?? params.modelId]]
    : models.map((m): [string, string] => [m.id, m.name]);

  const transactions: InflowwTransaction[] = [];
  for (const [cid, name] of targets) {
    const txs = await fetchInflowwTransactionsForCreator(cid, startMs, endMs, name);
    transactions.push(...txs);
  }
  transactions.sort((a, b) => a.date.localeCompare(b.date));

  const earnings = aggregateTransactionsToEarnings(transactions, agencyPct);

  const fromTx = transactions.reduce(
    (acc, t) => {
      acc.gross += t.amount;
      const n = netFromGross(t.amount);
      acc.net += n;
      acc.cut += agencyCutFromNet(n, t.model_id, agencyPct);
      return acc;
    },
    { gross: 0, net: 0, cut: 0 }
  );
  const fromRows = earnings.reduce(
    (acc, row) => {
      acc.gross += row.gross_earnings;
      acc.net += row.net_earnings;
      acc.cut += row.agency_cut;
      return acc;
    },
    { gross: 0, net: 0, cut: 0 }
  );
  const totalsBase =
    fromRows.gross + fromRows.net + fromRows.cut > 0.0001 ? fromRows : { ...fromTx, cut: fromRows.cut };
  const totals = { ...totalsBase };

  inflowwDebug("snapshot done", {
    modelCount: models.length,
    targetCount: targets.length,
    transactionCount: transactions.length,
    earningsRowCount: earnings.length,
    totals,
    timeFormat: (process.env["INFLOWW_TX_TIME_FORMAT"] ?? "unix_ms").trim(),
  });

  return { earnings, models, transactions, totals };
}

// ---------------------------------------------------------------------------
// Employee list — GET /employees (Employee data → Employee list)
// ---------------------------------------------------------------------------

function mapEmployeeRow(row: unknown, idx: number): import("@/types/infloww").InflowwEmployee {
  const r = (row ?? {}) as Record<string, unknown>;
  const nested =
    r["employee"] && typeof r["employee"] === "object" ? (r["employee"] as Record<string, unknown>) : null;
  const nestedUser =
    r["user"] && typeof r["user"] === "object" ? (r["user"] as Record<string, unknown>) : null;
  const employeeId =
    idField(r, ["employeeId", "employee_id", "employeeID", "id"]) ||
    idField(nested ?? {}, ["employeeId", "employee_id", "id"]) ||
    idField(nestedUser ?? {}, ["employeeId", "id"]);
  const name =
    strField(r, ["name", "fullName", "full_name", "displayName", "display_name", "employeeName"]) ??
    strField(nested ?? {}, ["name", "fullName", "displayName"]) ??
    strField(nestedUser ?? {}, ["name", "fullName", "displayName"]) ??
    (employeeId ? `Employee ${employeeId}` : `Employee ${idx + 1}`);
  const email =
    strField(r, ["email", "emailAddress", "email_address"]) ??
    strField(nested ?? {}, ["email"]) ??
    strField(nestedUser ?? {}, ["email"]);
  const status =
    strField(r, ["status", "employeeStatus", "employee_status", "state", "activeStatus"]) ??
    strField(nested ?? {}, ["status"]);
  const username =
    strField(r, ["username", "userName", "user_name", "login"]) ??
    strField(nested ?? {}, ["username"]) ??
    strField(nestedUser ?? {}, ["username"]);
  const role =
    strField(r, ["role", "roleName", "role_name", "jobTitle", "job_title", "title"]) ??
    strField(nested ?? {}, ["role", "roleName"]);
  return {
    employeeId,
    name,
    ...(email ? { email } : {}),
    ...(status ? { status } : {}),
    ...(username ? { username } : {}),
    ...(role ? { role } : {}),
  };
}

/**
 * Fetch all agency employees from Infloww (`GET /v1/employees`).
 * Paginates with `cursor` + `limit` (and `hasMore` when present), same pattern as `/creators`.
 */
export async function fetchInflowwEmployees(): Promise<import("@/types/infloww").InflowwEmployee[]> {
  const out: import("@/types/infloww").InflowwEmployee[] = [];
  let cursor: string | undefined;
  let pages = 0;
  const MAX_PAGES = 200;
  do {
    pages += 1;
    if (pages > MAX_PAGES) {
      throw new InflowwApiError(`Infloww /employees: exceeded max pagination pages (${MAX_PAGES}).`, 500);
    }
    const qp = new URLSearchParams({ limit: "100" });
    if (cursor) qp.set("cursor", cursor);
    const payload = await inflowwFetchJson<unknown>("/employees", qp);
    const rows = pickArray(payload);
    inflowwDebug("employees page", {
      page: pages,
      rowCount: rows.length,
      hasMore: hasMoreFrom(payload),
      hasCursor: Boolean(cursorFromPayload(payload)),
    });
    for (let i = 0; i < rows.length; i++) {
      const mapped = mapEmployeeRow(rows[i], out.length + i);
      if (mapped.employeeId > 0) out.push(mapped);
    }
    const more = hasMoreFrom(payload);
    const next = cursorFromPayload(payload) ?? nextCursorFrom(payload);
    if (more) {
      if (!next) {
        throw new InflowwApiError("Infloww /employees: hasMore=true but no cursor returned.", 502);
      }
      cursor = next;
    } else if (next && rows.length > 0) {
      // Creators-style: nextCursor without hasMore
      cursor = next;
    } else {
      cursor = undefined;
    }
    if (rows.length === 0) break;
  } while (cursor);

  out.sort((a, b) => a.name.localeCompare(b.name) || a.employeeId - b.employeeId);
  return out;
}

// ---------------------------------------------------------------------------
// Employee reports (sales + chat summary) — GET /employee-report/*
// ---------------------------------------------------------------------------

const EMPLOYEE_REPORT_MAX_DAYS = 31;
const EMPLOYEE_REPORT_MAX_LOOKBACK_DAYS = 366;

function numField(r: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    const v = r[k];
    if (v == null || v === "") continue;
    const n = typeof v === "number" ? v : Number.parseFloat(String(v).replace(/,/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

/**
 * Employee sales-summary monetary fields (`salesAmount`, `ppvSalesAmount`, …) are
 * minor units (cents), same as transaction payloads — convert to dollars here.
 * Legacy/alternate keys without an Amount suffix are treated as already-dollars.
 */
function salesMoneyField(r: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    const v = r[k];
    if (v == null || v === "") continue;
    const n = typeof v === "number" ? v : Number.parseFloat(String(v).replace(/,/g, ""));
    if (!Number.isFinite(n)) continue;
    if (/Amount$/i.test(k) || /_amount$/i.test(k) || /Cents$/i.test(k) || /_cents$/i.test(k)) {
      return n / 100;
    }
    return n;
  }
  return 0;
}

function nullableNumField(r: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = r[k];
    if (v == null || v === "") continue;
    const n = typeof v === "number" ? v : Number.parseFloat(String(v).replace(/,/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function idField(r: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    const v = r[k];
    if (v == null || v === "") continue;
    const n = typeof v === "number" ? v : Number.parseInt(String(v), 10);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function strField(r: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function ymdField(r: Record<string, unknown>): string | undefined {
  const keys = [
    "date",
    "day",
    "businessDate",
    "business_date",
    "reportDate",
    "report_date",
    "statDate",
    "stat_date",
  ];
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string") {
      const m = v.trim().match(/^(\d{4}-\d{2}-\d{2})/);
      if (m?.[1]) return m[1];
    }
    if (typeof v === "number" && Number.isFinite(v) && v > 1e11) {
      return localYmdFromMs(v);
    }
  }
  return undefined;
}

function hasMoreFrom(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const o = payload as Record<string, unknown>;
  if (o["hasMore"] === true || o["has_more"] === true) return true;
  const nested = o["data"];
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const d = nested as Record<string, unknown>;
    if (d["hasMore"] === true || d["has_more"] === true) return true;
  }
  return false;
}

function cursorFromPayload(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const o = payload as Record<string, unknown>;
  const direct = nextCursorFrom(payload);
  if (direct) return direct;
  const nested = o["data"];
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nextCursorFrom(nested);
  }
  return undefined;
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  if (!y || !m || !d) return ymd;
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function daysBetweenInclusive(startYmd: string, endYmd: string): number {
  const a = Date.parse(`${startYmd}T12:00:00.000Z`);
  const b = Date.parse(`${endYmd}T12:00:00.000Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.floor((b - a) / 86_400_000) + 1;
}

/** Split a YYYY-MM-DD range into chunks of at most `maxDays` inclusive days. */
export function chunkDateRangeYmd(
  startYmd: string,
  endYmd: string,
  maxDays = EMPLOYEE_REPORT_MAX_DAYS
): Array<{ startYmd: string; endYmd: string }> {
  let start = startYmd.slice(0, 10);
  const end = endYmd.slice(0, 10);
  if (start > end) return [];
  const out: Array<{ startYmd: string; endYmd: string }> = [];
  while (start <= end) {
    const chunkEnd = addDaysYmd(start, maxDays - 1);
    const capped = chunkEnd > end ? end : chunkEnd;
    out.push({ startYmd: start, endYmd: capped });
    start = addDaysYmd(capped, 1);
  }
  return out;
}

function assertEmployeeReportLookback(startYmd: string, endYmd: string): void {
  const today = getTodayYmdAthens();
  const earliest = addDaysYmd(today, -(EMPLOYEE_REPORT_MAX_LOOKBACK_DAYS - 1));
  if (startYmd < earliest) {
    throw new InflowwApiError(
      `Infloww employee reports only support the last ${EMPLOYEE_REPORT_MAX_LOOKBACK_DAYS} days (earliest ${earliest}).`,
      400
    );
  }
  if (endYmd > today) {
    throw new InflowwApiError("endTime cannot be in the future for Infloww employee reports.", 400);
  }
  if (startYmd > endYmd) {
    throw new InflowwApiError("Invalid date range: start is after end.", 400);
  }
}

const PERFORMER_ID_KEYS = [
  "platformPid",
  "platform_pid",
  "performerId",
  "performer_id",
  "creatorId",
  "creator_id",
  "modelId",
  "model_id",
] as const;

function mapSalesRow(row: unknown): import("@/types/infloww").InflowwEmployeeSalesRow {
  const r = (row ?? {}) as Record<string, unknown>;
  const nestedEmp =
    r["employee"] && typeof r["employee"] === "object" ? (r["employee"] as Record<string, unknown>) : null;
  const nestedPerf =
    r["performer"] && typeof r["performer"] === "object"
      ? (r["performer"] as Record<string, unknown>)
      : r["creator"] && typeof r["creator"] === "object"
        ? (r["creator"] as Record<string, unknown>)
        : null;
  const mapped: import("@/types/infloww").InflowwEmployeeSalesRow = {
    employeeId: idField(r, ["employeeId", "employee_id", "employeeID"]) || idField(nestedEmp ?? {}, ["id", "employeeId"]),
    performerId:
      idField(r, [...PERFORMER_ID_KEYS]) ||
      idField(nestedPerf ?? {}, ["id", "performerId", "creatorId", "platformPid"]),
    performerName: strField(r, ["performerName", "performer_name", "creatorName", "creator_name", "modelName"]) ??
      strField(nestedPerf ?? {}, ["name", "username", "displayName"]),
    date: ymdField(r),
    // Live Infloww sales-summary uses *Amount keys (cents). Keep legacy aliases too.
    sales: salesMoneyField(r, [
      "salesAmount",
      "sales_amount",
      "sales",
      "totalSales",
      "total_sales",
      "totalSalesAmount",
      "revenue",
      "totalRevenue",
    ]),
    ppvSales: salesMoneyField(r, [
      "ppvSalesAmount",
      "ppv_sales_amount",
      "ppvSales",
      "ppv_sales",
      "ppv",
      "ppvRevenue",
    ]),
    tips: salesMoneyField(r, [
      "tipsSalesAmount",
      "tips_sales_amount",
      "tipsAmount",
      "tips_amount",
      "tips",
      "tipSales",
      "tip_sales",
      "tipRevenue",
    ]),
    dmSales: salesMoneyField(r, [
      "directMessageSalesAmount",
      "direct_message_sales_amount",
      "dmSales",
      "dm_sales",
      "directMessageSales",
      "direct_message_sales",
      "messageSales",
    ]),
    pmmSales: salesMoneyField(r, [
      "priorityMassMessageSalesAmount",
      "priority_mass_message_sales_amount",
      "pmmSales",
      "pmm_sales",
      "priorityMassMessageSales",
      "priority_mass_message_sales",
    ]),
    ofmmSales: salesMoneyField(r, [
      "massMessageSalesAmount",
      "mass_message_sales_amount",
      "ofmmSales",
      "ofmm_sales",
      "ofMassMessageSales",
      "of_mass_message_sales",
      "massMessageSales",
    ]),
  };

  // Detect unmapped money if API renames fields again — never silently store $0 from real sales.
  const rawMoneyKeys = Object.keys(r).filter((k) => /sales|tip|ppv|amount|revenue/i.test(k));
  const rawHasPositive = rawMoneyKeys.some((k) => {
    const v = r[k];
    const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? "").replace(/,/g, ""));
    return Number.isFinite(n) && n > 0;
  });
  const mappedAllZero =
    mapped.sales === 0 &&
    mapped.ppvSales === 0 &&
    mapped.tips === 0 &&
    mapped.dmSales === 0 &&
    mapped.pmmSales === 0 &&
    mapped.ofmmSales === 0;
  if (rawHasPositive && mappedAllZero) {
    console.error("[infloww] sales row money fields not mapped (would store $0)", {
      keys: Object.keys(r),
      rawMoneyKeys,
      sample: Object.fromEntries(rawMoneyKeys.map((k) => [k, r[k]])),
    });
    throw new InflowwApiError(
      `Infloww sales-summary row has monetary values but none mapped (keys: ${rawMoneyKeys.join(", ") || "none"}).`,
      502,
      { path: "/employee-report/employee-sales-summary" }
    );
  }

  return mapped;
}

function mapChatRow(row: unknown): import("@/types/infloww").InflowwEmployeeChatRow {
  const r = (row ?? {}) as Record<string, unknown>;
  const nestedEmp =
    r["employee"] && typeof r["employee"] === "object" ? (r["employee"] as Record<string, unknown>) : null;
  const nestedPerf =
    r["performer"] && typeof r["performer"] === "object"
      ? (r["performer"] as Record<string, unknown>)
      : r["creator"] && typeof r["creator"] === "object"
        ? (r["creator"] as Record<string, unknown>)
        : null;
  return {
    employeeId: idField(r, ["employeeId", "employee_id", "employeeID"]) || idField(nestedEmp ?? {}, ["id", "employeeId"]),
    performerId:
      idField(r, [...PERFORMER_ID_KEYS]) ||
      idField(nestedPerf ?? {}, ["id", "performerId", "creatorId", "platformPid"]),
    performerName: strField(r, ["performerName", "performer_name", "creatorName", "creator_name", "modelName"]) ??
      strField(nestedPerf ?? {}, ["name", "username", "displayName"]),
    date: ymdField(r),
    messagesSent: Math.round(numField(r, ["messagesSent", "messages_sent", "directMessagesSent", "direct_messages_sent", "dmSent"])),
    ppvsSent: Math.round(numField(r, ["ppvsSent", "ppvs_sent", "directPpvsSent", "direct_ppvs_sent", "ppvSent"])),
    fansChatted: Math.round(numField(r, ["fansChatted", "fans_chatted", "fansMessaged", "fans_messaged"])),
    fansWhoSpent: Math.round(numField(r, ["fansWhoSpent", "fans_who_spent", "spendingFans", "fansSpent", "fansWhoSpentMoney"])),
    goldenRatio: nullableNumField(r, ["goldenRatio", "golden_ratio"]),
    fanCvr: nullableNumField(r, ["fanCvr", "fan_cvr", "fanConversionRate", "cvr"]),
    avgEarningsPerSpendingFan: nullableNumField(r, [
      "avgEarningsPerSpendingFan",
      "avg_earnings_per_spending_fan",
      "avgEarningsPerFan",
      "avg_earnings_per_fan",
    ]),
    responseTimeSeconds: nullableNumField(r, [
      "responseTimeSeconds",
      "response_time_seconds",
      "responseTime",
      "response_time",
      "avgResponseTime",
    ]),
    salesPerHour: nullableNumField(r, ["salesPerHour", "sales_per_hour"]),
    messagesPerHour: nullableNumField(r, ["messagesPerHour", "messages_per_hour", "messagesSentPerHour"]),
    fansChattedPerHour: nullableNumField(r, ["fansChattedPerHour", "fans_chatted_per_hour"]),
  };
}

async function paginateEmployeeReport(
  path: string,
  params: {
    startTime: string;
    endTime: string;
    employeeIds?: number[];
  }
): Promise<unknown[]> {
  const out: unknown[] = [];
  let cursor: string | undefined;
  let pages = 0;
  const MAX_PAGES = 200;
  do {
    pages += 1;
    if (pages > MAX_PAGES) {
      throw new InflowwApiError(`Infloww ${path}: exceeded max pagination pages (${MAX_PAGES}).`, 500);
    }
    const qp = new URLSearchParams({
      platformCode: "OnlyFans",
      startTime: params.startTime,
      endTime: params.endTime,
    });
    if (params.employeeIds?.length) {
      for (const id of params.employeeIds) qp.append("employeeIds", String(id));
    }
    if (cursor) qp.set("cursor", cursor);
    const payload = await inflowwFetchJson<unknown>(path, qp);
    if (payload && typeof payload === "object") {
      const errs = (payload as Record<string, unknown>)["errors"];
      if (Array.isArray(errs) && errs.length > 0) {
        const summary = errs
          .slice(0, 3)
          .map((e) => (typeof e === "string" ? e : JSON.stringify(e)))
          .join("; ");
        console.error("[infloww] employee-report returned errors", { path, errors: errs.slice(0, 5) });
        throw new InflowwApiError(`Infloww ${path} errors: ${summary}`, 502, { path });
      }
    }
    const rows = pickArray(payload);
    inflowwDebug("employee-report page", {
      path,
      page: pages,
      rowCount: rows.length,
      hasMore: hasMoreFrom(payload),
      cursor: Boolean(cursorFromPayload(payload)),
      sampleKeys: rows[0] && typeof rows[0] === "object" ? Object.keys(rows[0] as object).slice(0, 20) : [],
    });
    out.push(...rows);
    const more = hasMoreFrom(payload);
    cursor = more ? cursorFromPayload(payload) : undefined;
    if (!more) break;
    if (!cursor) {
      throw new InflowwApiError(`Infloww ${path}: hasMore=true but no cursor returned.`, 502);
    }
  } while (cursor);
  return out;
}

/**
 * Employee-report query params: Infloww expects date-only `YYYY-MM-DD`
 * (not full ISO datetime). Inputs are Athens calendar days from chunking —
 * never derive these via `toISOString().slice(0,10)` (UTC day shift risk).
 */
function rangeToDateBounds(startYmd: string, endYmd: string): { startTime: string; endTime: string } {
  const start =
    /^\d{4}-\d{2}-\d{2}$/.test(startYmd.trim().slice(0, 10))
      ? startYmd.trim().slice(0, 10)
      : ymdInAthens(startYmd);
  let end =
    /^\d{4}-\d{2}-\d{2}$/.test(endYmd.trim().slice(0, 10))
      ? endYmd.trim().slice(0, 10)
      : ymdInAthens(endYmd);
  if (!start || !end) {
    throw new InflowwApiError("Invalid from/to date range.", 400);
  }
  const today = getTodayYmdAthens();
  if (end > today) end = today;
  if (start > end) {
    throw new InflowwApiError("Invalid from/to date range: end is before start after capping to today.", 400);
  }
  return { startTime: start, endTime: end };
}

/**
 * Fetch employee sales summary for a date range (auto-chunks >31 days).
 * `employeeIds` optional — omit to fetch all agency employees.
 */
export async function fetchEmployeeSalesSummary(params: {
  startYmd: string;
  endYmd: string;
  employeeIds?: number[];
}): Promise<import("@/types/infloww").InflowwEmployeeSalesRow[]> {
  const start = params.startYmd.slice(0, 10);
  const end = params.endYmd.slice(0, 10);
  assertEmployeeReportLookback(start, end);
  const chunks = chunkDateRangeYmd(start, end);
  const out: import("@/types/infloww").InflowwEmployeeSalesRow[] = [];
  for (const chunk of chunks) {
    const times = rangeToDateBounds(chunk.startYmd, chunk.endYmd);
    const rows = await paginateEmployeeReport("/employee-report/employee-sales-summary", {
      ...times,
      employeeIds: params.employeeIds,
    });
    for (const row of rows) {
      const mapped = mapSalesRow(row);
      if (!mapped.date) {
        // Single-day chunks: default to that day; multi-day: leave undefined caller may discard
        if (chunk.startYmd === chunk.endYmd) mapped.date = chunk.startYmd;
      }
      out.push(mapped);
    }
  }
  return out;
}

/**
 * Fetch employee chat summary for a date range (auto-chunks >31 days).
 */
export async function fetchEmployeeChatSummary(params: {
  startYmd: string;
  endYmd: string;
  employeeIds?: number[];
}): Promise<import("@/types/infloww").InflowwEmployeeChatRow[]> {
  const start = params.startYmd.slice(0, 10);
  const end = params.endYmd.slice(0, 10);
  assertEmployeeReportLookback(start, end);
  const chunks = chunkDateRangeYmd(start, end);
  const out: import("@/types/infloww").InflowwEmployeeChatRow[] = [];
  for (const chunk of chunks) {
    const times = rangeToDateBounds(chunk.startYmd, chunk.endYmd);
    const rows = await paginateEmployeeReport("/employee-report/employee-chat-summary", {
      ...times,
      employeeIds: params.employeeIds,
    });
    for (const row of rows) {
      const mapped = mapChatRow(row);
      if (!mapped.date && chunk.startYmd === chunk.endYmd) mapped.date = chunk.startYmd;
      out.push(mapped);
    }
  }
  return out;
}

/**
 * Merge sales + chat rows keyed by employee|performer|date.
 * Prefer day-by-day fetches when dates are missing from API rows.
 */
export function mergeEmployeeSalesAndChat(
  sales: import("@/types/infloww").InflowwEmployeeSalesRow[],
  chat: import("@/types/infloww").InflowwEmployeeChatRow[],
  fallbackDate?: string
): import("@/types/infloww").InflowwEmployeeDayStats[] {
  const map = new Map<string, import("@/types/infloww").InflowwEmployeeDayStats>();

  const keyOf = (employeeId: number, performerId: number, date: string) =>
    `${employeeId}|${performerId}|${date}`;

  for (const s of sales) {
    const date = s.date ?? fallbackDate;
    if (!date) continue;
    const k = keyOf(s.employeeId, s.performerId, date);
    const existing = map.get(k);
    if (existing) {
      existing.sales += s.sales;
      existing.ppvSales += s.ppvSales;
      existing.tips += s.tips;
      existing.dmSales += s.dmSales;
      existing.pmmSales += s.pmmSales;
      existing.ofmmSales += s.ofmmSales;
      if (s.performerName) existing.performerName = s.performerName;
    } else {
      map.set(k, {
        employeeId: s.employeeId,
        performerId: s.performerId,
        performerName: s.performerName,
        date,
        sales: s.sales,
        ppvSales: s.ppvSales,
        tips: s.tips,
        dmSales: s.dmSales,
        pmmSales: s.pmmSales,
        ofmmSales: s.ofmmSales,
        messagesSent: 0,
        ppvsSent: 0,
        fansChatted: 0,
        fansWhoSpent: 0,
        goldenRatio: null,
        fanCvr: null,
        avgEarningsPerSpendingFan: null,
        responseTimeSeconds: null,
        salesPerHour: null,
        messagesPerHour: null,
        fansChattedPerHour: null,
      });
    }
  }

  for (const c of chat) {
    const date = c.date ?? fallbackDate;
    if (!date) continue;
    const k = keyOf(c.employeeId, c.performerId, date);
    let row = map.get(k);
    if (!row) {
      row = {
        employeeId: c.employeeId,
        performerId: c.performerId,
        performerName: c.performerName,
        date,
        sales: 0,
        ppvSales: 0,
        tips: 0,
        dmSales: 0,
        pmmSales: 0,
        ofmmSales: 0,
        messagesSent: 0,
        ppvsSent: 0,
        fansChatted: 0,
        fansWhoSpent: 0,
        goldenRatio: null,
        fanCvr: null,
        avgEarningsPerSpendingFan: null,
        responseTimeSeconds: null,
        salesPerHour: null,
        messagesPerHour: null,
        fansChattedPerHour: null,
      };
      map.set(k, row);
    }
    row.messagesSent += c.messagesSent;
    row.ppvsSent += c.ppvsSent;
    row.fansChatted += c.fansChatted;
    row.fansWhoSpent += c.fansWhoSpent;
    if (c.goldenRatio != null) row.goldenRatio = c.goldenRatio;
    if (c.fanCvr != null) row.fanCvr = c.fanCvr;
    if (c.avgEarningsPerSpendingFan != null) row.avgEarningsPerSpendingFan = c.avgEarningsPerSpendingFan;
    if (c.responseTimeSeconds != null) row.responseTimeSeconds = c.responseTimeSeconds;
    if (c.salesPerHour != null) row.salesPerHour = c.salesPerHour;
    if (c.messagesPerHour != null) row.messagesPerHour = c.messagesPerHour;
    if (c.fansChattedPerHour != null) row.fansChattedPerHour = c.fansChattedPerHour;
    if (c.performerName) row.performerName = c.performerName;
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Fetch + merge sales/chat for a range. When the range spans multiple days and
 * API rows omit dates, fetches day-by-day so each row can be attributed.
 */
export async function fetchEmployeeDayStats(params: {
  startYmd: string;
  endYmd: string;
  employeeIds?: number[];
}): Promise<import("@/types/infloww").InflowwEmployeeDayStats[]> {
  const start = params.startYmd.slice(0, 10);
  const end = params.endYmd.slice(0, 10);
  assertEmployeeReportLookback(start, end);
  const span = daysBetweenInclusive(start, end);

  // Multi-day without reliable date fields: sync day-by-day for attribution.
  if (span > 1) {
    const all: import("@/types/infloww").InflowwEmployeeDayStats[] = [];
    let cursor = start;
    while (cursor <= end) {
      const [sales, chat] = await Promise.all([
        fetchEmployeeSalesSummary({ startYmd: cursor, endYmd: cursor, employeeIds: params.employeeIds }),
        fetchEmployeeChatSummary({ startYmd: cursor, endYmd: cursor, employeeIds: params.employeeIds }),
      ]);
      all.push(...mergeEmployeeSalesAndChat(sales, chat, cursor));
      cursor = addDaysYmd(cursor, 1);
    }
    return all;
  }

  const [sales, chat] = await Promise.all([
    fetchEmployeeSalesSummary({ startYmd: start, endYmd: end, employeeIds: params.employeeIds }),
    fetchEmployeeChatSummary({ startYmd: start, endYmd: end, employeeIds: params.employeeIds }),
  ]);
  return mergeEmployeeSalesAndChat(sales, chat, start);
}

export { EMPLOYEE_REPORT_MAX_DAYS, EMPLOYEE_REPORT_MAX_LOOKBACK_DAYS };
