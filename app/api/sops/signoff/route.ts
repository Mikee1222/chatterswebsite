import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getMemberAccessibleSopRole, canAccessMemberSopViewer } from "@/lib/sop-member-access";
import { getProgressForUser } from "@/services/sop-progress";
import { notifyAdminsSopSignoff } from "@/services/sop-academy-notifications";
import {
  createSignoff,
  DEFAULT_SIGNOFF_STATEMENT,
  getSignoffForUserRole,
} from "@/services/sop-signoff";
import { getFunctionsByRole } from "@/services/sops";
import { listAllUsers } from "@/services/users";

const bodySchema = z.object({
  role_id: z.string().trim().min(1),
  acknowledged: z.literal(true),
  statement: z.string().max(2000).optional(),
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

  if (!role.academy_mode) {
    return NextResponse.json({ error: "Academy mode is not enabled for this role" }, { status: 400 });
  }

  const userId = (session.airtableUserId ?? session.id)?.trim();
  if (!userId) {
    return NextResponse.json({ error: "User record not linked" }, { status: 400 });
  }

  const functions = await getFunctionsByRole(role.id);
  const activeFunctions = functions.filter((f) => f.is_active);
  const completed = new Set(await getProgressForUser(userId, role.id, activeFunctions));

  if (activeFunctions.some((f) => !completed.has(f.id))) {
    return NextResponse.json(
      { error: "Complete all training steps before signing off" },
      { status: 400 }
    );
  }

  try {
    const existingSignoff = await getSignoffForUserRole(userId, role.id);
    const signoff = await createSignoff(
      userId,
      role.id,
      parsed.data.statement?.trim() || DEFAULT_SIGNOFF_STATEMENT
    );

    if (!existingSignoff) {
      const users = await listAllUsers();
      const user = users.find((u) => u.id === userId);
      const userName = (user?.full_name ?? "").trim() || user?.email || userId;
      await notifyAdminsSopSignoff({
        userId,
        userName,
        roleId: role.id,
        roleName: role.name,
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, signoff });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
