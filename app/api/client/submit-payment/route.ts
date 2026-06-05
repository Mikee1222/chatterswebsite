import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import {
  createPaymentSubmission,
  getLatestSubmissionForCycle,
} from "@/services/client-portal";

type SubmitBody = {
  billing_cycle_id?: string;
  payment_method_id?: string;
  amount?: number;
  currency?: string;
  datetime?: string;
  reference_id?: string;
  note?: string;
  proof_url?: string;
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

  const clientId = user.id;

  const existing = await getLatestSubmissionForCycle(billingCycleId, clientId);
  if (existing && existing.status !== "rejected") {
    return NextResponse.json(
      { error: "A submission already exists for this billing cycle" },
      { status: 409 }
    );
  }

  await createPaymentSubmission({
    billing_cycle: [billingCycleId],
    client: [clientId],
    selected_payment_method: [paymentMethodId],
    submitted_amount: amount,
    submitted_currency: currency,
    submitted_datetime: datetime,
    reference_id: body.reference_id?.trim() || undefined,
    note: body.note?.trim() || undefined,
    proof_url: body.proof_url?.trim() || undefined,
    status: "pending_review",
  });

  return NextResponse.json({ success: true });
}
