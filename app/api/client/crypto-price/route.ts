import { NextResponse } from "next/server";

/** Placeholder SOL/USD — replace with live price feed when available. */
const SOL_USD = 145;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") ?? "SOL").toUpperCase();
  if (symbol !== "SOL") {
    return NextResponse.json({ error: "Unsupported symbol" }, { status: 400 });
  }
  return NextResponse.json({ priceUsd: SOL_USD, updatedAt: Date.now() });
}
