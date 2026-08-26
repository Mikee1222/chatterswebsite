/**
 * Hire flow: status → hired + cosmetic username + AES-256-GCM encrypted password.
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import {
  decryptCredentialPayload,
  encryptCredentialPayload,
} from "@/lib/credentials-crypto";
import {
  buildHireUsername,
  deriveHireFirstname,
  generateStrongHirePassword,
  randomHireSuffix,
} from "@/lib/application-hire-credentials";
import type {
  ApplicationFormAnswer,
  ApplicationFormQuestion,
  ApplicationFormResponse,
  ApplicationFormResponseWithAnswers,
} from "@/lib/application-forms-types";
import { getResponseDetail, updateResponse } from "@/services/application-forms";

export type HireActor = { userId: string; userName: string };

export type HireCredentialsResult = {
  response: ApplicationFormResponse;
  username: string;
  /** Plaintext password — only returned on hire/reveal/copy; never stored client-side by us. */
  password: string;
  created: boolean;
  hire_credentials_created_at: string | null;
};

function findFullName(
  answers: ApplicationFormAnswer[],
  questions?: ApplicationFormQuestion[],
): string {
  if (questions?.length) {
    const nameQ = questions.find((q) => {
      const t = `${q.question_text} ${q.question_text_el}`.toLowerCase();
      return (
        t.includes("full name") ||
        t.includes("ονοματεπώνυμο") ||
        t.includes("ονοματεπωνυμο") ||
        (t.includes("name") && !t.includes("user")) ||
        t.includes("όνομα") ||
        t.includes("ονομα")
      );
    });
    if (nameQ) {
      const a = answers.find((x) => x.question_id === nameQ.id);
      const text = (a?.answer_text ?? "").trim();
      if (text) return text;
    }
  }
  const first = answers.find((a) => (a.answer_text ?? "").trim());
  return first?.answer_text?.trim() || "Candidate";
}

