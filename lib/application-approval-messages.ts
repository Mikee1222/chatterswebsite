/**
 * Shortlist & hire approval copy for admin → candidate outreach.
 * Prefer per-form templates + position_title; never default to a named role.
 */

import type {
  ApplicationFormAnswer,
  ApplicationFormQuestion,
  ApplicationResponseStatus,
  ApprovalMessageTemplates,
} from "@/lib/application-forms-types";
import type { PipelineLanguage } from "@/lib/application-pipeline-i18n";

/** Pipeline statuses that unlock the "Copy Approval Message" action. */
export const APPROVAL_MESSAGE_STATUSES = ["shortlisted", "hired"] as const satisfies readonly ApplicationResponseStatus[];

export type ApprovalMessageStatus = (typeof APPROVAL_MESSAGE_STATUSES)[number];

export const APPROVAL_TEMPLATE_PLACEHOLDERS = ["{name}", "{position}", "{form_title}"] as const;

/** Neutral Shortlisted — with position_title. First person, quick call, no role name baked in. */
export const NEUTRAL_SHORTLISTED_WITH_POSITION_EN = `Hi {name}! 🎉 Great news — you've been shortlisted for the {position} role at Gunzo Agency!

I was really impressed with your application and I'd love to hop on a quick call to go over the next steps. I'll reach out shortly with a time that works.

If you have any questions in the meantime, feel free to reply here.

Best regards,
The Gunzo Agency Team`;

export const NEUTRAL_SHORTLISTED_WITHOUT_POSITION_EN = `Hi {name}! 🎉 Great news — you've been shortlisted for the role at Gunzo Agency!

I was really impressed with your application and I'd love to hop on a quick call to go over the next steps. I'll reach out shortly with a time that works.

If you have any questions in the meantime, feel free to reply here.

Best regards,
The Gunzo Agency Team`;

export const NEUTRAL_SHORTLISTED_WITH_POSITION_EL = `Γεια σου {name}! 🎉 Έχουμε πολύ καλά νέα — προκριθήκες για τη θέση {position} στο Gunzo Agency!

Μου έκανε πολύ καλή εντύπωση η αίτησή σου και θα ήθελα να κάνουμε μια σύντομη κλήση για τα επόμενα βήματα. Θα επικοινωνήσω σύντομα μαζί σου για ώρα που σε βολεύει.

Αν έχεις οποιαδήποτε απορία μέχρι τότε, μη διστάσεις να μου γράψεις.

Με εκτίμηση,
Η ομάδα του Gunzo Agency`;

export const NEUTRAL_SHORTLISTED_WITHOUT_POSITION_EL = `Γεια σου {name}! 🎉 Έχουμε πολύ καλά νέα — προκριθήκες για τη θέση στο Gunzo Agency!

Μου έκανε πολύ καλή εντύπωση η αίτησή σου και θα ήθελα να κάνουμε μια σύντομη κλήση για τα επόμενα βήματα. Θα επικοινωνήσω σύντομα μαζί σου για ώρα που σε βολεύει.

Αν έχεις οποιαδήποτε απορία μέχρι τότε, μη διστάσεις να μου γράψεις.

Με εκτίμηση,
Η ομάδα του Gunzo Agency`;

/** Neutral Hired — welcome only; never include credentials. */
export const NEUTRAL_HIRED_WITH_POSITION_EN = `Hi {name}! 🎉 Welcome to the Gunzo Agency team! I'm really excited to have you on board as a {position}.

I'll be sending over your account details separately, and we'll get you set up and ready to start. Looking forward to working with you!`;

export const NEUTRAL_HIRED_WITHOUT_POSITION_EN = `Hi {name}! 🎉 Welcome to the Gunzo Agency team! I'm really excited to have you on board.

I'll be sending over your account details separately, and we'll get you set up and ready to start. Looking forward to working with you!`;

export const NEUTRAL_HIRED_WITH_POSITION_EL = `Γεια σου {name}! 🎉 Καλώς ήρθες στην ομάδα του Gunzo Agency! Χαίρομαι ιδιαίτερα που θα είσαι μαζί μας ως {position}.

Θα σου στείλω τα στοιχεία του λογαριασμού σου ξεχωριστά και θα σε βοηθήσουμε να είσαι έτοιμος/η να ξεκινήσεις. Ανυπομονώ να δουλέψουμε μαζί!`;

export const NEUTRAL_HIRED_WITHOUT_POSITION_EL = `Γεια σου {name}! 🎉 Καλώς ήρθες στην ομάδα του Gunzo Agency! Χαίρομαι ιδιαίτερα που θα είσαι μαζί μας.

Θα σου στείλω τα στοιχεία του λογαριασμού σου ξεχωριστά και θα σε βοηθήσουμε να είσαι έτοιμος/η να ξεκινήσεις. Ανυπομονώ να δουλέψουμε μαζί!`;

