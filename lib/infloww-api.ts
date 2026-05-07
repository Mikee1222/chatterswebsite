import type { InflowwEarnings, InflowwEarningsResponse, InflowwModel, InflowwTransaction } from "@/types/infloww";
import { athensYmdEndUtcMs, athensYmdStartUtcMs } from "@/lib/airtable-datetime";
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

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
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
  const init: RequestInit = {
    headers: inflowwHeaders(),
    next: { revalidate: 300 },
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
      throw new InflowwApiError(`Infloww API ${res.status}: ${body.slice(0, 300)}`, res.status);
    }
    return (await res.json()) as T;
  }
  throw new InflowwApiError(`Infloww API 429 (rate limited): ${last429Body.slice(0, 300)}`, 429);
}

function pickArray(payload: unknown, depth = 0): unknown[] {
  if (depth > 4) return [];
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    const candidateKeys = ["data", "results", "items", "creators", "transactions", "records", "list", "rows", "content"];
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
  return { id, name };
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
