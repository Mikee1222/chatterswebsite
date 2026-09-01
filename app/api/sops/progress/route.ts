import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getMemberAccessibleSopRole, canAccessMemberSopViewer } from "@/lib/sop-member-access";
import { getProgressStateForUser } from "@/services/sop-progress";
import { getSignoffForUserRole } from "@/services/sop-signoff";
import { getFunctionsByRole } from "@/services/sops";

const querySchema = z.object({
  role_id: z.string().trim().min(1),
});

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessMemberSopViewer(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    role_id: url.searchParams.get("role_id") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "role_id is required" }, { status: 400 });
  }

  const role = await getMemberAccessibleSopRole(session, parsed.data.role_id);
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = (session.airtableUserId ?? session.id)?.trim();
  if (!userId) {
    return NextResponse.json({ error: "User record not linked" }, { status: 400 });
  }

  try {
    const functions = await getFunctionsByRole(role.id);
    const activeFunctions = functions.filter((f) => f.is_active);
    const state = await getProgressStateForUser(userId, role.id, activeFunctions);
    const signoff = await getSignoffForUserRole(userId, role.id);

    return NextResponse.json({
      completed_function_ids: state.completed_function_ids,
      stale_function_ids: state.stale_function_ids,
      progress: state.current_rows,
      signoff: signoff
        ? { signed_at: signoff.signed_at, statement: signoff.statement }
        : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
