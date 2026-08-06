import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireModelApiContext } from "@/lib/model-api-auth";
import { broadcastRealtimeToAll } from "@/lib/realtime-broadcast";
import { ROUTES } from "@/lib/routes";
import { getTodayYmd } from "@/lib/weekly-program";
import {
  isModelLiveStreamPlatform,
  isModelLiveStreamReason,
  type ModelLiveStreamPlatformOption,
  type ModelLiveStreamReasonOption,
} from "@/lib/airtable-options";
import { createModelLiveStream, getActiveLiveStreamForModel } from "@/services/model-live-streams";
import { getModelById } from "@/services/modelss";
import { notifyModelLiveStarted } from "@/services/model-live-notify";

const bodySchema = z.object({
  platform: z.enum(["instagram", "tiktok", "onlyfans"]),
  reason: z.enum(["going_out", "gym", "at_home", "other"]),
  reason_note: z.string().trim().max(500).optional().nullable(),
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

  const reason = parsed.data.reason as ModelLiveStreamReasonOption;
  if (!isModelLiveStreamReason(reason)) {
    return NextResponse.json({ error: "Reason is required" }, { status: 400 });
  }

  const reasonNoteRaw = parsed.data.reason_note?.trim() || null;
  const reason_note = reason === "other" ? reasonNoteRaw : null;

  // Check for active stream
  let active: Awaited<ReturnType<typeof getActiveLiveStreamForModel>>;
  try {
    active = await getActiveLiveStreamForModel(ctx.linkedModelId);
  } catch {
    active = null;
  }
  if (active) {
    return NextResponse.json({ error: "A live stream is already active" }, { status: 409 });
  }

  // Create the live stream
  let row: Awaited<ReturnType<typeof createModelLiveStream>>;
  try {
    row = await createModelLiveStream({
      model_id: ctx.linkedModelId,
      date: getTodayYmd(),
      platform,
      status: "in_progress",
      actual_start: new Date().toISOString(),
      reason,
      reason_note,
    });
  } catch (e) {
    console.error("[live/start] createModelLiveStream failed:", e);
    return NextResponse.json({ error: "Failed to start live stream" }, { status: 500 });
  }

  revalidatePath(ROUTES.model.home);
  revalidatePath(ROUTES.admin.liveShifts);

  await broadcastRealtimeToAll({
    type: "model_live_started",
    model_id: ctx.linkedModelId,
    live_id: row.id,
    platform,
  }).catch(() => {});

  const modelRecord = await getModelById(ctx.linkedModelId);
  if (modelRecord) {
    await notifyModelLiveStarted(modelRecord, row.id, platform, reason, reason_note).catch((e) =>
      console.error("[live/start] notification failed:", e)
    );
  }

  return NextResponse.json({
    success: true,
    live_id: row.id,
    stream_id: row.id,
    platform: parsed.data.platform,
    reason,
    reason_note,
    started_at: row.actual_start ?? new Date().toISOString(),
  });
}
