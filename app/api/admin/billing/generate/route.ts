import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import {
  generateBillingPeriodsRange,
  generateWeeklyPeriods,
} from "@/services/client-billing";

function isAdminOrManager(session: Awaited<ReturnType<typeof getSessionFromCookies>>) {
  return session != null && (session.role === "admin" || session.role === "manager");
}

const bodySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("month"), month: z.string().regex(/^\d{4}-\d{2}$/) }),
  z.object({
    mode: z.literal("range"),
    period_start: z.string().min(1),
    period_end: z.string().min(1),
  }),
]);

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!isAdminOrManager(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 }
    );
  }

  const result =
    parsed.data.mode === "month"? await generateWeeklyPeriods(parsed.data.month)
      : await generateBillingPeriodsRange(parsed.data.period_start, parsed.data.period_end);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.userMessage, errorCode: result.errorCode },
      { status: 400 }
    );
  }

  return NextResponse.json(result);
}
