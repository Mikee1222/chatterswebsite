/**
 * Throwaway mocked tests for Gunzo Agent Personas + Creative Studio access.
 * Run: npx tsx scripts/test-gunzo-agent-persona-studio.ts
 */

import assert from "node:assert/strict";
import {
  buildPersonaAiContext,
  FORBIDDEN_AI_CONTEXT_KEYS,
  socialOutputViolationReason,
  filterSocialVariations,
} from "@/lib/persona-ai-context";
import {
  GUNZO_ACTION_TOOL_NAMES,
  GUNZO_READ_TOOL_NAMES,
  GUNZO_TOOL_META,
  isGunzoActionTool,
  isGunzoReadTool,
} from "@/lib/gunzo-agent-tools";
import {
  mergeGunzoActionParameters,
  sanitizeGunzoActionParameters,
  stripExecFromResult,
} from "@/lib/gunzo-agent-action-sanitize";
import { MAX_ACTIVE_LIVE_UPDATES, isSensitivePersonaSection } from "@/lib/persona-types";
import { PERMISSIONS } from "@/lib/permissions";
import type { ModelPersona } from "@/lib/persona-types";

function fakePersona(over: Partial<ModelPersona> = {}): ModelPersona {
  return {
    id: "p1",
    model_id: "m1",
    bio: "Creator bio",
    personal_info: {
      name: "Test",
      birth_date: "1995-01-15",
      country: "GR",
    },
    chatting: {
      words_phrases_to_avoid: ["bannedword"],
      writing_level: "casual",
      explicitness_level: "high",
    },
    lifestyle: { hobbies: "yoga" },
    physique: { height: "SECRET_PHYS" },
    content: { niche: "lifestyle", red_lines: "nofaceleak" },
    intimate_details: { why_started: "SECRET_INT" },
    socials: { social_platforms: "Instagram" },
    ai_context_flags: {
      religion: false,
      ideology: false,
      relationship: false,
      orientation: false,
    },
    draft: null,
    last_updated_by: "",
    last_updated_by_name: "",
    created_at: "",
    updated_at: "2026-10-01T00:00:00Z",
    ...over,
  };
}

console.log("1) Sensitive unreachable; AI context keys assert no sensitive");
{
  const persona = fakePersona();
  const bundle = buildPersonaAiContext(persona, []);
  const ctxStr = JSON.stringify(bundle.context);
  assert.ok(!ctxStr.includes("SECRET_PHYS"));
  assert.ok(!ctxStr.includes("SECRET_INT"));
  assert.ok(!("physique" in bundle.context));
  assert.ok(!("intimate_details" in bundle.context));
  assert.ok(!bundle.allowlistKeysUsed.includes("physique"));
  assert.ok(!bundle.allowlistKeysUsed.some((k) => k.includes("intimate")));
  assert.ok(!bundle.allowlistKeysUsed.includes("chatting.explicitness_level"));
  for (const blocked of FORBIDDEN_AI_CONTEXT_KEYS) {
    if (blocked.includes(".")) {
      const [a, b] = blocked.split(".");
      const nest = bundle.context[a!];
      assert.ok(!(nest && typeof nest === "object" && b && b in (nest as object)));
    } else {
      assert.ok(!(blocked in bundle.context));
    }
  }
  assert.ok(isSensitivePersonaSection("physique"));
  assert.ok(isSensitivePersonaSection("intimate_details"));
  console.log("ok sensitive excluded from AI context");
}

console.log("2) Writes = confirmation; cancel = no change (action tools gated)");
{
  for (const name of [
    "create_persona",
    "update_persona_fields",
    "save_ideas",
    "create_posting_brief_draft",
    "deactivate_live_update",
  ]) {
    assert.ok(isGunzoActionTool(name), `${name} must be action`);
    assert.equal(GUNZO_TOOL_META[name as keyof typeof GUNZO_TOOL_META].kind, "action");
  }
  for (const name of ["generate_captions", "list_personas", "get_model_persona"]) {
    assert.ok(isGunzoReadTool(name), `${name} must be read/immediate`);
  }
  console.log("ok write tools are confirmation-gated; generate is immediate");
}

console.log("3) Permission matrix — creative_studio / personas required beyond ai_agent:use");
{
  assert.equal(
    GUNZO_TOOL_META.generate_captions.requiredPermission,
    PERMISSIONS.CREATIVE_STUDIO_USE,
  );
  assert.equal(
    GUNZO_TOOL_META.captions_from_description.requiredPermission,
    PERMISSIONS.CREATIVE_STUDIO_USE,
  );
  assert.equal(
    GUNZO_TOOL_META.update_persona_fields.requiredPermission,
    PERMISSIONS.PERSONAS_MANAGE,
  );
  assert.equal(GUNZO_TOOL_META.list_personas.requiredPermission, PERMISSIONS.PERSONAS_VIEW);
  assert.equal(
    GUNZO_TOOL_META.create_posting_brief_draft.requiredPermission,
    PERMISSIONS.POSTING_BRIEFS_MANAGE,
  );
  assert.equal(GUNZO_TOOL_META.save_ideas.requiredPermission, PERMISSIONS.CREATIVE_STUDIO_USE);
  console.log("ok permissions require studio/personas/briefs beyond ai_agent:use");
}

