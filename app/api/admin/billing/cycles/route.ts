import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  createBillingCycle,
  getAllBillingCycles,
  getBillingCycleClientCounts,
} from "@/services/client-billing";
import { formatDueDateElGr, kindLabelFor } from "@/services/client-billing-notifications";

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

    const kindLabel = kindLabelFor(cycle.kind);
    const amountDue = parsed.data.amount ?? parsed.data.amount_crm ?? cycle.amount ?? 0;
    const amount = `${Number(amountDue).toFixed(2)} ${cycle.currency ?? "USD"}`;
    const dueDateFormatted = formatDueDateElGr(cycle.due_date);

    for (const clientId of clientIds) {
      if (!clientId) continue;
      console.log("[billing/cycles] calling notify for client:", clientId);
      try {
        const { notify } = await import("@/services/notification-service");
        const result = await notify({
          user_id: clientId,
          event_type: "system_alert",
          priority: "high",
          title: `📋 New Billing Cycle`,
          body: `💳 A new ${kindLabel} billing cycle has been created. Amount: ${amount}. Due: ${dueDateFormatted}.`,
          entity_type: "billing_cycle",
          entity_id: cycle.id,
          _triggerSource: "admin.billing.cycles.POST",
        });
        console.log("[billing/cycles] notify result:", JSON.stringify(result));
      } catch (e) {
        console.error("[billing/cycles] notify THREW:", e);
      }
      console.log("[billing/cycles] notify completed for client:", clientId);
    }

    return NextResponse.json({ ok: true, data: cycle });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create billing cycle";
    return NextResponse.json({ ok: false, userMessage: message, errorCode: "billing_cycle_create_failed" });
  }
}
