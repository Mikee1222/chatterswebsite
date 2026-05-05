import { NextRequest, NextResponse } from "next/server";
import {
  getInflowwEarnings,
  getInflowwModels,
  getInflowwTransactions,
  InflowwApiError,
} from "@/lib/infloww-api";
import type { InflowwEarningsResponse } from "@/types/infloww";

type CacheEntry = { expiresAt: number; data: InflowwEarningsResponse };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheKey(from: string, to: string, modelId: string) {
  return `${from}|${to}|${modelId}`;
}

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from") ?? "";
  const to = req.nextUrl.searchParams.get("to") ?? "";
  const modelId = req.nextUrl.searchParams.get("modelId") ?? "";

  if (!from || !to) {
    return NextResponse.json({ error: "Missing from/to date range." }, { status: 400 });
  }

  const key = cacheKey(from, to, modelId);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) {
    return NextResponse.json(hit.data, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300" },
    });
  }

  try {
    const [earnings, models, transactions] = await Promise.all([
      getInflowwEarnings({ from, to, modelId: modelId || undefined }),
      getInflowwModels(),
      getInflowwTransactions({ from, to, modelId: modelId || undefined }),
    ]);

    const totals = earnings.reduce(
      (acc, row) => {
        acc.gross += row.gross_earnings;
        acc.net += row.net_earnings;
        acc.cut += row.agency_cut;
        return acc;
      },
      { gross: 0, net: 0, cut: 0 }
    );

    const response: InflowwEarningsResponse = { earnings, models, transactions, totals };
    cache.set(key, { data: response, expiresAt: now + CACHE_TTL_MS });

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300" },
    });
  } catch (error) {
    if (error instanceof InflowwApiError) {
      const maybeRateLimited = error.status === 429;
      return NextResponse.json(
        { error: error.message, rateLimited: maybeRateLimited },
        { status: error.status }
      );
    }
    const message = error instanceof Error ? error.message : "Unknown Infloww API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
