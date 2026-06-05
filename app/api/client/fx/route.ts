import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const base = (searchParams.get("base") ?? "USD").toUpperCase();
  const quote = (searchParams.get("quote") ?? "EUR").toUpperCase();

  try {
    // Use exchangerate-api.com free tier (no key needed for basic pairs)
    const res = await fetch(
      `https://api.exchangerate-api.com/v4/latest/${base}`,
      { next: { revalidate: 3600 } } // cache 1 hour
    );
    if (!res.ok) throw new Error("FX fetch failed");
    const data = await res.json() as { rates: Record<string, number> };
    const rate = data.rates[quote];
    if (!rate) throw new Error(`No rate for ${quote}`);

    return NextResponse.json({
      rate,
      updatedAt: Date.now(),
      base,
      quote,
    });
  } catch {
    // Fallback to placeholder if API fails
    const fallback = base === "USD" && quote === "EUR" ? 0.92
      : base === "EUR" && quote === "USD" ? 1.087
      : 1;
    return NextResponse.json({
      rate: fallback,
      updatedAt: Date.now(),
      base,
      quote,
      fallback: true,
    });
  }
}
