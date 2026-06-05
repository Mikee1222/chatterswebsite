import { NextResponse } from "next/server";
import { eurToUsd, getUsdToEurRate, usdToEur } from "@/lib/exchange";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const base = (searchParams.get("base") ?? "USD").toUpperCase();
  const quote = (searchParams.get("quote") ?? "EUR").toUpperCase();

  let rate = 1;
  if (base === "USD" && quote === "EUR") {
    rate = getUsdToEurRate();
  } else if (base === "EUR" && quote === "USD") {
    rate = 1 / getUsdToEurRate();
  } else if (base === quote) {
    rate = 1;
  } else {
    return NextResponse.json({ error: "Unsupported currency pair" }, { status: 400 });
  }

  return NextResponse.json({
    rate,
    updatedAt: Date.now(),
    base,
    quote,
    sample: base === "USD" ? usdToEur(1) : eurToUsd(1),
  });
}
