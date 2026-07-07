import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { ROUTES } from "@/lib/routes";
import { updateModelContentRequest } from "@/services/model-content-requests";
import type { ModelContentRequest } from "@/types";

const bodySchema = z
  .object({
    status: z.enum(["pending", "approved", "rejected", "in_progress", "completed"]).optional(),
    admin_notes: z.string().max(4000).optional(),
    title: z.string().trim().optional(),
    model_id: z.string().trim().optional(),
  })
  .refine((d) => d.status !== undefined || d.admin_notes !== undefined, {
    message: "Provide status and/or admin_notes",
  });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
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

  const updatePayload: Partial<Pick<ModelContentRequest, "status" | "admin_notes">> = {};
  if (parsed.data.status !== undefined) updatePayload.status = parsed.data.status;
  if (parsed.data.admin_notes !== undefined) updatePayload.admin_notes = parsed.data.admin_notes;

  const updated = await updateModelContentRequest(id, updatePayload);

  // The filing model is notified inside updateModelContentRequest via model_content_request_reviewed.

  revalidatePath(ROUTES.admin.modelContentRequests);
  revalidatePath(ROUTES.model.home);
  return NextResponse.json({ success: true, record: updated });
}
