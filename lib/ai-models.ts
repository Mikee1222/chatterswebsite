/**
 * Central AI model config — the ONE place model names live.
 * Every model has a default and an env override, so a retired or renamed model is
 * fixed in Vercel (env var + redeploy) without a code change.
 *
 *   tier        env override          used for
 *   assistant   AI_ASSISTANT_MODEL    general reasoning: assistant, insights, brainstorms
 *   fast        AI_FAST_MODEL         mechanical work: captions, translation, summaries
 *   breakdown   AI_BREAKDOWN_MODEL    Winner Breakdown, brief drafts, script from breakdown
 *   sttGroq     STT_MODEL             speech-to-text on Groq
 *   sttOpenai   STT_MODEL             speech-to-text on OpenAI
 *
 * Env overrides are read on the server. Client bundles only ever see the defaults.
 */

export const AI_MODEL_DEFAULTS = {
  assistant: "claude-sonnet-4-6",
  fast: "claude-haiku-4-5",
  breakdown: "claude-fable-5-2",
  sttGroq: "whisper-large-v3-turbo",
  sttOpenai: "whisper-1",
} as const;

export type AiModelTier = keyof typeof AI_MODEL_DEFAULTS;

export const AI_MODEL_ENV: Record<AiModelTier, string> = {
  assistant: "AI_ASSISTANT_MODEL",
  fast: "AI_FAST_MODEL",
  breakdown: "AI_BREAKDOWN_MODEL",
  sttGroq: "STT_MODEL",
  sttOpenai: "STT_MODEL",
};

/** The model for a tier: its env override when set, otherwise the default. */
export function resolveAiModel(tier: AiModelTier): string {
  const override = process.env[AI_MODEL_ENV[tier]]?.trim();
  return override || AI_MODEL_DEFAULTS[tier];
}

/** Every tier with the model in effect and where it came from (for diagnostics). */
export function describeAiModels(): Array<{
  tier: AiModelTier;
  model: string;
  env: string;
  source: "env" | "default";
}> {
  return (Object.keys(AI_MODEL_DEFAULTS) as AiModelTier[]).map((tier) => {
    const override = process.env[AI_MODEL_ENV[tier]]?.trim();
    return {
      tier,
      model: override || AI_MODEL_DEFAULTS[tier],
      env: AI_MODEL_ENV[tier],
      source: override ? "env" : "default",
    };
  });
}
