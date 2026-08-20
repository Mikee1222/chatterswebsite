import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { isApplicationQuestionType } from "@/lib/application-forms-types";
import { deleteQuestion, updateQuestion } from "@/services/application-forms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; qid: string }> };

/** PATCH /api/admin/application-forms/[id]/questions/[qid] */
export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.APPLICATIONS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { qid } = await ctx.params;
  const body = (await request.json().catch(() => null)) as {
    question_text?: string;
    question_type?: string;
    options?: string[];
    is_required?: boolean;
  } | null;

  try {
    const question = await updateQuestion(qid, {
      question_text: body?.question_text,
      question_type:
        body?.question_type && isApplicationQuestionType(body.question_type)
          ? body.question_type
          : undefined,
      options: body?.options,
      is_required: body?.is_required,
    });
    return NextResponse.json({ question });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/** DELETE /api/admin/application-forms/[id]/questions/[qid] */
export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.APPLICATIONS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { qid } = await ctx.params;
  try {
    await deleteQuestion(qid);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
