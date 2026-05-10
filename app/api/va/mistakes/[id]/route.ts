import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import {
  getActiveMistakeReasonByReasonId,
  getMistakeById,
  updateMistakeRow,
} from "@/services/chatter-mistakes";

const patchSchema = z.object({
  explanation: z.string().trim().min(1).max(20000).optional(),
  mistake_date: z.string().trim().min(1).optional(),
  reason_id: z.string().trim().min(1).optional(),
  chatter_id: z.string().trim().min(1).optional(),
  chatter_name: z.string().trim().min(1).optional(),
  model_id: z.string().trim().min(1).optional(),
  model_name: z.string().trim().min(1).optional(),
  sub_username: z.string().trim().max(500).optional(),
});

const TWENTY_FOUR_H_MS = 24 * 60 * 60 * 1000;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session || getEffectiveStaffRole(session) !== "virtual_assistant") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const vaId = (session.airtableUserId ?? session.id)?.trim();
  if (!vaId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  if (!id?.trim()) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const mistake = await getMistakeById(id);
  if (!mistake) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (mistake.va_id !== vaId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (mistake.status !== "pending") {
    return NextResponse.json({ error: "Only pending mistakes can be edited" }, { status: 400 });
  }

  const createdMs = new Date(mistake.created_at).getTime();
  if (!Number.isFinite(createdMs) || Date.now() - createdMs > TWENTY_FOUR_H_MS) {
    return NextResponse.json({ error: "Edit window expired (24h after creation)" }, { status: 400 });
  }

  const fields: Record<string, unknown> = {};
  if (parsed.data.explanation !== undefined) fields.explanation = parsed.data.explanation;
  if (parsed.data.mistake_date !== undefined) {
    const ms = new Date(parsed.data.mistake_date).getTime();
    if (!Number.isFinite(ms)) {
      return NextResponse.json({ error: "mistake_date must be valid ISO" }, { status: 400 });
    }
    fields.mistake_date = new Date(parsed.data.mistake_date).toISOString();
  }
  if (parsed.data.chatter_id !== undefined) fields.chatter_id = parsed.data.chatter_id;
  if (parsed.data.chatter_name !== undefined) fields.chatter_name = parsed.data.chatter_name;
  if (parsed.data.model_id !== undefined) fields.model_id = parsed.data.model_id;
  if (parsed.data.model_name !== undefined) fields.model_name = parsed.data.model_name;
  if (parsed.data.sub_username !== undefined) fields.sub_username = parsed.data.sub_username;

  if (parsed.data.reason_id !== undefined) {
    const reason = await getActiveMistakeReasonByReasonId(parsed.data.reason_id);
    if (!reason) return NextResponse.json({ error: "Invalid or inactive reason_id" }, { status: 400 });
    fields.reason_id = reason.reason_id;
    fields.reason_label = reason.label;
    fields.reason_category = reason.category;
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  try {
    const updated = await updateMistakeRow(id, fields);
    return NextResponse.json({ success: true, mistake: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