console.log("4) Ambiguous model — resolve returns ambiguous_entity shape (contract)");
{
  // Contract: resolve module exports entity_not_found / ambiguous — tools rely on it
  const { resolveModelNameFromCatalog, extractModelAliases } = await import(
    "@/lib/gunzo-agent-resolve"
  );
  const catalog = [
    {
      id: "id-gr",
      model_id: "lina-gr",
      model_name: "Lina",
      team: "gunzo_team",
      status: "active",
      aliases: extractModelAliases("Lina"),
    },
    {
      id: "id-us",
      model_id: "lina-us",
      model_name: "Lina (USA)",
      team: "gunzo_team",
      status: "active",
      aliases: extractModelAliases("Lina (USA)"),
    },
  ];
  const result = resolveModelNameFromCatalog("Lina", catalog);
  assert.equal(result.status, "ambiguous");
  if (result.status === "ambiguous") {
    assert.ok(result.options.length >= 2);
  }
  console.log("ok ambiguous Lina vs Lina (USA)");
}

console.log("5) Avoid-words / red-lines / platform-safe = Studio filters; no 18+ birth blocks adult check");
{
  const avoid = ["bannedword"];
  const red = "nofaceleak";
  assert.equal(socialOutputViolationReason("hello bannedword world", avoid, red), "avoid-word:bannedword");
  assert.equal(socialOutputViolationReason("check nofaceleak tip", avoid, red), "red-line:nofaceleak");
  assert.equal(socialOutputViolationReason("totally nude vibes", avoid, red), "platform-unsafe");
  assert.equal(socialOutputViolationReason("sunset coffee stroll ☀️", avoid, red), null);
  const filtered = filterSocialVariations(
    ["nice day", "bannedword oops", "sunset coffee"],
    avoid,
    red,
  );
  assert.deepEqual(filtered.kept, ["nice day", "sunset coffee"]);
  const { isBirthDateAdult } = await import("@/lib/persona-completeness");
  assert.equal(isBirthDateAdult({ birth_date: "2015-01-01" }), false);
  assert.equal(isBirthDateAdult({ birth_date: "1990-06-01" }), true);
  assert.equal(isBirthDateAdult({}), false);
  console.log("ok guardrails + 18+ birth gate");
}

console.log("6) Deactivate exists; delete tool does not; live-update max 7");
{
  assert.ok(isGunzoActionTool("deactivate_live_update"));
  assert.ok(!("delete_live_update" in GUNZO_TOOL_META));
  assert.ok(!("delete_persona" in GUNZO_TOOL_META));
  assert.ok(!("delete_idea" in GUNZO_TOOL_META));
  assert.equal(MAX_ACTIVE_LIVE_UPDATES, 7);
  console.log("ok deactivate only, max 7");
}

console.log("7) No persona/caption text in agent_action_log parameters");
{
  const { logParameters, executionPayload } = sanitizeGunzoActionParameters("save_ideas", {
    model_name: "m1",
    ideas: [{ content: "SECRET_CAPTION_TEXT here", idea_type: "caption" }],
  });
  const logStr = JSON.stringify(logParameters);
  assert.ok(!logStr.includes("SECRET_CAPTION_TEXT"));
  assert.ok(executionPayload);
  assert.ok(JSON.stringify(executionPayload).includes("SECRET_CAPTION_TEXT"));
  const merged = mergeGunzoActionParameters(logParameters, { _exec: executionPayload });
  assert.ok(JSON.stringify(merged).includes("SECRET_CAPTION_TEXT"));
  const stripped = stripExecFromResult({ summary: "ok", _exec: executionPayload, data: { idea_ids: ["1"] } });
  assert.ok(!JSON.stringify(stripped).includes("SECRET_CAPTION_TEXT"));

  const personaUpdate = sanitizeGunzoActionParameters("update_persona_fields", {
    model_name: "m1",
    section: "bio",
    fields: { bio: "PERSONA_SECRET_BIO" },
  });
  assert.ok(!JSON.stringify(personaUpdate.logParameters).includes("PERSONA_SECRET_BIO"));
  assert.deepEqual(personaUpdate.logParameters.field_keys, ["bio"]);
  console.log("ok log sanitization keeps content out of parameters");
}

console.log("8) E2E contract: persona → captions → save → brief tools wired");
{
  const chain = [
    "get_model_persona",
    "generate_captions",
    "save_ideas",
    "create_posting_brief_draft",
  ];
  for (const t of chain) {
    assert.ok(t in GUNZO_TOOL_META, `missing tool ${t}`);
  }
  assert.ok(GUNZO_READ_TOOL_NAMES.includes("generate_captions" as never));
  assert.ok(GUNZO_ACTION_TOOL_NAMES.includes("save_ideas" as never));
  console.log("ok e2e tool chain present");
}

console.log("\nAll Gunzo Agent persona/studio tests passed.");
