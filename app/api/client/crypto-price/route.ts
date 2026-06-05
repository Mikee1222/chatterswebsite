import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") ?? "SOL").toUpperCase();
  if (symbol !== "SOL") {
    return NextResponse.json({ error: "Unsupported symbol" }, { status: 400 });
  }

  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
      { next: { revalidate: 300 } } // cache 5 minutes
    );
    if (!res.ok) throw new Error("CoinGecko fetch failed");
    const data = await res.json() as { solana: { usd: number } };
    const priceUsd = data.solana.usd;

    return NextResponse.json({
      priceUsd,
      updatedAt: Date.now(),
      source: "coingecko",
    });
  } catch {
    // Fallback to last known price
    return NextResponse.json({
      priceUsd: 145,
      updatedAt: Date.now(),
      fallback: true,
    });
  }
}
