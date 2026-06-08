import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getMemberAccessibleSopRole, isSopMemberSession } from "@/lib/sop-member-access";
import { getProgressForUser } from "@/services/sop-progress";

const querySchema = z.object({
  role_id: z.string().trim().min(1),
});

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session || !isSopMemberSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const completed_function_ids = await getProgressForUser(userId, role.id);
    return NextResponse.json({ completed_function_ids });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
