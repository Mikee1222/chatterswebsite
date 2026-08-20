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
  getTypingBySession,
  recordSessionConsent,
  submitCognitiveResult,
  submitEqResult,
  submitTypingResult,
  updateSessionLanguage,
} from "@/services/application-screening";
import { APPLICATION_AGREEMENT_VERSION } from "@/lib/application-agreement";
import {
  COGNITIVE_TIME_LIMIT_SECONDS,
  SCREENING_FRAMING_COPY,
} from "@/lib/application-screening-banks";
import {
  toPublicCognitiveQuestionsLocalized,
  toPublicEqScenariosLocalized,
} from "@/lib/application-screening-i18n";
import { getEnabledPipelineSteps } from "@/lib/application-forms-types";
import { detectDeviceType, isPipelineLanguage } from "@/lib/application-pipeline-i18n";
import {
  applicationResponseEntityId,
  applicationSubmittedCopy,
  candidateDisplayNameFromAnswers,
} from "@/lib/application-notifications";
import {
  NOTIFICATION_ENTITY,
  NOTIFICATION_EVENT,
  NOTIFICATION_PRIORITY,
} from "@/lib/notification-types";
import { notifyAdmins } from "@/services/notification-service";

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
    const hasTyping = pipeline.some((s) => s.step === "typing_speed_test");

    return NextResponse.json({
      form: {
        id: form.id,
        title: form.title,
        description: form.description,
        description_el: form.description_el,
        footer_text: form.footer_text,
        footer_text_el: form.footer_text_el,
        slug: form.slug,
        pipeline_config: form.pipeline_config,
        enabled_steps: pipeline.map((s) => s.step),
        questions: form.questions.map((q) => ({
          id: q.id,
          question_text: q.question_text,
          question_text_el: q.question_text_el,
          question_type: q.question_type,
          options: q.options,
          options_el: q.options_el,
          is_required: q.is_required,
          display_order: q.display_order,
        })),
      },
      screening: {
        framing: SCREENING_FRAMING_COPY,
        cognitive: hasCognitive
          ? {
              time_limit_seconds: COGNITIVE_TIME_LIMIT_SECONDS,
              questions_en: toPublicCognitiveQuestionsLocalized("en"),
              questions_el: toPublicCognitiveQuestionsLocalized("el"),
            }
          : null,
        eq: hasEq
          ? {
              scenarios_en: toPublicEqScenariosLocalized("en"),
              scenarios_el: toPublicEqScenariosLocalized("el"),
            }
          : null,
        typing: hasTyping ? { enabled: true } : null,
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
 *   - set_language
 *   - record_consent
 *   - submit_cognitive
 *   - submit_eq
 *   - submit_typing
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
    preferred_language?: string;
    agreement_version?: string;
    answers?: {
      question_id?: string;
      answer_text?: string | null;
      answer_options?: string[];
      selected_index?: number | null;
      scenario_id?: string;
    }[];
    time_taken_seconds?: number;
    passage?: string;
    typed?: string;
    passage_id?: string;
    passage_language?: string;
    device_type?: string;
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
      const preferred = isPipelineLanguage(body?.preferred_language)
        ? body!.preferred_language
        : null;
      const session = await createCandidateSession({
        formId: form.id,
        respondentIp: ip === "unknown" ? null : ip,
        preferredLanguage: preferred,
      });
      return NextResponse.json({ session_id: session.id }, { status: 201 });
    }

    if (action === "set_language") {
      if (!body?.session_id || !isPipelineLanguage(body.preferred_language)) {
        return NextResponse.json({ error: "session_id and preferred_language required" }, { status: 400 });
      }
      const session = await getCandidateSession(body.session_id);
      if (!session || session.form_id !== form.id) {
        return NextResponse.json({ error: "Invalid session" }, { status: 400 });
      }
      const updated = await updateSessionLanguage(body.session_id, body.preferred_language);
      return NextResponse.json({ ok: true, preferred_language: updated.preferred_language });
    }

    if (action === "record_consent") {
      if (!body?.session_id) {
        return NextResponse.json({ error: "session_id required" }, { status: 400 });
      }
      const version =
        typeof body.agreement_version === "string" && body.agreement_version.trim()
          ? body.agreement_version.trim()
          : APPLICATION_AGREEMENT_VERSION;
      if (version !== APPLICATION_AGREEMENT_VERSION) {
        return NextResponse.json(
          { error: "Agreement version is out of date. Please refresh and try again." },
          { status: 400 },
        );
      }
      const updated = await recordSessionConsent({
        sessionId: body.session_id,
        formId: form.id,
        agreementVersion: version,
      });
      return NextResponse.json({
        ok: true,
        agreed_at: updated.agreed_at,
        agreement_version: updated.agreement_version,
      });
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

    if (action === "submit_typing") {
      if (!body?.session_id || typeof body.passage !== "string" || typeof body.typed !== "string") {
        return NextResponse.json(
          { error: "session_id, passage, and typed required" },
          { status: 400 },
        );
      }
      const session = await getCandidateSession(body.session_id);
      if (!session || session.form_id !== form.id) {
        return NextResponse.json({ error: "Invalid session" }, { status: 400 });
      }
      const passageLanguage = isPipelineLanguage(body.passage_language)
        ? body.passage_language
        : session.preferred_language ?? "en";
      const device =
        body.device_type === "desktop" ||
        body.device_type === "mobile" ||
        body.device_type === "tablet" ||
        body.device_type === "unknown"
          ? body.device_type
          : detectDeviceType(request.headers.get("user-agent"));
      const result = await submitTypingResult({
        sessionId: body.session_id,
        formId: form.id,
        passage: body.passage,
        typed: body.typed,
        passageLanguage,
        passageId: body.passage_id ?? null,
        deviceType: device,
        timeTakenSeconds: Number(body.time_taken_seconds) || 0,
      });
      return NextResponse.json({
        ok: true,
        result: {
          wpm: result.wpm,
          accuracy_percent: result.accuracy_percent,
        },
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
      if (enabled.includes("typing_speed_test")) {
        const typing = await getTypingBySession(body.session_id);
        if (!typing) {
          return NextResponse.json(
            { error: "Please complete the typing speed test first" },
            { status: 400 },
          );
        }
      }
    }

    const preferred = isPipelineLanguage(body?.preferred_language)
      ? body!.preferred_language
      : null;

    const response = await submitApplicationResponse({
      formId: form.id,
      respondentIp: ip === "unknown" ? null : ip,
      sessionId: body?.session_id ?? null,
      preferredLanguage: preferred,
      answers: Array.isArray(body?.answers)
        ? body!.answers!.map((a) => ({
            question_id: String(a.question_id ?? ""),
            answer_text: a.answer_text,
            answer_options: a.answer_options,
          }))
        : [],
    });

    const candidateName = candidateDisplayNameFromAnswers(
      Array.isArray(body?.answers)
        ? body!.answers!.map((a) => ({ answer_text: a.answer_text }))
        : [],
    );
    const submittedCopy = applicationSubmittedCopy(candidateName, form.title);
    await notifyAdmins({
      event_type: NOTIFICATION_EVENT.APPLICATION_SUBMITTED,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: submittedCopy.title,
      body: submittedCopy.body,
      entity_type: NOTIFICATION_ENTITY.APPLICATION_FORM_RESPONSE,
      entity_id: applicationResponseEntityId(form.id, response.id),
      actor_name: candidateName,
    }).catch((err) => console.error("[application_submitted] notify failed", err));

    return NextResponse.json({ ok: true, response_id: response.id }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Submit failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
