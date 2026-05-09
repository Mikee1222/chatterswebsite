import { NextResponse } from "next/server";
import { z } from "zod";
import { requireModelApiContext } from "@/lib/model-api-auth";
import { updateModel } from "@/services/modelss";

const bodySchema = z.object({
  cycle_length: z.number().int().min(21).max(45),
  period_length: z.number().int().min(2).max(10),
});

/**
 * PATCH /api/model/period/settings — update `avg_cycle_length` and `avg_period_length` on modelss.
 */
export async function PATCH(req: Request) {
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
    await updateModel(ctx.linkedModelId, {
      avg_cycle_length: parsed.data.cycle_length,
      avg_period_length: parsed.data.period_length,
    });
    return NextResponse.json({
      success: true,
      avg_cycle_length: parsed.data.cycle_length,
      avg_period_length: parsed.data.period_length,
    });
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
