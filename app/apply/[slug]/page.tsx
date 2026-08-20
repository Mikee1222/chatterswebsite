import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getFormBySlugAnyStatus,
  getPublishedFormBySlug,
} from "@/services/application-forms";
import { PublicApplicationFlowClient } from "@/components/public-application-flow-client";
import {
  COGNITIVE_TIME_LIMIT_SECONDS,
  toPublicCognitiveQuestions,
  toPublicEqScenarios,
} from "@/lib/application-screening-banks";
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
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <div className="rounded-3xl border border-black/5 bg-[#F7F3EE] px-8 py-12 shadow-xl">
            <h1 className="font-serif text-3xl text-[#1a1512]">Applications closed</h1>
            <p className="mt-3 text-sm text-zinc-600">
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
      questions={form.questions}
      pipelineConfig={form.pipeline_config}
      cognitiveQuestions={hasCognitive ? toPublicCognitiveQuestions() : null}
      eqScenarios={hasEq ? toPublicEqScenarios() : null}
      cognitiveTimeLimit={COGNITIVE_TIME_LIMIT_SECONDS}
    />
  );
}
