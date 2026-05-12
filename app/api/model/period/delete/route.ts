import { NextResponse } from "next/server";
import { z } from "zod";
import { requireModelApiContext } from "@/lib/model-api-auth";
import { getModelById } from "@/services/modelss";
import {
  deletePeriod,
  getPeriodsForModel,
  syncLatestPeriodPredictedNext,
  syncModelPeriodAveragesToModelss,
} from "@/services/model-periods";

const bodySchema = z.object({
  id: z.string().min(1),
});

export async function DELETE(req: Request) {
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
    const periods = await getPeriodsForModel(ctx.linkedModelId);
    const ownedPeriod = periods.some((period) => period.id === parsed.data.id);
    if (!ownedPeriod) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }

    await deletePeriod(parsed.data.id);
    await syncModelPeriodAveragesToModelss(ctx.linkedModelId);
    const model = await getModelById(ctx.linkedModelId);
    await syncLatestPeriodPredictedNext(ctx.linkedModelId, model);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
