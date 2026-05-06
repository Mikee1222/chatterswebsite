import { NextResponse } from "next/server";
import { z } from "zod";
import { requireModelApiContext } from "@/lib/model-api-auth";
import { getTodayYmd } from "@/lib/weekly-program";
import { isModelLiveStreamPlatform, type ModelLiveStreamPlatformOption } from "@/lib/airtable-options";
import { createModelLiveStream, getActiveLiveStreamForModel } from "@/services/model-live-streams";
import { getModelById } from "@/services/modelss";
import { notifyModelLiveStarted } from "@/services/model-live-notify";

const bodySchema = z.object({
  platform: z.enum(["instagram", "tiktok", "onlyfans"]),
});

export async function POST(req: Request) {
  const ctx = await requireModelApiContext();
  if (!ctx.ok) return ctx.response;

  const raw = await req.text();
  let json: unknown;
  if (!raw.trim()) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  try {
    json = JSON.parse(raw) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const platform = parsed.data.platform as ModelLiveStreamPlatformOption;
  if (!isModelLiveStreamPlatform(platform)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const active = await getActiveLiveStreamForModel(ctx.linkedModelId);
    if (active) {
      return NextResponse.json({ error: "Invalid request" }, { status: 409 });
    }
    const nowIso = new Date().toISOString();
    /** Airtable uses `in_progress` + `actual_start` (not spec names `live` / `started_at`). */
    const row = await createModelLiveStream({
      model_id: ctx.linkedModelId,
      date: getTodayYmd(),
      platform,
      status: "in_progress",
      actual_start: nowIso,
    });
    const modelRecord = await getModelById(ctx.linkedModelId);
    if (modelRecord) {
      await notifyModelLiveStarted(modelRecord, row.id);
    }
    return NextResponse.json({
      success: true,
      live_id: row.id,
      stream_id: row.id,
      platform: parsed.data.platform,
    });
  } catch {
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
