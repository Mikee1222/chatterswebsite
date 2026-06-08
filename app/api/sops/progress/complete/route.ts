import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getMemberAccessibleSopRole, isSopMemberSession } from "@/lib/sop-member-access";
import { getProgressForUser, markFunctionComplete } from "@/services/sop-progress";
import { getFunctionsByRole } from "@/services/sops";

const bodySchema = z.object({
  role_id: z.string().trim().min(1),
  function_id: z.string().trim().min(1),
});

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session || !isSopMemberSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  const sorted = [...functions].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
  );
  const targetIdx = sorted.findIndex((f) => f.id === parsed.data.function_id);
  if (targetIdx < 0) {
    return NextResponse.json({ error: "Function not found for this role" }, { status: 404 });
  }

  const completed = new Set(await getProgressForUser(userId, role.id));
  const firstIncompleteIdx = sorted.findIndex((f) => !completed.has(f.id));
  if (firstIncompleteIdx >= 0 && targetIdx !== firstIncompleteIdx) {
    return NextResponse.json(
      { error: "Complete functions in order — this step is still locked" },
      { status: 400 }
    );
  }

  try {
    const progress = await markFunctionComplete(userId, parsed.data.function_id, role.id);
    return NextResponse.json({ success: true, progress });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
