import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { EVENT_TYPE_TO_AIRTABLE } from "@/lib/notifications-schema";
import {
  deleteBillingCycle,
  getBillingCycleById,
  updateBillingCycle,
} from "@/services/client-billing";
import { formatDueDateElGr, kindLabelFor } from "@/services/client-billing-notifications";
import { findExistingNotification } from "@/services/notifications";

const BILLING_CYCLE_ANNOUNCED_AIRTABLE =
  EVENT_TYPE_TO_AIRTABLE.system_alert ?? "system_alert";

const patchSchema = z.object({
  client: z.array(z.string()).optional(),
  kind: z.enum(["chatting_weekly", "crm_monthly"]).optional(),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  due_date: z.string().optional(),
  currency: z.string().optional(),
  status: z
    .enum(["draft", "announced", "pending_review", "confirmed_paid", "overdue"])
    .optional(),
  model: z.array(z.string()).optional(),
  model_turnover: z.number().optional(),
  client_percentage_snapshot: z.number().optional(),
  amount_crm: z.number().optional(),
  amount: z.number().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!(await hasPermission(session, "billing:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const current = await getBillingCycleById(id);
  if (current?.status === "confirmed_paid") {
    return NextResponse.json(
      { error: 'Cannot update billing cycle with status "confirmed_paid".' },
      { status: 400 }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 }
    );
  }

  try {
    const previousStatus = current?.status;
    const cycle = await updateBillingCycle(id, parsed.data);

    if (parsed.data.status === "announced" && previousStatus !== "announced") {
      const clientId = current?.client?.[0];
      if (clientId) {
        const exists = await findExistingNotification(
          clientId,
          "billing_cycle",
          cycle.id,
          BILLING_CYCLE_ANNOUNCED_AIRTABLE
        ).catch(() => false);

        if (!exists) {
          const { notify } = await import("@/services/notification-service");
          const kindLabel = kindLabelFor(cycle.kind);
          const amountDue = cycle.amount_due ?? cycle.amount ?? 0;
          const dueDateFormatted = formatDueDateElGr(cycle.due_date);

          await notify({
            user_id: clientId,
            event_type: "system_alert",
            priority: "high",
            title: "📋 Payment Due",
            body: `⏰ Your ${kindLabel} payment of $${Number(amountDue).toFixed(2)} ${cycle.currency ?? "USD"} is due on ${dueDateFormatted}.`,
            entity_type: "billing_cycle",
            entity_id: cycle.id,
            _triggerSource: "admin.billing.cycles.PATCH",
          })
            .then(() => console.log("[billing] notified client on announce", clientId))
            .catch((err) => console.error("[billing] notify on announce failed", clientId, err));
        }
      }
    }

    return NextResponse.json({ data: cycle });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update billing cycle";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!(await hasPermission(session, "billing:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  try {
    await deleteBillingCycle(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete billing cycle";
    return NextResponse.json({ ok: false, userMessage: message }, { status: 400 });
  }
}
