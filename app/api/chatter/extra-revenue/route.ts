import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getTodayYmdAthens } from "@/lib/airtable-datetime";
import { chatterScreenshotAttachments } from "@/lib/chatter-screenshot-upload";
import { createExtraRevenueSubmission, type FineBonusPaymentMethod } from "@/services/fines-bonuses";
import { notifyAdmins } from "@/services/notification-service";
import { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

const PAYMENT_METHODS = new Set<FineBonusPaymentMethod>(["PayPal", "Revolut", "Other"]);

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session || getEffectiveStaffRole(session) !== "chatter") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.airtableUserId ?? session.id)?.trim();
  const userName = session.fullName?.trim() || session.email || "Chatter";
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const model_id = String(formData.get("model_id") ?? "").trim();
  const model_name = String(formData.get("model_name") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const payment_method = String(formData.get("payment_method") ?? "").trim() as FineBonusPaymentMethod;
  const payment_source = String(formData.get("payment_source") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const screenshot = formData.get("screenshot");

  if (!model_id || !model_name) {
    return NextResponse.json({ error: "Model is required" }, { status: 400 });
  }
  if (!PAYMENT_METHODS.has(payment_method)) {
    return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
  }
  if (payment_method === "Other" && !payment_source) {
    return NextResponse.json({ error: "Payment source is required for Other" }, { status: 400 });
  }

  const amount = Number.parseFloat(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Valid amount is required" }, { status: 400 });
  }
  if (!(screenshot instanceof File) || screenshot.size <= 0) {
    return NextResponse.json({ error: "Screenshot is required" }, { status: 400 });
  }

  const submissionId = `er_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const attachments = await chatterScreenshotAttachments(
    screenshot,
    "extra-revenue",
    submissionId
  ).catch((err) => {
    console.error("[chatter/extra-revenue] screenshot upload failed", err);
    return [] as { url: string; filename?: string }[];
  });

  const screenshot_url = attachments[0]?.url ?? "";
  if (!screenshot_url) {
    return NextResponse.json({ error: "Screenshot upload failed" }, { status: 500 });
  }

  const month = getTodayYmdAthens().slice(0, 7);

  try {
    const { id, record } = await createExtraRevenueSubmission({
      user_id: userId,
      user_name: userName,
      model_id,
      model_name,
      amount,
      payment_method,
      payment_source: payment_method === "Other" ? payment_source : undefined,
      screenshot_url,
      notes,
      month,
    });

    await notifyAdmins({
      event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: " Extra revenue submitted",
      body: `${userName} submitted €${amount.toFixed(2)} extra revenue for ${model_name} via ${payment_method}`,
      entity_type: "fine_bonus",
      entity_id: id,
      actor_user_id: userId,
      actor_name: userName,
    }).catch(() => {});

    return NextResponse.json({ success: true, id, entry: record, submission_id: submissionId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg || "Submit failed" }, { status: 500 });
  }
}
