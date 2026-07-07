import { NextResponse } from "next/server";
import { z } from "zod";
import { requireModelApiContext } from "@/lib/model-api-auth";
import {
  createModelContentRequest,
  listModelContentRequestsForModel,
} from "@/services/model-content-requests";

const createSchema = z.object({
  type: z.enum(["script", "mass", "photo_set", "video", "other"]),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(4000),
});

export async function GET() {
  const ctx = await requireModelApiContext();
  if (!ctx.ok) return ctx.response;
  const rows = await listModelContentRequestsForModel(ctx.linkedModelId).catch(() => []);
  return NextResponse.json({ records: rows });
}

export async function POST(req: Request) {
  const ctx = await requireModelApiContext();
  if (!ctx.ok) return ctx.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(" ") }, { status: 400 });
  }

  const row = await createModelContentRequest({
    model_id: ctx.linkedModelId,
    model_user_id: ctx.userRecordId,
    type: parsed.data.type,
    title: parsed.data.title,
    description: parsed.data.description,
  });

  // Admins are notified inside createModelContentRequest via model_content_request_created.

  return NextResponse.json({ success: true, record: row });
}
