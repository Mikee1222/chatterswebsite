import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { filterActiveModelsForAssignment } from "@/lib/assignment-filters";
import { listAllModelss } from "@/services/modelss";

/**
 * GET /api/chatter/model-payment-info — active models with payment fields for extra revenue modal.
 *
 * Gated on `shifts:view` to match `/api/chatter/extra-revenue` and the rebill/tip model list.
 * Must NOT require admin-only `payments:view`, or chatters get 403, the fetch fails silently,
 * and the FAB extra-revenue modal shows an empty model dropdown.
 */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "shifts:view"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const modelss = filterActiveModelsForAssignment(await listAllModelss());
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
