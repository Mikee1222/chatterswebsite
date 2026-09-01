import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getMemberAccessibleSopRole, canAccessMemberSopViewer } from "@/lib/sop-member-access";
import { getQuestionsByFunction } from "@/services/sop-quiz";
import { getFunctionsByRole } from "@/services/sops";

const querySchema = z.object({
  role_id: z.string().trim().min(1),
  function_id: z.string().trim().min(1),
});

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessMemberSopViewer(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    role_id: url.searchParams.get("role_id") ?? "",
    function_id: url.searchParams.get("function_id") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "role_id and function_id are required" }, { status: 400 });
  }

  const role = await getMemberAccessibleSopRole(session, parsed.data.role_id);
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const functions = await getFunctionsByRole(role.id);
  const fn = functions.find((f) => f.id === parsed.data.function_id);
  if (!fn) {
    return NextResponse.json({ error: "Function not found for this role" }, { status: 404 });
  }

  try {
    const questions = await getQuestionsByFunction(fn.id);
    const safe = questions.map((q) => ({
      id: q.id,
      question_id: q.question_id,
      question: q.question,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      sort_order: q.sort_order,
    }));
    return NextResponse.json({ questions: safe });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
