import { NextResponse } from "next/server";
import {
  getFormBySlugAnyStatus,
  getPublishedFormBySlug,
  submitApplicationResponse,
} from "@/services/application-forms";
import {
  createCandidateSession,
  getCandidateSession,
  getCognitiveBySession,
  getEqBySession,
  submitCognitiveResult,
  submitEqResult,
} from "@/services/application-screening";
import {
  COGNITIVE_TIME_LIMIT_SECONDS,
  SCREENING_FRAMING_COPY,
  toPublicCognitiveQuestions,
  toPublicEqScenarios,
} from "@/lib/application-screening-banks";
import { getEnabledPipelineSteps } from "@/lib/application-forms-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ slug: string }> };

const submitBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 8;
const RATE_WINDOW_MS = 10 * 60 * 1000;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = submitBuckets.get(key);
  if (!entry || entry.resetAt <= now) {
    submitBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count += 1;
  return true;
}

function clientIp(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** GET /api/apply/[slug] — public published form + pipeline + screening banks */
export async function GET(_request: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  try {
    const form = await getPublishedFormBySlug(slug);
    if (!form) {
      const any = await getFormBySlugAnyStatus(slug);
      if (any && any.status === "closed") {
        return NextResponse.json({ error: "This form is closed", closed: true }, { status: 410 });
      }
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const pipeline = getEnabledPipelineSteps(form.pipeline_config);
    const hasCognitive = pipeline.some((s) => s.step === "cognitive_screening");
    const hasEq = pipeline.some((s) => s.step === "eq_screening");

    return NextResponse.json({
      form: {
        id: form.id,
        title: form.title,
        description: form.description,
        slug: form.slug,
        pipeline_config: form.pipeline_config,
        enabled_steps: pipeline.map((s) => s.step),
        questions: form.questions.map((q) => ({
          id: q.id,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options,
          is_required: q.is_required,
          display_order: q.display_order,
        })),
      },
      screening: {
        framing: SCREENING_FRAMING_COPY,
        cognitive: hasCognitive
          ? {
              time_limit_seconds: COGNITIVE_TIME_LIMIT_SECONDS,
              questions: toPublicCognitiveQuestions(),
            }
          : null,
        eq: hasEq ? { scenarios: toPublicEqScenarios() } : null,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load form";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/apply/[slug]
 * body.action:
 *   - start_session
 *   - submit_cognitive
 *   - submit_eq
 *   - submit_form (default)
 */
export async function POST(request: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const ip = clientIp(request);
  if (!checkRateLimit(`${ip}:${slug}`)) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    action?: string;
    session_id?: string;
    answers?: {
      question_id?: string;
      answer_text?: string | null;
      answer_options?: string[];
      selected_index?: number | null;
      scenario_id?: string;
    }[];
    time_taken_seconds?: number;
    website?: string;
    company_url?: string;
  } | null;

  if ((body?.website ?? "").trim() || (body?.company_url ?? "").trim()) {
    return NextResponse.json({ ok: true });
  }

  try {
    const form = await getPublishedFormBySlug(slug);
    if (!form) {
      return NextResponse.json({ error: "Form not available" }, { status: 404 });
    }

    const action = body?.action ?? "submit_form";

    if (action === "start_session") {
      const session = await createCandidateSession({
        formId: form.id,
        respondentIp: ip === "unknown" ? null : ip,
      });
      return NextResponse.json({ session_id: session.id }, { status: 201 });
    }

    if (action === "submit_cognitive") {
      if (!body?.session_id) {
        return NextResponse.json({ error: "session_id required" }, { status: 400 });
      }
      const session = await getCandidateSession(body.session_id);
      if (!session || session.form_id !== form.id) {
        return NextResponse.json({ error: "Invalid session" }, { status: 400 });
      }
      const result = await submitCognitiveResult({
        sessionId: body.session_id,
        formId: form.id,
        answers: (body.answers ?? []).map((a) => ({
          question_id: String(a.question_id ?? ""),
          selected_index:
            a.selected_index == null || Number.isNaN(Number(a.selected_index))
              ? null
              : Number(a.selected_index),
        })),
        timeTakenSeconds: Number(body.time_taken_seconds) || 0,
      });
      return NextResponse.json({
        ok: true,
        result: {
          raw_score: result.raw_score,
          total_questions: result.total_questions,
          percentile: result.percentile_at_time_of_completion,
        },
      });
    }

    if (action === "submit_eq") {
      if (!body?.session_id) {
        return NextResponse.json({ error: "session_id required" }, { status: 400 });
      }
      const session = await getCandidateSession(body.session_id);
      if (!session || session.form_id !== form.id) {
        return NextResponse.json({ error: "Invalid session" }, { status: 400 });
      }
      const result = await submitEqResult({
        sessionId: body.session_id,
        formId: form.id,
        answers: (body.answers ?? []).map((a) => ({
          scenario_id: String(a.scenario_id ?? ""),
          selected_index:
            a.selected_index == null || Number.isNaN(Number(a.selected_index))
              ? null
              : Number(a.selected_index),
        })),
        timeTakenSeconds: Number(body.time_taken_seconds) || 0,
      });
      return NextResponse.json({
        ok: true,
        result: { overall_score: result.overall_score },
      });
    }

    // submit_form
    if (body?.session_id) {
      const session = await getCandidateSession(body.session_id);
      if (!session || session.form_id !== form.id) {
        return NextResponse.json({ error: "Invalid session" }, { status: 400 });
      }
      if (session.response_id) {
        return NextResponse.json({ ok: true, response_id: session.response_id });
      }
      // Ensure required screening steps completed when enabled
      const enabled = getEnabledPipelineSteps(form.pipeline_config).map((s) => s.step);
      if (enabled.includes("cognitive_screening")) {
        const cog = await getCognitiveBySession(body.session_id);
        if (!cog) {
          return NextResponse.json(
            { error: "Please complete the cognitive screening first" },
            { status: 400 },
          );
        }
      }
      if (enabled.includes("eq_screening")) {
        const eq = await getEqBySession(body.session_id);
        if (!eq) {
          return NextResponse.json(
            { error: "Please complete the EQ screening first" },
            { status: 400 },
          );
        }
      }
    }

    const response = await submitApplicationResponse({
      formId: form.id,
      respondentIp: ip === "unknown" ? null : ip,
      sessionId: body?.session_id ?? null,
      answers: Array.isArray(body?.answers)
        ? body!.answers!.map((a) => ({
            question_id: String(a.question_id ?? ""),
            answer_text: a.answer_text,
            answer_options: a.answer_options,
          }))
        : [],
    });

    return NextResponse.json({ ok: true, response_id: response.id }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Submit failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
