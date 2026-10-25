/**
 * Keep agent_action_log free of persona text / captions / descriptions.
 * Full values live in result._exec while status=proposed, then wiped on execute.
 */

import { createHash } from "crypto";

const CONTENT_PARAM_KEYS = new Set([
  "content",
  "caption",
  "text_on_screen",
  "description",
  "idea_context",
  "fields",
  "variations",
  "ideas",
  "posts",
  "title",
  "instructions_notes",
]);

function sha16(v: unknown): string {
  try {
    return createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);
  } catch {
    return "na";
  }
}

function lengthOf(v: unknown): number {
  if (typeof v === "string") return v.length;
  try {
    return JSON.stringify(v)?.length ?? 0;
  } catch {
    return 0;
  }
}

/** Tools whose parameters may contain creative/persona text. */
export const GUNZO_CONTENT_ACTION_TOOLS = new Set([
  "update_persona_fields",
  "add_live_update",
  "update_live_update",
  "save_ideas",
  "create_posting_brief_draft",
  "add_post_to_posting_brief_draft",
]);

export type SanitizedActionParams = {
  /** Safe for agent_action_log.parameters and UI confirm card. */
  logParameters: Record<string, unknown>;
  /** Full params for execute — stored in result._exec until confirmed. */
  executionPayload: Record<string, unknown> | null;
};

/**
 * Split action parameters into log-safe metadata + deferred execution payload.
 */
export function sanitizeGunzoActionParameters(
  toolName: string,
  parameters: Record<string, unknown>,
): SanitizedActionParams {
  if (!GUNZO_CONTENT_ACTION_TOOLS.has(toolName)) {
    return { logParameters: { ...parameters }, executionPayload: null };
  }

  const logParameters: Record<string, unknown> = {};
  const executionPayload: Record<string, unknown> = {};
  let hasDeferred = false;

  for (const [key, value] of Object.entries(parameters)) {
    if (CONTENT_PARAM_KEYS.has(key) && value != null && value !== "") {
      hasDeferred = true;
      executionPayload[key] = value;
      if (key === "fields" && value && typeof value === "object" && !Array.isArray(value)) {
        logParameters.field_keys = Object.keys(value as Record<string, unknown>);
        logParameters.fields_sha256 = sha16(value);
      } else if (key === "ideas" && Array.isArray(value)) {
        logParameters.idea_count = value.length;
        logParameters.ideas_sha256 = sha16(value);
      } else if (key === "variations" && Array.isArray(value)) {
        logParameters.variation_count = value.length;
        logParameters.variations_sha256 = sha16(value);
      } else {
        logParameters[`${key}_length`] = lengthOf(value);
        logParameters[`${key}_sha256`] = sha16(value);
      }
      continue;
    }
    logParameters[key] = value;
  }

  // Always keep ids / model references on the log row
  for (const idKey of [
    "model_id",
    "model_name",
    "persona_id",
    "live_update_id",
    "brief_id",
    "idea_id",
    "idea_ids",
    "section",
    "platform",
    "idea_type",
    "thumbs",
    "is_favourite",
  ]) {
    if (parameters[idKey] !== undefined && logParameters[idKey] === undefined) {
      logParameters[idKey] = parameters[idKey];
    }
  }

  return {
    logParameters,
    executionPayload: hasDeferred ? executionPayload : null,
  };
}

/** Merge log parameters with deferred _exec payload for confirmed execution. */
export function mergeGunzoActionParameters(
  logParameters: Record<string, unknown>,
  result: unknown,
): Record<string, unknown> {
  const exec =
    result &&
    typeof result === "object" &&
    !Array.isArray(result) &&
    (result as { _exec?: unknown })._exec &&
    typeof (result as { _exec: unknown })._exec === "object"
      ? ((result as { _exec: Record<string, unknown> })._exec ?? {})
      : {};
  return { ...logParameters, ...exec };
}

/** Strip _exec from result before persisting executed/failed outcomes. */
export function stripExecFromResult(result: unknown): unknown {
  if (!result || typeof result !== "object" || Array.isArray(result)) return result;
  const { _exec: _drop, ...rest } = result as Record<string, unknown>;
  return rest;
}
