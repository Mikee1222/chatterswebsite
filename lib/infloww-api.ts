import type { InflowwEarnings, InflowwModel, InflowwTransaction } from "@/types/infloww";

const INFLOWW_BASE_URL = "https://api.infloww.ai/v1";

export class InflowwApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getInflowwEnv() {
  const oid = process.env.INFLOWW_AGENCY_OID?.trim();
  const apiKey = process.env.INFLOWW_API_KEY?.trim();
  if (!oid || !apiKey) {
    throw new InflowwApiError("Infloww credentials are not configured.", 500);
  }
  return { oid, apiKey };
}

function normalizeMoney(value: unknown): number {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? "0"));
  if (Number.isNaN(n)) return 0;
  return n;
}

async function inflowwFetch<T>(path: string, searchParams?: URLSearchParams): Promise<T> {
  const { apiKey } = getInflowwEnv();
  const url = `${INFLOWW_BASE_URL}${path}${searchParams ? `?${searchParams.toString()}` : ""}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new InflowwApiError(`Infloww API ${res.status}: ${body.slice(0, 300)}`, res.status);
  }
  return (await res.json()) as T;
}

function pickArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const candidateKeys = ["data", "results", "items", "earnings", "models", "transactions"];
    for (const k of candidateKeys) {
      const maybe = (payload as Record<string, unknown>)[k];
      if (Array.isArray(maybe)) return maybe;
    }
  }
  return [];
}

export async function getInflowwModels(): Promise<InflowwModel[]> {
  const { oid } = getInflowwEnv();
  const payload = await inflowwFetch<unknown>(`/agencies/${oid}/models`);
  return pickArray(payload).map((row, idx) => {
    const r = (row ?? {}) as Record<string, unknown>;
    const id = String(r.id ?? r.model_id ?? idx);
    const name = String(r.name ?? r.model_name ?? r.username ?? `Model ${idx + 1}`);
    return { id, name };
  });
}

export async function getInflowwEarnings(params: {
  from: string;
  to: string;
  modelId?: string;
}): Promise<InflowwEarnings[]> {
  const { oid } = getInflowwEnv();
  const qp = new URLSearchParams({ from: params.from, to: params.to });
  if (params.modelId) qp.set("model_id", params.modelId);
  const payload = await inflowwFetch<unknown>(`/agencies/${oid}/earnings`, qp);
  return pickArray(payload).map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      model_id: String(r.model_id ?? r.id ?? ""),
      model_name: String(r.model_name ?? r.name ?? "Unknown model"),
      gross_earnings: normalizeMoney(r.gross_earnings ?? r.gross ?? r.amount),
      net_earnings: normalizeMoney(r.net_earnings ?? r.net ?? r.amount),
      agency_cut: normalizeMoney(r.agency_cut ?? r.cut ?? 0),
      date: String(r.date ?? r.created_at ?? new Date().toISOString()),
    };
  });
}

export async function getInflowwTransactions(params: {
  from: string;
  to: string;
  modelId?: string;
}): Promise<InflowwTransaction[]> {
  const { oid } = getInflowwEnv();
  const qp = new URLSearchParams({ from: params.from, to: params.to });
  if (params.modelId) qp.set("model_id", params.modelId);
  const payload = await inflowwFetch<unknown>(`/agencies/${oid}/transactions`, qp);
  return pickArray(payload).map((row, idx) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      id: String(r.id ?? idx),
      model_id: String(r.model_id ?? ""),
      model_name: String(r.model_name ?? r.name ?? "Unknown model"),
      amount: normalizeMoney(r.amount),
      date: String(r.date ?? r.created_at ?? new Date().toISOString()),
      type: r.type ? String(r.type) : undefined,
    };
  });
}
