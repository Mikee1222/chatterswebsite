
import { listAllRecords } from "@/lib/airtable-server";
import { linkedRecordIds } from "@/lib/airtable-linked";
import { NOTIFICATION_EVENT } from "@/lib/notification-types";
import { formatMoney } from "@/lib/notification-copy";
import { EVENT_TYPE_TO_AIRTABLE } from "@/lib/notifications-schema";
import { notify, notifyByRoleConfig } from "@/services/notification-service";
import { findExistingNotification } from "@/services/notifications";
import { getBillingCycleRevenues } from "@/services/client-billing";
import type { BillingCycleKind } from "@/types/client-portal";

const TABLES = {
  billing_cycles: "billing_cycles",
  billing_cycle_revenues: "billing_cycle_revenues",
} as const;

export function kindLabelFor(kind: BillingCycleKind): string {
  return kind === "chatting_weekly" ? "Chatting" : "CRM";
}

export function formatBillingPeriod(periodStart: string, periodEnd: string): string {
  return `${periodStart} – ${periodEnd}`;
}

export function formatDueDateElGr(ymd: string): string {
  const s = String(ymd).trim().slice(0, 10);
  const d = new Date(`${s}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("el-GR", {
    timeZone: "Europe/Athens",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Resolve client IDs from cycle.client or billing_cycle_revenues (weekly cycles). */
export async function getClientIdsForBillingCycle(
  cycleId: string,
  cycleClientIds: string[]
): Promise<string[]> {
  if (cycleClientIds.length > 0) return cycleClientIds;

  const revenues = await getBillingCycleRevenues(cycleId);
  const clientIds = new Set<string>();
  for (const revenue of revenues) {
    for (const clientId of revenue.client) {
      if (clientId) clientIds.add(clientId);
    }
  }
  return [...clientIds];
}

async function amountDueForClient(
  cycleId: string,
  clientId: string,
  fallbackAmount: number
): Promise<number> {
  const revenues = await getBillingCycleRevenues(cycleId);
  const revenue = revenues.find((r) => r.client.includes(clientId));
  if (revenue?.fee_usd != null && Number.isFinite(revenue.fee_usd)) {
    return revenue.fee_usd;
  }
  return fallbackAmount;
}

const BILLING_CYCLE_ANNOUNCED_AIRTABLE =
  EVENT_TYPE_TO_AIRTABLE.billing_cycle_announced ?? "system_alert";

// Called when a billing cycle is created or status changes to "announced"
export async function notifyClientBillingAnnounced(
  cycleId: string,
  clientId: string,
  cycleData: {
    kind: BillingCycleKind;
    period_start: string;
    period_end: string;
    amount_due: number;
    currency: string;
    due_date: string;
  }
): Promise<boolean> {
  const exists = await findExistingNotification(
    clientId,
    "billing_cycle",
    cycleId,
    BILLING_CYCLE_ANNOUNCED_AIRTABLE
  ).catch(() => false);
  if (exists) return false;

  const kindLabel = kindLabelFor(cycleData.kind);
  const period = formatBillingPeriod(cycleData.period_start, cycleData.period_end);
  const amountDue = await amountDueForClient(cycleId, clientId, cycleData.amount_due);
  const amount = formatMoney(amountDue, cycleData.currency);
  const dueDateFormatted = formatDueDateElGr(cycleData.due_date);

  const clients = await import("@/services/users").then((m) => m.listAllUsers()).catch(() => []);
  const clientUser = clients.find((u) => u.id === clientId);
  const clientName =
    clientUser?.full_name?.trim() || clientUser?.email?.trim() || "Client";

  await notifyByRoleConfig(NOTIFICATION_EVENT.BILLING_CYCLE_ANNOUNCED, {
    personal_user_id: clientId,
    priority: "high",
    title: `💳 Payment due — ${kindLabel} ${period}`,
    body: `Your ${kindLabel} payment of ${amount} is due by ${dueDateFormatted}.`,
    entity_type: "billing_cycle",
    entity_id: cycleId,
    context: { clientName, amount },
  });

  return true;
}

export async function notifyClientsForBillingCycle(cycle: {
  id: string;
  client: string[];
  kind: BillingCycleKind;
  period_start: string;
  period_end: string;
  amount_due?: number | null;
  amount?: number | null;
  currency?: string | null;
  due_date: string;
}): Promise<void> {
  const clientIds = await getClientIdsForBillingCycle(cycle.id, cycle.client);
  const payload = {
    kind: cycle.kind,
    period_start: cycle.period_start,
    period_end: cycle.period_end,
    amount_due: cycle.amount_due ?? cycle.amount ?? 0,
    currency: cycle.currency ?? "USD",
    due_date: cycle.due_date,
  };

  for (const clientId of clientIds) {
    await notifyClientBillingAnnounced(cycle.id, clientId, payload).catch((err) =>
      console.error("[billing] notifyClientBillingAnnounced failed", err)
    );
  }
}

// Called by cron job daily — sends reminder 2 days before due date
export async function sendBillingDueReminders() {
  const today = new Date();
  const twoDaysFromNow = new Date(today);
  twoDaysFromNow.setDate(today.getDate() + 2);
  const targetDate = twoDaysFromNow.toISOString().slice(0, 10);

  const records = await listAllRecords<Record<string, unknown>>(TABLES.billing_cycles, {
    _caller: "sendBillingDueReminders",
  });

  const dueSoon = records.filter((r) => {
    const f = r.fields;
    return (
      String(f.due_date ?? "").slice(0, 10) === targetDate &&
      (f.status === "announced" || f.status === "overdue")
    );
  });

  const revenueRecords = await listAllRecords<Record<string, unknown>>(TABLES.billing_cycle_revenues, {
    fields: ["billing_cycle", "client", "fee_usd"],
    _caller: "sendBillingDueReminders:revenues",
  });

  for (const rec of dueSoon) {
    const f = rec.fields;
    const cycleClientIds = linkedRecordIds(f.client);
    const clientIds =
      cycleClientIds.length > 0
        ? cycleClientIds
        : [
            ...new Set(
              revenueRecords
                .filter((r) => linkedRecordIds(r.fields.billing_cycle).includes(rec.id))
                .flatMap((r) => linkedRecordIds(r.fields.client))
            ),
          ];

    const kind = String(f.kind ?? "chatting_weekly") as BillingCycleKind;
    const kindLabel = kindLabelFor(kind);
    const dueDate = String(f.due_date ?? "");
    const currency = String(f.currency ?? "USD");
    const cycleAmountDue = typeof f.amount_due === "number" ? f.amount_due : 0;
    const cycleStatus = String(f.status ?? "");
    const isOverdue = cycleStatus === "overdue";

    for (const clientId of clientIds) {
      const revenue = revenueRecords.find(
        (r) =>
          linkedRecordIds(r.fields.billing_cycle).includes(rec.id) &&
          linkedRecordIds(r.fields.client).includes(clientId)
      );
      const feeUsd = revenue?.fields.fee_usd;
      const amountDue =
        typeof feeUsd === "number" && Number.isFinite(feeUsd) ? feeUsd : cycleAmountDue;
      const amount = formatMoney(amountDue, currency);

      const reminderTitle = isOverdue ? "🚨 Payment overdue" : "⏰ Payment due in 2 days";
      const reminderBody = isOverdue
        ? `Your ${kindLabel} payment of ${amount} was due on ${dueDate}. Please pay as soon as possible.`
        : `Your ${kindLabel} payment of ${amount} is due in 2 days. Please submit proof before the deadline.`;

      await notify({
        user_id: clientId,
        event_type: "billing_due_reminder",
        priority: "high",
        title: reminderTitle,
        body: reminderBody,
        entity_type: "billing_cycle",
        entity_id: rec.id,
        _triggerSource: "sendBillingDueReminders",
      });

      await new Promise((r) => setTimeout(r, 200));
    }
  }
}
