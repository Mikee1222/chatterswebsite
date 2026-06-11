import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  createBillingCycle,
  getAllBillingCycles,
  getBillingCycleClientCounts,
} from "@/services/client-billing";
import { notifyClientsForBillingCycle } from "@/services/client-billing-notifications";

function clientIdsFromBody(client: string | string[] | undefined): string[] {
  if (!client) return [];
  return Array.isArray(client) ? client : [client];
}

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "billing:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const month = url.searchParams.get("month") ?? undefined;
  const includeCounts = url.searchParams.get("includeCounts") === "1";

  const cycles = await getAllBillingCycles(month);
  const chattingWeekly = cycles.filter((c) => c.kind === "chatting_weekly");

  if (!includeCounts) {
    return NextResponse.json({ cycles: chattingWeekly });
  }

  const counts = await getBillingCycleClientCounts(chattingWeekly.map((c) => c.id));
  return NextResponse.json({ cycles: chattingWeekly, clientCounts: counts });
}

const postSchema = z.object({
  client: z.union([z.array(z.string()), z.string()]).optional(),
  kind: z.enum(["chatting_weekly", "crm_monthly"]),
  period_start: z.string().min(1),
  period_end: z.string().min(1),
  due_date: z.string().min(1),
  currency: z.string().min(1).max(8),
  status: z.enum(["draft", "announced", "pending_review", "confirmed_paid", "overdue"]),
  model: z.array(z.string()).optional(),
  model_turnover: z.number().optional(),
  client_percentage_snapshot: z.number().optional(),
  amount_crm: z.number().optional(),
  amount: z.number().optional(),
});

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "billing:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
    const clientIds = clientIdsFromBody(parsed.data.client);
    const cycle = await createBillingCycle({
      ...parsed.data,
      client: clientIds,
    });
    console.log("[billing/cycles] cycle created id:", cycle.id);
    console.log("[billing/cycles] client IDs from body:", clientIds);

    await notifyClientsForBillingCycle({
      id: cycle.id,
      client: clientIds,
      kind: cycle.kind,
      period_start: cycle.period_start,
      period_end: cycle.period_end,
      amount_due: parsed.data.amount ?? parsed.data.amount_crm ?? cycle.amount ?? 0,
      currency: cycle.currency ?? "USD",
      due_date: cycle.due_date,
    }).catch((e) => console.error("[billing/cycles] notifyClientsForBillingCycle failed", e));

    return NextResponse.json({ ok: true, data: cycle });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create billing cycle";
    return NextResponse.json({ ok: false, userMessage: message, errorCode: "billing_cycle_create_failed" });
  }
}
