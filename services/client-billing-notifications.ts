"use server";

import { listAllRecords } from "@/lib/airtable-server";
import { linkedRecordIds } from "@/lib/airtable-linked";
import { notify } from "@/services/notification-service";
import { sendPushToUser } from "@/services/push-subscriptions";
import { getBillingCycleRevenues } from "@/services/client-billing";
import type { BillingCycleKind } from "@/types/client-portal";

const TABLES = {
  billing_cycles: "billing_cycles",
  billing_cycle_revenues: "billing_cycle_revenues",
} as const;

function payUrlForKind(kind: BillingCycleKind): string {
  return kind === "chatting_weekly" ? "/client/pay-chatting" : "/client/pay-crm";
}

function kindLabelFor(kind: BillingCycleKind): string {
  return kind === "chatting_weekly" ? "Chatting" : "CRM";
}

function formatBillingPeriod(periodStart: string, periodEnd: string): string {
  return `${periodStart} – ${periodEnd}`;
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

// Called when admin announces a billing cycle (status changes to "announced")
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
) {
  const kindLabel = kindLabelFor(cycleData.kind);
  const period = formatBillingPeriod(cycleData.period_start, cycleData.period_end);
  const amountDue = await amountDueForClient(cycleId, clientId, cycleData.amount_due);
  const amount = `${amountDue.toFixed(2)} ${cycleData.currency}`;

  await notify({
    user_id: clientId,
    event_type: "billing_cycle_announced",
    priority: "high",
    title: `Payment Due - ${kindLabel} ${period}`,
    body: `Your ${kindLabel} payment of ${amount} is due by ${cycleData.due_date}.`,
    entity_type: "billing_cycle",
    entity_id: cycleId,
    _triggerSource: "notifyClientBillingAnnounced",
  });

  await sendPushToUser(clientId, {
    title: `Payment Due - ${kindLabel} ${period}`,
    body: `${amount} due by ${cycleData.due_date}`,
    url: payUrlForKind(cycleData.kind),
  });
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

    for (const clientId of clientIds) {
      const revenue = revenueRecords.find(
        (r) =>
          linkedRecordIds(r.fields.billing_cycle).includes(rec.id) &&
          linkedRecordIds(r.fields.client).includes(clientId)
      );
      const feeUsd = revenue?.fields.fee_usd;
      const amountDue =
        typeof feeUsd === "number" && Number.isFinite(feeUsd) ? feeUsd : cycleAmountDue;
      const amount = `${amountDue.toFixed(2)} ${currency}`;

      await notify({
        user_id: clientId,
        event_type: "billing_due_reminder",
        priority: "high",
        title: "Payment Due in 2 Days",
        body: `Your ${kindLabel} payment of ${amount} is due on ${dueDate}.`,
        entity_type: "billing_cycle",
        entity_id: rec.id,
        _triggerSource: "sendBillingDueReminders",
      });

      await sendPushToUser(clientId, {
        title: "Payment Due in 2 Days",
        body: `${kindLabel}: ${amount} due ${dueDate}`,
        url: payUrlForKind(kind),
      });

      await new Promise((r) => setTimeout(r, 200));
    }
  }
}
