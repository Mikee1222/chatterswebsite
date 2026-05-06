import { NextResponse } from "next/server";
import { z } from "zod";
import { requireModelApiContext } from "@/lib/model-api-auth";
import {
  getActiveLiveStreamForModel,
  getModelLiveStreamById,
  updateModelLiveStream,
} from "@/services/model-live-streams";
import { getModelById } from "@/services/modelss";
import { notifyModelLiveEnded } from "@/services/model-live-notify";

/** Body optional: empty POST is valid — we resolve the model’s active in-progress stream server-side. */
const bodySchema = z.object({
  live_id: z.string().min(1).optional(),
  stream_id: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const ctx = await requireModelApiContext();
  if (!ctx.ok) return ctx.response;

  let json: unknown = {};
  const raw = await req.text();
  if (raw.trim()) {
    try {
      json = JSON.parse(raw) as unknown;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const fromBody = parsed.data.live_id?.trim() || parsed.data.stream_id?.trim() || null;

  try {
    let liveId = fromBody;
    if (!liveId) {
      const active = await getActiveLiveStreamForModel(ctx.linkedModelId);
      if (!active?.id) {
        return NextResponse.json({ error: "No active live stream" }, { status: 400 });
      }
      liveId = active.id;
    }

    const existing = await getModelLiveStreamById(liveId);
    if (!existing || existing.model_id !== ctx.linkedModelId) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const nowIso = new Date().toISOString();
    /** Airtable uses `ended` + `actual_end` (not spec name `ended_at`). */
    await updateModelLiveStream(liveId, {
      status: "ended",
      actual_end: nowIso,
    });
    const modelRecord = await getModelById(ctx.linkedModelId);
    if (modelRecord) {
      await notifyModelLiveEnded(modelRecord, liveId);
    }
    return NextResponse.json({ success: true, live_id: liveId, stream_id: liveId });
  } catch {
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
