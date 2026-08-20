/**
 * Helpers for Application/Recruitment notification deep-links and copy.
 * entity_id encodes formId:responseId so routes can open response detail.
 */

import {
  RESPONSE_STATUS_LABELS,
  type ApplicationResponseStatus,
} from "@/lib/application-forms-types";

/** Encode form + response for notification entity_id. */
export function applicationResponseEntityId(formId: string, responseId: string): string {
  return `${formId}:${responseId}`;
}

/** Parse notification entity_id back into form + response IDs. */
export function parseApplicationResponseEntityId(
  entityId: string,
): { formId: string; responseId: string } | null {
  const idx = entityId.indexOf(":");
  if (idx <= 0) return null;
  const formId = entityId.slice(0, idx).trim();
  const responseId = entityId.slice(idx + 1).trim();
  if (!formId || !responseId) return null;
  return { formId, responseId };
}

/** Same heuristic as admin response list/detail — first non-empty answer text. */
export function candidateDisplayNameFromAnswers(
  answers: Array<{ answer_text?: string | null }>,
): string {
  const first = answers.find((a) => (a.answer_text ?? "").trim());
  return first?.answer_text?.trim() || "Candidate";
}

export function applicationSubmittedCopy(candidateName: string, formTitle: string) {
  const name = candidateName.trim() || "Candidate";
  const title = formTitle.trim() || "Application form";
  return {
    title: "New application submitted",
    body: `${name} submitted an application for "${title}".`,
  };
}

export function applicationStatusChangedCopy(
  candidateName: string,
  formTitle: string,
  status: ApplicationResponseStatus,
) {
  const name = candidateName.trim() || "Candidate";
  const form = formTitle.trim() || "Application form";
  const label = RESPONSE_STATUS_LABELS[status];
  if (status === "hired") {
    return {
      title: "🎉 Candidate hired!",
      body: `${name} was hired for "${form}". Congratulations!`,
    };
  }
  return {
    title: `Application ${label.toLowerCase()}`,
    body: `${name}'s application for "${form}" is now ${label}.`,
  };
}
