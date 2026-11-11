/**
 * Creative Scripts × Winner Breakdown: turn the breakdown of a slot's reference video
 * into the script idea block (original for the grid + two variations for trials),
 * grounded in the creator's persona and written in her first language. The Creative
 * Director reviews it, localises the slang and submits — nothing is saved here.
 */

import "server-only";

import { callAnthropicVision, resolveBreakdownModel } from "@/lib/ai-assistant";
import { buildPersonaAiContext, PLATFORM_SAFE_SOCIAL_RULES } from "@/lib/persona-ai-context";
import {
  SCRIPT_IDEA_MAX_TOKENS,
  SCRIPT_IDEA_SYSTEM_PROMPT,
  SCRIPT_IDEA_TOOL,
  SCRIPT_IDEA_TOOL_NAME,
  sanitizeScriptIdea,
  scriptIdeaToText,
  scriptIdeaToTextOnScreen,
  type ScriptIdeaJson,
} from "@/lib/script-idea-schema";
import { breakdownToMarkdown } from "@/lib/winner-breakdown-schema";
import { assertCreativeRateLimit } from "@/services/creative-studio";
import { getModelById } from "@/services/modelss";
import { getPersonaByModelId, isPersonaAdult, listLiveUpdates } from "@/services/model-personas";
import { getWinnerBreakdown } from "@/services/winner-breakdowns";

export type ScriptFromBreakdownResult = {
  idea: ScriptIdeaJson;
  script_text: string;
  text_on_screen: string;
  language: string;
  model: string;
};

export async function draftScriptFromBreakdown(input: {
  breakdownId: string;
  modelId: string;
  videoType?: string;
  adminInstructions?: string;
  userId: string;
}): Promise<ScriptFromBreakdownResult> {
  const breakdown = await getWinnerBreakdown(input.breakdownId);
  if (!breakdown) throw new Error("Breakdown not found");
  if (breakdown.status !== "success" || breakdown.breakdown.refusal) {
    throw new Error("This breakdown has no usable analysis");
  }

  const model = await getModelById(input.modelId);
  if (!model) throw new Error("Pick a Gunzo-team model first");
  const creatorName = model.model_name?.trim() || "Creator";

  const persona = await getPersonaByModelId(input.modelId);
  if (!persona) throw new Error(`No persona found for ${creatorName} — create one first`);
  if (!isPersonaAdult(persona.personal_info)) {
    throw new Error("AI generation disabled — birth date required and must be 18+");
  }
  const live = await listLiveUpdates(persona.id, { includeInactive: false });
  const personaText = buildPersonaAiContext(persona, live).contextText;
  const language = persona.personal_info.languages?.[0]?.language?.trim() || "Greek";

  await assertCreativeRateLimit(input.userId);

  const text = [
    `CREATOR: ${creatorName}`,
    `WRITE EVERYTHING IN: ${language} (natural, spoken, the way she would say it). The Creative Director will only polish local slang.`,
    input.videoType ? `VIDEO TYPE (set by research): ${input.videoType}` : "",
    input.adminInstructions?.trim()
      ? `INSTRUCTIONS FROM THE HEAD OF MARKETING:\n${input.adminInstructions.trim().slice(0, 1500)}`
      : "",
    "",
    "CREATOR PERSONA:",
    personaText || "(no persona details)",
    "",
    PLATFORM_SAFE_SOCIAL_RULES,
    "",
    "BREAKDOWN OF THE REFERENCE VIDEO:",
    breakdownToMarkdown(breakdown.breakdown, {
      title: breakdown.title,
      sourceUrl: breakdown.source_url,
    }),
    breakdown.transcript?.trim()
      ? `\nTRANSCRIPT OF THE REFERENCE:\n${breakdown.transcript.trim().slice(0, 4000)}`
      : "",
  ]
    .filter((l) => l !== "")
    .join("\n");

  // Owner rule: Winner Breakdown work runs on the configured breakdown model only —
  // no silent fallback to another model.
  const modelName = resolveBreakdownModel();
  const result = await callAnthropicVision({
    text,
    system: SCRIPT_IDEA_SYSTEM_PROMPT,
    maxTokens: SCRIPT_IDEA_MAX_TOKENS,
    temperature: 0.6,
    model: modelName,
    logLabel: "creative_script_from_breakdown",
    tools: [
      SCRIPT_IDEA_TOOL as unknown as {
        name: string;
        description: string;
        input_schema: Record<string, unknown>;
      },
    ],
    toolChoice: { type: "tool", name: SCRIPT_IDEA_TOOL_NAME },
  });

  const idea = sanitizeScriptIdea(result?.toolInput ?? null);
  if (!idea) {
    throw new Error(
      `The AI could not write the script (model ${modelName}). Try again; if it keeps failing, the API key may not have access to this model.`,
    );
  }
  return {
    idea,
    script_text: scriptIdeaToText(idea),
    text_on_screen: scriptIdeaToTextOnScreen(idea),
    language,
    model: modelName,
  };
}
