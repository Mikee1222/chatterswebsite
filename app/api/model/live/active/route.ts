import { NextResponse } from "next/server";
import { requireModelApiContext } from "@/lib/model-api-auth";
import { getActiveLiveStreamForModel } from "@/services/model-live-streams";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireModelApiContext();
  if (!ctx.ok) return ctx.response;

  let record: Awaited<ReturnType<typeof getActiveLiveStreamForModel>> = null;
  try {
    record = await getActiveLiveStreamForModel(ctx.linkedModelId);
  } catch {
    record = null;
  }

  if (!record) {
    return NextResponse.json({ live: null });
  }

  return NextResponse.json({
    live: {
      id: record.id,
      platform: record.platform,
      started_at:
        record.actual_start?.trim() ||
        record.planned_start?.trim() ||
        record.created_at ||
        new Date().toISOString(),
    },
  });
}
