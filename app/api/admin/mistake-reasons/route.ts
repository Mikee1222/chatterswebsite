import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createMistakeReason, getAllMistakeReasons } from "@/services/chatter-mistakes";
import type { MistakeReasonCategory } from "@/services/chatter-mistakes";

const postSchema = z.object({
  label: z.string().trim().min(1).max(500),
  category: z.enum(["Low", "Medium", "High"]),
  points_deduction: z.number().int().min(0).max(1000),
  active: z.boolean().optional().default(true),
  sort_order: z.number().int().min(0).optional(),
  reason_id: z.string().trim().max(120).optional(),
});

export async function GET() {
  const session = await getSessionFromCookies();
  if (!(await hasPermission(session, "mistakes:reasons-manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const reasons = await getAllMistakeReasons();
    return NextResponse.json({ reasons });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!(await hasPermission(session, "mistakes:reasons-manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const existing = await getAllMistakeReasons();
    const maxSort = existing.reduce((m, r) => Math.max(m, r.sort_order), 0);
    const sort_order = parsed.data.sort_order ?? maxSort + 1;

    const created = await createMistakeReason({
      label: parsed.data.label,
      category: parsed.data.category as MistakeReasonCategory,
      points_deduction: parsed.data.points_deduction,
      active: parsed.data.active,
      sort_order,
      reason_id: parsed.data.reason_id,
    });
    return NextResponse.json({ success: true, reason: created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
