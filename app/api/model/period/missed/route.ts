import { NextResponse } from "next/server";
import { requireModelApiContext } from "@/lib/model-api-auth";
import { getModelById } from "@/services/modelss";
import { getUpcomingPeriod, markCurrentPeriodMissed } from "@/services/model-periods";
import { sendPeriodPredictionResetNotification } from "@/services/period-notifications";

/**
 * POST /api/model/period/missed
 * Body: optional JSON object or empty body. Extra keys are ignored (client may send `{}` or nothing).
 */
export async function POST(req: Request) {
  const ctx = await requireModelApiContext();
  if (!ctx.ok) return ctx.response;

  let text = "";
  try {
    text = await req.text();
  } catch {
    text = "";
  }
  console.log("[period/missed] raw length:", text.length, "preview:", text.slice(0, 500));

  if (text.trim() !== "") {
    let json: unknown;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    console.log("[period/missed] received body:", json);
    if (json === null || typeof json !== "object" || Array.isArray(json)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
  }

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
