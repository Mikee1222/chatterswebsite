import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { translateApplicationAnswerText } from "@/lib/application-ai-translate";
import {
  getApplicationFormById,
  getResponseDetail,
  updateAnswerTranslation,
} from "@/services/application-forms";
import type { ApplicationFormAnswer, ApplicationFormQuestion } from "@/lib/application-forms-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; rid: string }> };

const TEXT_QUESTION_TYPES = new Set(["short_text", "long_text"]);

function isTranslatableAnswer(
  answer: ApplicationFormAnswer,
  questionById: Map<string, ApplicationFormQuestion>,
): boolean {
  const q = questionById.get(answer.question_id);
  if (!q || !TEXT_QUESTION_TYPES.has(q.question_type)) return false;
  return Boolean(answer.answer_text?.trim());
}

async function translateAndCache(
  answer: ApplicationFormAnswer,
  force: boolean,
): Promise<ApplicationFormAnswer> {
  if (!force && answer.translated_text?.trim()) {
    return answer;
  }
  const text = answer.answer_text?.trim();
  if (!text) return answer;

  const result = await translateApplicationAnswerText(text);
  if (!result) {
    throw new Error("Translation failed — check Anthropic API key / quota");
  }

  return updateAnswerTranslation(answer.id, {
    translated_text: result.translated_text,
    translation_lang: result.translation_lang,
    source_lang: result.source_lang,
  });
}

/**
 * POST /api/admin/application-forms/[id]/responses/[rid]/translate
 * Body: { answerId?: string, force?: boolean }
 * - With answerId: translate one text answer (cache unless force)
 * - Without answerId: translate all short/long text answers missing a cache (or all if force)
 */
export async function POST(request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.APPLICATIONS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: formId, rid } = await ctx.params;
  const body = (await request.json().catch(() => null)) as {
    answerId?: string;
    force?: boolean;
  } | null;

  const force = Boolean(body?.force);
  const answerId = body?.answerId?.trim() || null;

  try {
    const [form, detail] = await Promise.all([
      getApplicationFormById(formId),
      getResponseDetail(rid),
    ]);
    if (!form || !detail || detail.form_id !== form.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const questionById = new Map(form.questions.map((q) => [q.id, q]));

    if (answerId) {
      const answer = detail.answers.find((a) => a.id === answerId);
      if (!answer) {
        return NextResponse.json({ error: "Answer not found" }, { status: 404 });
      }
      if (!isTranslatableAnswer(answer, questionById)) {
        return NextResponse.json(
          { error: "Only short/long text answers can be translated" },
          { status: 400 },
        );
      }
      const updated = await translateAndCache(answer, force);
      return NextResponse.json({ answer: updated, answers: [updated] });
    }

    const targets = detail.answers.filter((a) => isTranslatableAnswer(a, questionById));
    const updatedAnswers: ApplicationFormAnswer[] = [];
    for (const answer of targets) {
      if (!force && answer.translated_text?.trim()) {
        updatedAnswers.push(answer);
        continue;
      }
      updatedAnswers.push(await translateAndCache(answer, force));
    }

    return NextResponse.json({ answers: updatedAnswers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Translation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
