import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getMemberAccessibleSopRole, canAccessMemberSopViewer } from "@/lib/sop-member-access";
import { createSopFeedback } from "@/services/sop-feedback";
import { getFunctionsByRole } from "@/services/sops";

const bodySchema = z.object({
  role_id: z.string().trim().min(1),
  function_id: z.string().trim().min(1),
  helpful: z.enum(["yes", "no"]),
  comment: z.string().max(4000).optional(),
});

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessMemberSopViewer(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const role = await getMemberAccessibleSopRole(session, parsed.data.role_id);
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const functions = await getFunctionsByRole(role.id);
  const fn = functions.find((f) => f.id === parsed.data.function_id && f.is_active);
  if (!fn) {
    return NextResponse.json({ error: "Function not found for this role" }, { status: 404 });
  }

  const userId = (session.airtableUserId ?? session.id)?.trim();
  if (!userId) {
    return NextResponse.json({ error: "User record not linked" }, { status: 400 });
  }

  try {
    const feedback = await createSopFeedback({
      user_id: userId,
      sop_function_id: fn.id,
      sop_role_id: role.id,
      helpful: parsed.data.helpful,
      comment: parsed.data.comment,
    });
    return NextResponse.json({ success: true, feedback });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
