import { NextResponse } from "next/server";
import { z } from "zod";
import { requireModelApiContext } from "@/lib/model-api-auth";
import { createModelAvailabilityRequest } from "@/services/weekly-availability-requests-models";
import { WEEKLY_PROGRAM_DAY_OPTIONS } from "@/lib/weekly-program";
import { validateTimeWindows } from "@/lib/model-availability-windows";
import type { WeeklyProgramDay } from "@/types";

const windowSchema = z.object({
  start: z.string().min(1),
  end: z.string().min(1),
});

const bodySchema = z
  .object({
    week_start: z.string().min(1),
    day: z.string().min(1),
    notes: z.string().optional(),
    windows: z.array(windowSchema).optional(),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const hasWindows = data.windows && data.windows.length > 0;
    const hasPair = (data.start_time?.trim() ?? "") && (data.end_time?.trim() ?? "");
    if (!hasWindows && !hasPair) {
      ctx.addIssue({ code: "custom", message: "windows or start_time+end_time required" });
    }
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

  const rawWindows =
    parsed.data.windows && parsed.data.windows.length > 0
      ? parsed.data.windows
      : parsed.data.start_time && parsed.data.end_time
        ? [{ start: parsed.data.start_time, end: parsed.data.end_time }]
        : [];
  const v = validateTimeWindows(rawWindows);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }

  try {
    await createModelAvailabilityRequest({
      week_start: parsed.data.week_start,
      model_id: ctx.linkedModelId,
      model_name: (ctx.modelRecord.model_name ?? "").trim() || "Model",
      day,
      entry_type: "availability",
      time_windows: v.normalized,
      notes: parsed.data.notes,
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
