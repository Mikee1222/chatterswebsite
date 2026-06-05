import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getPaymentSubmissionById } from "@/services/client-portal";
import { updatePaymentSubmission } from "@/services/client-billing";

function isAdminOrManager(session: Awaited<ReturnType<typeof getSessionFromCookies>>) {
  return session != null && (session.role === "admin" || session.role === "manager");
}

const bodySchema = z.object({
  status: z.enum(["approved", "rejected"]),
  admin_note: z.string().max(4000).optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!isAdminOrManager(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  try {
    const submission = await getPaymentSubmissionById(id);
    return NextResponse.json({ submission });
  } catch {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!isAdminOrManager(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 }
    );
  }

  try {
    const submission = await updatePaymentSubmission(id, parsed.data);
    revalidatePath(ROUTES.admin.clients);
    revalidatePath(ROUTES.admin.submissions);
    return NextResponse.json({ success: true, submission });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update submission";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
