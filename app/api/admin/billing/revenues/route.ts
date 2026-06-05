import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import {
  createBillingCycleRevenue,
  getBillingCycleRevenues,
  getBillingCycleRevenuesForCycles,
} from "@/services/client-billing";

function isAdminOrManager(session: Awaited<ReturnType<typeof getSessionFromCookies>>) {
  return session != null && (session.role === "admin" || session.role === "manager");
}

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!isAdminOrManager(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const cycleId = url.searchParams.get("cycleId");
  const cycleIdsParam = url.searchParams.get("cycleIds");

  if (cycleIdsParam) {
    const cycleIds = cycleIdsParam.split(",").filter(Boolean);
    const revenues = await getBillingCycleRevenuesForCycles(cycleIds);
    return NextResponse.json({ revenues });
  }

  if (cycleId) {
    const revenues = await getBillingCycleRevenues(cycleId);
    return NextResponse.json({ revenues });
  }

  return NextResponse.json({ error: "cycleId or cycleIds required" }, { status: 400 });
}

const postSchema = z.object({
  billing_cycle: z.array(z.string()).min(1),
  client: z.array(z.string()).min(1),
  model: z.array(z.string()).min(1),
  turnover_usd: z.number().positive(),
  fee_percent: z.number().min(0).max(100),
});

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!isAdminOrManager(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 }
    );
  }

  try {
    const revenue = await createBillingCycleRevenue(parsed.data);
    return NextResponse.json({ ok: true, data: revenue });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add revenue";
    return NextResponse.json(
      { ok: false, userMessage: message, errorCode: "add_revenue_failed" },
      { status: 400 }
    );
  }
}
