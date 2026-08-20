import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { isApplicationQuestionType } from "@/lib/application-forms-types";
import { createQuestion } from "@/services/application-forms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/admin/application-forms/[id]/questions */
export async function POST(request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.APPLICATIONS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: formId } = await ctx.params;
  const body = (await request.json().catch(() => null)) as {
    question_text?: string;
    question_text_el?: string;
    question_type?: string;
    options?: string[];
    options_el?: string[];
    is_required?: boolean;
  } | null;

  if (!body?.question_type || !isApplicationQuestionType(body.question_type)) {
    return NextResponse.json({ error: "Invalid question type" }, { status: 400 });
  }

  try {
    const question = await createQuestion(formId, {
      question_text: body.question_text ?? "",
      question_text_el: body.question_text_el,
      question_type: body.question_type,
      options: body.options,
      options_el: body.options_el,
      is_required: body.is_required,
    });
    return NextResponse.json({ question }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
