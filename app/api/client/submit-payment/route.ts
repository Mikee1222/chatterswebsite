import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getClientAirtableId } from "@/lib/client-session";
import { getAdminNotificationIds } from "@/services/admin-notification-settings";
import { createNotification } from "@/services/notifications";
import {
  markBillingCycleAsNotified,
  markInvoiceAsViewed,
  markSubmissionAsSeen,
  submitClientPaymentProof,
} from "@/services/client-portal";

type SubmitBody = {
  billing_cycle_id?: string;
  payment_method_id?: string;
  amount?: number;
  currency?: string;
  datetime?: string;
  note?: string;
  proof_url?: string;
  proof_attachment?: Array<{ url: string; filename?: string }>;
};

export async function POST(req: Request) {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "client") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const billingCycleId = body.billing_cycle_id?.trim();
  const paymentMethodId = body.payment_method_id?.trim();
  const amount = body.amount;
  const currency = body.currency?.trim();
  const datetime = body.datetime?.trim() || new Date().toISOString();

  if (!billingCycleId || !paymentMethodId || amount == null || !currency) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const allowedCurrencies = ["USD", "EUR", "USDT", "USDC", "SOL"];
  if (!allowedCurrencies.includes(currency)) {
    return NextResponse.json({ error: "Invalid currency" }, { status: 400 });
  }

  const hasProofUrl = Boolean(body.proof_url?.trim());
  const hasProofAttachment =
    Array.isArray(body.proof_attachment) &&
    body.proof_attachment.length > 0 &&
    body.proof_attachment.some((a) => a?.url);
  if (!hasProofUrl && !hasProofAttachment) {
    return NextResponse.json({ error: "Proof of payment is required" }, { status: 400 });
  }

  const clientId = getClientAirtableId(user);

  try {
    const result = await submitClientPaymentProof(clientId, {
      billing_cycle_id: billingCycleId,
      payment_method_id: paymentMethodId,
      amount,
      currency,
      datetime,
      notes: body.note?.trim(),
      proof_url: body.proof_url?.trim(),
      proof_attachment: body.proof_attachment,
    });

    if (result.alreadySubmitted) {
      return NextResponse.json(
        { error: "A submission already exists for this billing cycle", alreadySubmitted: true },
        { status: 409 }
      );
    }

    const adminIds = await getAdminNotificationIds();
    await Promise.all(
      adminIds.map((adminId) =>
        createNotification({
          user_id: adminId,
          category: "system",
          event_type: "system_alert",
          priority: "high",
          title: "Payment proof submitted",
          body: "Client submitted payment proof for review",
          entity_type: "payment_submission",
          entity_id: result.submissionId ?? billingCycleId,
        })
      )
    );

    return NextResponse.json({ success: true, submissionId: result.submissionId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Submission failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "client") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { action?: string; recordId?: string };
  try {
    body = (await req.json()) as { action?: string; recordId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const recordId = body.recordId?.trim();
  if (!recordId || !body.action) {
    return NextResponse.json({ error: "Missing action or recordId" }, { status: 400 });
  }

  try {
    if (body.action === "invoice_viewed") {
      await markInvoiceAsViewed(recordId);
    } else if (body.action === "submission_seen") {
      await markSubmissionAsSeen(recordId);
    } else if (body.action === "cycle_notified") {
      await markBillingCycleAsNotified(recordId);
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
