import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { listAllModelss } from "@/services/modelss";

/**
 * GET /api/chatter/model-payment-info — active models with payment fields for extra revenue modal.
 */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session || getEffectiveStaffRole(session) !== "chatter") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const modelss = await listAllModelss('{status} = "active"');
    const models = modelss
      .map((m) => ({
        id: m.id,
        model_name: m.model_name,
        paypal_email: m.paypal_email,
        paypal_link: m.paypal_link,
        revolut_tag: m.revolut_tag,
        payment_notes: m.payment_notes,
        payment_threshold_eur: m.payment_threshold_eur,
      }))
      .sort((a, b) => a.model_name.localeCompare(b.model_name));
    return NextResponse.json({ models });
  } catch {
    return NextResponse.json({ models: [] });
  }
}
