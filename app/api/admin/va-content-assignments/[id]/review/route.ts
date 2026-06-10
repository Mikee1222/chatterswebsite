import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ROUTES } from "@/lib/routes";
import {
  reviewVAContentAssignmentByAdmin,
  type ReviewVAContentAssignmentAdminInput,
} from "@/services/va-content-assignments";

const bodySchema = z.object({
  action: z.enum(["approve", "reject", "edit_and_approve"]),
  rejection_reason: z.string().optional(),
  edits: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      deadline: z.string().nullable().optional(),
      content_type: z.string().optional(),
      priority: z.string().optional(),
      admin_edit_notes: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "content:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
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

  const reviewerLabel = (session.fullName ?? session.email ?? "Admin").trim() || "Admin";
  const input: ReviewVAContentAssignmentAdminInput = {
    action: parsed.data.action,
    reviewerLabel,
    rejection_reason: parsed.data.rejection_reason,
    ...(parsed.data.edits != null ? { edits: parsed.data.edits } : {}),
  };

  const result = await reviewVAContentAssignmentByAdmin(id, input);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.statusCode });
  }

  revalidatePath(ROUTES.admin.vaContentAssignments);
  revalidatePath(ROUTES.va.contentAssignments);
  revalidatePath(ROUTES.model.contentCalendar);
  revalidatePath(ROUTES.model.contentAssignments);

  return NextResponse.json({ success: true, action: result.action });
}
