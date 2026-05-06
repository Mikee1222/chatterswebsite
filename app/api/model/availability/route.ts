import { NextResponse } from "next/server";
import { z } from "zod";
import { requireModelApiContext } from "@/lib/model-api-auth";
import { createModelAvailabilityRequest } from "@/services/weekly-availability-requests-models";
import { WEEKLY_PROGRAM_DAY_OPTIONS } from "@/lib/weekly-program";
import type { WeeklyProgramDay } from "@/types";

const bodySchema = z.object({
  week_start: z.string().min(1),
  day: z.string().min(1),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  notes: z.string().optional(),
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

  const day = parsed.data.day as WeeklyProgramDay;
  if (!WEEKLY_PROGRAM_DAY_OPTIONS.includes(day)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    await createModelAvailabilityRequest({
      week_start: parsed.data.week_start,
      model_id: ctx.linkedModelId,
      model_name: (ctx.modelRecord.model_name ?? "").trim() || "Model",
      day,
      entry_type: "availability",
      start_time: parsed.data.start_time,
      end_time: parsed.data.end_time,
      notes: parsed.data.notes,
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
