import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getInflowwEarningsSnapshot, InflowwApiError } from "@/lib/infloww-api";
import type { InflowwEarningsResponse } from "@/types/infloww";
import { listEarningsAgencyCutConfig } from "@/services/earnings-config";

type CacheEntry = { expiresAt: number; data: InflowwEarningsResponse };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

function cacheKey(from: string, to: string, modelId: string, agencySig: string) {
  return `${from}|${to}|${modelId}|${agencySig}`;
}

export async function GET(req: NextRequest) {
  const user = await getSessionFromCookies();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "admin" && user.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const from = req.nextUrl.searchParams.get("from") ?? "";
  const to = req.nextUrl.searchParams.get("to") ?? "";
  const modelId = req.nextUrl.searchParams.get("modelId") ?? "";

  if (!from || !to) {
    return NextResponse.json({ error: "Missing from/to date range." }, { status: 400 });
  }

  const now = Date.now();

  try {
    const agencyPct: Record<string, number> = await listEarningsAgencyCutConfig().catch(() => ({}));
    const agencySig =
      Object.keys(agencyPct)
        .sort()
        .map((k) => `${k}:${agencyPct[k] ?? 0}`)
        .join(";") || "none";
    const key = cacheKey(from, to, modelId, agencySig);
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now) {
      return NextResponse.json(hit.data, {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300" },
      });
    }

    const response = await getInflowwEarningsSnapshot({
      from,
      to,
      modelId: modelId || undefined,
      agencyCutPercentByModelId: agencyPct,
    });

    cache.set(key, { data: response, expiresAt: now + CACHE_TTL_MS });

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300" },
    });
  } catch (error) {
    if (error instanceof InflowwApiError) {
      const maybeRateLimited = error.status === 429;
      if (error.status === 400 && /invalid\s+creator|creator\s+status/i.test(error.message)) {
        const empty: InflowwEarningsResponse = {
          earnings: [],
          transactions: [],
          models: [],
          totals: { gross: 0, net: 0, cut: 0 },
        };
        return NextResponse.json(empty, {
          headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=120" },
        });
      }
      return NextResponse.json(
        { error: error.message, rateLimited: maybeRateLimited },
        { status: error.status }
      );
    }
    const message = error instanceof Error ? error.message : "Unknown Infloww API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