async function usernameTaken(username: string, excludeResponseId?: string): Promise<boolean> {
  const sb = getSupabaseServiceClient();
  let q = sb
    .from("application_form_responses")
    .select("id")
    .eq("generated_username", username)
    .limit(1);
  if (excludeResponseId) q = q.neq("id", excludeResponseId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

async function mintUniqueUsername(fullName: string, responseId: string): Promise<string> {
  const firstname = deriveHireFirstname(fullName);
  for (let attempt = 0; attempt < 24; attempt++) {
    const suffixLen = attempt < 12 ? 4 : 5;
    const username = buildHireUsername(firstname, randomHireSuffix(suffixLen));
    if (!(await usernameTaken(username, responseId))) return username;
  }
  // Extremely unlikely fallback
  const username = buildHireUsername(firstname, randomHireSuffix(8));
  if (await usernameTaken(username, responseId)) {
    throw new Error("Could not allocate a unique hire username");
  }
  return username;
}

function decryptHirePassword(ciphertext: string): string {
  const payload = decryptCredentialPayload(ciphertext);
  const password = payload.password?.trim();
  if (!password) throw new Error("Hire password payload missing");
  return password;
}

export async function logHireCredentialAccess(params: {
  responseId: string;
  actor: HireActor;
  action: "revealed" | "copied" | "viewed_masked";
  fieldName?: "username" | "password" | null;
}): Promise<void> {
  const sb = getSupabaseServiceClient();
  const { error } = await sb.from("application_hire_access_log").insert({
    response_id: params.responseId,
    user_id: params.actor.userId,
    user_name: params.actor.userName,
    action: params.action,
    field_name: params.fieldName ?? null,
  });
  if (error) throw new Error(`log hire credential access: ${error.message}`);
}

/**
 * Transition to Hired and create credentials if missing (idempotent).
 */
export async function hireApplicationCandidate(params: {
  responseId: string;
  formId: string;
  actor: HireActor;
  questions?: ApplicationFormQuestion[];
}): Promise<HireCredentialsResult> {
  const detail = await getResponseDetail(params.responseId);
  if (!detail) throw new Error("Response not found");
  if (detail.form_id !== params.formId) throw new Error("Form mismatch");

  // Idempotent: already hired with credentials
  if (detail.generated_username && detail.has_hire_password) {
    const sb = getSupabaseServiceClient();
    const { data, error } = await sb
      .from("application_form_responses")
      .select("encrypted_hire_password, hire_credentials_created_at, status, generated_username")
      .eq("id", params.responseId)
      .single();
    if (error) throw new Error(error.message);
    const password = decryptHirePassword(String(data.encrypted_hire_password ?? ""));
    if (detail.status !== "hired") {
      await updateResponse(params.responseId, { status: "hired" });
    }
    await logHireCredentialAccess({
      responseId: params.responseId,
      actor: params.actor,
      action: "viewed_masked",
    }).catch(() => undefined);
    const refreshed = await getResponseDetail(params.responseId);
    return {
      response: refreshed ?? detail,
      username: String(data.generated_username ?? detail.generated_username),
      password,
      created: false,
      hire_credentials_created_at:
        (data.hire_credentials_created_at as string | null) ??
        detail.hire_credentials_created_at,
    };
  }

  const fullName = findFullName(detail.answers, params.questions);
  const username = await mintUniqueUsername(fullName, params.responseId);
  const password = generateStrongHirePassword();
  const encrypted = encryptCredentialPayload({ password });
  const now = new Date().toISOString();

  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("application_form_responses")
    .update({
      status: "hired",
      generated_username: username,
      encrypted_hire_password: encrypted,
      hire_credentials_created_at: now,
      updated_at: now,
    })
    .eq("id", params.responseId)
    .select("*")
    .single();
  if (error) {
    // Unique collision race — retry once
    if (error.message.toLowerCase().includes("unique") || error.code === "23505") {
      const username2 = await mintUniqueUsername(fullName, params.responseId);
      const { data: data2, error: err2 } = await sb
        .from("application_form_responses")
        .update({
          status: "hired",
          generated_username: username2,
          encrypted_hire_password: encrypted,
          hire_credentials_created_at: now,
          updated_at: now,
        })
        .eq("id", params.responseId)
        .select("*")
        .single();
      if (err2) throw new Error(err2.message);
      const mapped = await getResponseDetail(params.responseId);
      return {
        response: mapped!,
        username: username2,
        password,
        created: true,
        hire_credentials_created_at: now,
      };
    }
    throw new Error(error.message);
  }

  void data;
  const mapped = await getResponseDetail(params.responseId);
  await logHireCredentialAccess({
    responseId: params.responseId,
    actor: params.actor,
    action: "viewed_masked",
  }).catch(() => undefined);

  return {
    response: mapped!,
    username,
    password,
    created: true,
    hire_credentials_created_at: now,
  };
}

export async function revealHirePassword(params: {
  responseId: string;
  formId: string;
  actor: HireActor;
  action: "revealed" | "copied";
  field: "username" | "password";
}): Promise<{ username: string; password?: string }> {
  const detail = await getResponseDetail(params.responseId);
  if (!detail) throw new Error("Response not found");
  if (detail.form_id !== params.formId) throw new Error("Form mismatch");
  if (!detail.generated_username || !detail.has_hire_password) {
    throw new Error("No hire credentials for this candidate");
  }

  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from("application_form_responses")
    .select("encrypted_hire_password, generated_username")
    .eq("id", params.responseId)
    .single();
  if (error) throw new Error(error.message);

  const username = String(data.generated_username ?? detail.generated_username);
  await logHireCredentialAccess({
    responseId: params.responseId,
    actor: params.actor,
    action: params.action,
    fieldName: params.field,
  });

  if (params.field === "username") {
    return { username };
  }

  const password = decryptHirePassword(String(data.encrypted_hire_password ?? ""));
  return { username, password };
}

export type { ApplicationFormResponseWithAnswers };
