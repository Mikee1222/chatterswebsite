import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getMemberAccessibleSopRole, isSopMemberSession } from "@/lib/sop-member-access";
import { recordQuizAttempt } from "@/services/sop-quiz-attempts";
import { validateQuizAnswers } from "@/services/sop-quiz";
import { getFunctionsByRole } from "@/services/sops";

const answerSchema = z.object({
  question_id: z.string().trim().min(1),
  selected_option: z.enum(["a", "b", "c", "d"]),
});

const bodySchema = z.object({
  role_id: z.string().trim().min(1),
  function_id: z.string().trim().min(1),
  answers: z.array(answerSchema),
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

  const functions = await getFunctionsByRole(role.id);
  const fn = functions.find((f) => f.id === parsed.data.function_id);
  if (!fn) {
    return NextResponse.json({ error: "Function not found for this role" }, { status: 404 });
  }

  const userId = (session.airtableUserId ?? session.id)?.trim();

  try {
    const result = await validateQuizAnswers(fn.id, parsed.data.answers);
    if (userId) {
      try {
        await recordQuizAttempt(
          userId,
          fn.id,
          role.id,
          result.score,
          result.passed,
          result.wrong_question_ids.length
        );
      } catch (recordErr) {
        console.error("[sops/quiz/submit] recordQuizAttempt failed:", recordErr);
      }
    }
    return NextResponse.json({
      passed: result.passed,
      score: result.score,
      total: result.total,
      wrong_question_ids: result.wrong_question_ids,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
