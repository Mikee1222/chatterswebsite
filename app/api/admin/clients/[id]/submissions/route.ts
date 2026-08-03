import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getPendingPaymentSubmissionsForClient } from "@/services/client-portal";
import { getPaymentMethodById } from "@/services/payment-methods";
import type { PaymentSubmissionRecord } from "@/types/client-portal";

type EnrichedSubmission = PaymentSubmissionRecord & {
  payment_method_label?: string;
  payment_method_type?: string;
};

async function enrichSubmissionsWithPaymentMethods(
  submissions: PaymentSubmissionRecord[]
): Promise<EnrichedSubmission[]> {
  const methodIds = [
    ...new Set(submissions.flatMap((s) => s.selected_payment_method).filter(Boolean)),
  ];
  const methodMap = new Map<string, { label: string; type: string }>();

  await Promise.all(
    methodIds.map(async (methodId) => {
      try {
        const method = await getPaymentMethodById(methodId);
        if (method) {
          methodMap.set(methodId, {
            label: method.label || method.type || "Unknown",
            type: method.type || "",
          });
        }
      } catch {
        // Payment method record may have been removed.
      }
    })
  );

  return submissions.map((submission) => {
    const methodId = submission.selected_payment_method[0];
    const method = methodId ? methodMap.get(methodId) : undefined;
    return {
      ...submission,
      payment_method_label: method?.label,
      payment_method_type: method?.type,
    };
  });
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "clients:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const submissions = await getPendingPaymentSubmissionsForClient(id);
  const enriched = await enrichSubmissionsWithPaymentMethods(submissions);
  return NextResponse.json({ submissions: enriched });
}
