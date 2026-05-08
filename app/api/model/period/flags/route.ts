import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/lib/routes";
import { requireModelLinkedModelId } from "@/lib/require-model-api-session";
import { getModelById } from "@/services/modelss";
import {
  getPeriodRecordForFlags,
  getUpcomingPeriod,
  syncLatestPeriodPredictedNext,
  syncModelPeriodAveragesToModelss,
  updatePeriod,
} from "@/services/model-periods";
import { sendPeriodConfirmedEarlyNotification, sendPeriodPredictionResetNotification } from "@/services/period-notifications";

const bodySchema = z.object({
  action: z.enum(["came_early", "missed_period"]),
});

export async function PATCH(request: Request) {
  const auth = await requireModelLinkedModelId();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid body.", details: parsed.error.flatten() }, { status: 400 });
  }

  const modelId = auth.modelId;
  const target = await getPeriodRecordForFlags(modelId);
  if (!target) {
    return NextResponse.json({ success: false, error: "No period row to update." }, { status: 400 });
  }

  try {
    const model = await getModelById(modelId);
    const previousUpcoming = await getUpcomingPeriod(modelId, model);
    if (parsed.data.action === "came_early") {
      await updatePeriod(target.id, { came_early: true, missed_period: false });
      await syncModelPeriodAveragesToModelss(modelId);
      const fresh = await getModelById(modelId);
      await syncLatestPeriodPredictedNext(modelId, fresh);
      if (previousUpcoming?.predicted_start) {
        await sendPeriodConfirmedEarlyNotification({
          modelId,
          predictedDate: previousUpcoming.predicted_start,
        }).catch(() => {});
      }
    } else {
      await updatePeriod(target.id, {
        missed_period: true,
        came_early: false,
        predicted_next_date: null,
      });
      await syncModelPeriodAveragesToModelss(modelId);
      const freshMissed = await getModelById(modelId);
      await syncLatestPeriodPredictedNext(modelId, freshMissed);
      if (previousUpcoming?.predicted_start) {
        await sendPeriodPredictionResetNotification({
          modelId,
          previousPredictedDate: previousUpcoming.predicted_start,
        }).catch(() => {});
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }

  revalidatePath(ROUTES.settings);
  revalidatePath(ROUTES.model.home);
  revalidatePath(ROUTES.chatter.weeklyProgram);
  revalidatePath(ROUTES.model.weeklyAvailability);

  return NextResponse.json({ success: true });
}
