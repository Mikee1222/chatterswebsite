import { NextResponse } from "next/server";
import { z } from "zod";
import { requireModelApiContext } from "@/lib/model-api-auth";
import { getModelById } from "@/services/modelss";
import { getUpcomingPeriod, markCurrentPeriodMissed } from "@/services/model-periods";
import { sendPeriodPredictionResetNotification } from "@/services/period-notifications";

const bodySchema = z.object({}).strict();

async function parseOptionalEmptyBody(req: Request): Promise<NextResponse | null> {
  const text = await req.text();
  if (!text.trim()) return null;
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  return null;
}

export async function POST(req: Request) {
  const ctx = await requireModelApiContext();
  if (!ctx.ok) return ctx.response;

  const bad = await parseOptionalEmptyBody(req);
  if (bad) return bad;

  try {
    const model = await getModelById(ctx.linkedModelId);
    const previousUpcoming = await getUpcomingPeriod(ctx.linkedModelId, model);
    await markCurrentPeriodMissed(ctx.linkedModelId);
    if (previousUpcoming?.predicted_start) {
      await sendPeriodPredictionResetNotification({
        modelId: ctx.linkedModelId,
        previousPredictedDate: previousUpcoming.predicted_start,
      }).catch(() => {});
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NO_PERIOD_ROW") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