function neutralDefault(
  status: ApprovalMessageStatus,
  lang: PipelineLanguage,
  hasPosition: boolean,
): string {
  if (status === "shortlisted") {
    if (lang === "el") {
      return hasPosition
        ? NEUTRAL_SHORTLISTED_WITH_POSITION_EL
        : NEUTRAL_SHORTLISTED_WITHOUT_POSITION_EL;
    }
    return hasPosition
      ? NEUTRAL_SHORTLISTED_WITH_POSITION_EN
      : NEUTRAL_SHORTLISTED_WITHOUT_POSITION_EN;
  }
  if (lang === "el") {
    return hasPosition ? NEUTRAL_HIRED_WITH_POSITION_EL : NEUTRAL_HIRED_WITHOUT_POSITION_EL;
  }
  return hasPosition ? NEUTRAL_HIRED_WITH_POSITION_EN : NEUTRAL_HIRED_WITHOUT_POSITION_EN;
}

/** Default seed text for a form that has a position_title (uses {position}). */
export function defaultApprovalTemplateForPosition(
  status: ApprovalMessageStatus,
  lang: PipelineLanguage,
): string {
  return neutralDefault(status, lang, true);
}

export function emptyApprovalMessageTemplates(): ApprovalMessageTemplates {
  return {
    shortlisted: { en: "", el: "" },
    hired: { en: "", el: "" },
  };
}

export function parseApprovalMessageTemplates(raw: unknown): ApprovalMessageTemplates {
  const out = emptyApprovalMessageTemplates();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const obj = raw as Record<string, unknown>;
  for (const status of APPROVAL_MESSAGE_STATUSES) {
    const block = obj[status];
    if (!block || typeof block !== "object" || Array.isArray(block)) continue;
    const langs = block as Record<string, unknown>;
    out[status] = {
      en: typeof langs.en === "string" ? langs.en : "",
      el: typeof langs.el === "string" ? langs.el : "",
    };
  }
  return out;
}

export function normalizeApprovalMessageTemplates(
  raw: unknown,
): ApprovalMessageTemplates {
  return parseApprovalMessageTemplates(raw);
}

function pickFormTemplate(
  templates: ApprovalMessageTemplates | null | undefined,
  status: ApprovalMessageStatus,
  lang: PipelineLanguage,
): string | null {
  const text = templates?.[status]?.[lang]?.trim() ?? "";
  return text || null;
}

export function fillApprovalTemplate(
  template: string,
  vars: { name: string; position: string; formTitle: string },
): string {
  return template
    .replace(/\{name\}/g, vars.name)
    .replace(/\{position\}/g, vars.position)
    .replace(/\{form_title\}/g, vars.formTitle);
}

export function extractCandidateFullName(
  questions: ApplicationFormQuestion[],
  answers: ApplicationFormAnswer[],
): string {
  const fullNameQ = questions.find(
    (q) =>
      q.question_text.trim().toLowerCase() === "full name" ||
      q.question_text_el.trim() === "Ονοματεπώνυμο",
  );
  if (fullNameQ) {
    const answer = answers.find((a) => a.question_id === fullNameQ.id);
    const name = (answer?.answer_text ?? "").trim();
    if (name) return name;
  }
  const first = answers.find((a) => (a.answer_text ?? "").trim());
  return first?.answer_text?.trim() || "there";
}

export type BuildApprovalMessageInput = {
  fullName: string;
  formTitle: string;
  preferredLanguage: PipelineLanguage | null | undefined;
  status: ApprovalMessageStatus;
  /** Form's position_title — never inferred from title. */
  positionTitle?: string | null;
  /** Form's stored templates; empty/missing slots fall through to neutral defaults. */
  templates?: ApprovalMessageTemplates | null;
};

/**
 * Resolution: form template for status+lang → neutral global default.
 * Neutral never names Chatter / VA / Marketing Executive.
 */
export function buildApplicationApprovalMessage(input: BuildApprovalMessageInput): string {
  const lang: PipelineLanguage = input.preferredLanguage === "el" ? "el" : "en";
  const position = (input.positionTitle ?? "").trim();
  const hasPosition = position.length > 0;
  const formTpl = pickFormTemplate(input.templates, input.status, lang);
  const template = formTpl ?? neutralDefault(input.status, lang, hasPosition);
  return fillApprovalTemplate(template, {
    name: input.fullName.trim() || "there",
    position,
    formTitle: input.formTitle.trim() || "application",
  });
}

export function shouldShowApprovalMessage(
  status: ApplicationResponseStatus,
): status is ApprovalMessageStatus {
  return (APPROVAL_MESSAGE_STATUSES as readonly ApplicationResponseStatus[]).includes(status);
}

export function approvalLanguageLabel(
  preferredLanguage: PipelineLanguage | null | undefined,
): string {
  return preferredLanguage === "el" ? "Greek" : "English";
}
