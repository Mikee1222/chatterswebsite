import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getFormBySlugAnyStatus,
  getPublishedFormBySlug,
} from "@/services/application-forms";
import { PublicApplicationFlowClient } from "@/components/public-application-flow-client";
import { COGNITIVE_TIME_LIMIT_SECONDS } from "@/lib/application-screening-banks";
import {
  toPublicCognitiveQuestionsLocalized,
  toPublicEqScenariosLocalized,
} from "@/lib/application-screening-i18n";
import { getEnabledPipelineSteps } from "@/lib/application-forms-types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const form = await getPublishedFormBySlug(slug).catch(() => null);
  if (!form) return { title: "Application" };
  return {
    title: form.title,
    description: form.description || undefined,
  };
}

export default async function PublicApplyPage({ params }: Props) {
  const { slug } = await params;
  const form = await getPublishedFormBySlug(slug).catch(() => null);

  if (!form) {
    const any = await getFormBySlugAnyStatus(slug).catch(() => null);
    if (any?.status === "closed") {
      return (
        <div className="mx-auto flex max-w-lg flex-1 flex-col justify-center px-4 py-24 text-center">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-[rgba(20,20,25,0.72)] px-8 py-12 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D4AF8C]/80">
              Gunzo Careers
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              Applications closed
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/50">
              This form is no longer accepting submissions. Thank you for your interest.
            </p>
          </div>
        </div>
      );
    }
    notFound();
  }

  const enabled = getEnabledPipelineSteps(form.pipeline_config);
  const hasCognitive = enabled.some((s) => s.step === "cognitive_screening");
  const hasEq = enabled.some((s) => s.step === "eq_screening");

  return (
    <PublicApplicationFlowClient
      slug={form.slug}
      title={form.title}
      description={form.description}
      descriptionEl={form.description_el}
      footerText={form.footer_text}
      footerTextEl={form.footer_text_el}
      questions={form.questions}
      pipelineConfig={form.pipeline_config}
      cognitiveQuestionsEn={hasCognitive ? toPublicCognitiveQuestionsLocalized("en") : null}
      cognitiveQuestionsEl={hasCognitive ? toPublicCognitiveQuestionsLocalized("el") : null}
      eqScenariosEn={hasEq ? toPublicEqScenariosLocalized("en") : null}
      eqScenariosEl={hasEq ? toPublicEqScenariosLocalized("el") : null}
      cognitiveTimeLimit={COGNITIVE_TIME_LIMIT_SECONDS}
    />
  );
}
