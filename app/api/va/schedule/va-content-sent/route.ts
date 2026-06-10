import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ROUTES } from "@/lib/routes";
import { vaTypeAccessApiGuardForNavHref } from "@/lib/va-type-access";
import { appendVAContentAssignmentVaNotes, getModelIdsAssignedToVa, getVAContentAssignmentForVa } from "@/services/va-content-assignments";

const bodySchema = z.object({
  assignment_id: z.string().trim().min(1),
});

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "content:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const blocked = await vaTypeAccessApiGuardForNavHref(session, ROUTES.va.schedule);
  if (blocked) return blocked;
  const vaUserRecordId = (session.airtableUserId ?? session.id)?.trim();
  if (!vaUserRecordId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(" ") }, { status: 400 });
  }

  const row = await getVAContentAssignmentForVa(parsed.data.assignment_id, vaUserRecordId);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowedModels = new Set(await getModelIdsAssignedToVa(vaUserRecordId));
  if (!allowedModels.has(row.model_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const line = `[Sent to model] ${new Date().toISOString()}`;
  const updated = await appendVAContentAssignmentVaNotes(parsed.data.assignment_id, vaUserRecordId, line);
  if (!updated) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  revalidatePath(ROUTES.va.scheduleOverview);
  revalidatePath(ROUTES.admin.modelSchedulesOverview);
  revalidatePath(ROUTES.va.contentAssignments);

  return NextResponse.json({ success: true, id: updated.id });
}
