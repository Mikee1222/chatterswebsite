/**
 * POST /api/model/period/log
 *
 * Response JSON (model period UI):
 * - `current_period`: active row where today ∈ [start_date, end_date], or null
 * - `predicted_next_start`: YYYY-MM-DD from last start + cycle, or null if none / missed flag
 * - `avg_cycle_length` / `avg_period_length`: rolling averages on modelss after sync
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireModelApiContext } from "@/lib/model-api-auth";
import { getModelById } from "@/services/modelss";
import { getModelCycleInfoResponse, getUpcomingPeriod, logModelPeriodFromStartDate } from "@/services/model-periods";
import { sendPeriodConfirmedEarlyNotification } from "@/services/period-notifications";

const bodySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(5000).optional(),
});

export async function POST(req: Request) {
  const ctx = await requireModelApiContext();
  if (!ctx.ok) return ctx.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const model = await getModelById(ctx.linkedModelId);
    const previousUpcoming = await getUpcomingPeriod(ctx.linkedModelId, model);
    await logModelPeriodFromStartDate(ctx.linkedModelId, parsed.data.start_date, parsed.data.notes, "model");
    if (previousUpcoming?.predicted_start && parsed.data.start_date < previousUpcoming.predicted_start) {
      await sendPeriodConfirmedEarlyNotification({
        modelId: ctx.linkedModelId,
        predictedDate: previousUpcoming.predicted_start,
      }).catch(() => {});
    }
    const cycle = await getModelCycleInfoResponse(ctx.linkedModelId);
    return NextResponse.json(cycle);
  } catch {
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
