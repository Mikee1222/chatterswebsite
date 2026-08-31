/**
 * Shortlist & hire approval copy for admin → candidate outreach.
 * Edit templates here — no rebuild of business logic required.
 */

import type {
  ApplicationFormAnswer,
  ApplicationFormQuestion,
  ApplicationResponseStatus,
} from "@/lib/application-forms-types";
import type { PipelineLanguage } from "@/lib/application-pipeline-i18n";

/** Pipeline statuses that unlock the "Copy Approval Message" action. */
export const APPROVAL_MESSAGE_STATUSES = ["shortlisted", "hired"] as const satisfies readonly ApplicationResponseStatus[];

export type ApprovalMessageStatus = (typeof APPROVAL_MESSAGE_STATUSES)[number];

export type ApplicationPositionType = "chatter" | "va";

const POSITION_LABELS: Record<PipelineLanguage, Record<ApplicationPositionType, string>> = {
  en: { chatter: "Chatter", va: "VA" },
  el: { chatter: "Chatter", va: "VA" },
};

/** Shortlisted — English templates; {name} and {position} are replaced at runtime. */
export const APPLICATION_APPROVAL_TEMPLATES_EN: Record<ApplicationPositionType, string> = {
  chatter: `Hi {name}! 🎉 Great news — you've been shortlisted for the {position} position at Gunzo Agency!

We were really impressed with your application and we'd love to move forward with the next steps. Someone from our team will reach out shortly with more details.

If you have any questions in the meantime, feel free to reply here.

Best regards,
The Gunzo Agency Team`,
  va: `Hi {name}! 🎉 Great news — you've been shortlisted for the {position} position at Gunzo Agency!

We were really impressed with your application and we'd love to move forward with the next steps. Someone from our team will reach out shortly with more details.

If you have any questions in the meantime, feel free to reply here.

Best regards,
The Gunzo Agency Team`,
};

/** Shortlisted — Greek templates; warm, natural phrasing (not literal translation). */
export const APPLICATION_APPROVAL_TEMPLATES_EL: Record<ApplicationPositionType, string> = {
  chatter: `Γεια σου {name}! 🎉 Έχουμε πολύ καλά νέα — προκριθήκες για τη θέση {position} στο Gunzo Agency!

Μας εντυπωσίασε η αίτησή σου και θα θέλαμε να προχωρήσουμε στο επόμενο βήμα. Σύντομα κάποιος από την ομάδα μας θα επικοινωνήσει μαζί σου με περισσότερες λεπτομέρειες.

Αν έχεις οποιαδήποτε απορία μέχρι τότε, μη διστάσεις να μας γράψεις.

Με εκτίμηση,
Η ομάδα του Gunzo Agency`,
  va: `Γεια σου {name}! 🎉 Έχουμε πολύ καλά νέα — προκριθήκες για τη θέση {position} στο Gunzo Agency!

Μας εντυπωσίασε η αίτησή σου και θα θέλαμε να προχωρήσουμε στο επόμενο βήμα. Σύντομα κάποιος από την ομάδα μας θα επικοινωνήσει μαζί σου με περισσότερες λεπτομέρειες.

Αν έχεις οποιαδήποτε απορία μέχρι τότε, μη διστάσεις να μας γράψεις.

Με εκτίμηση,
Η ομάδα του Gunzo Agency`,
};

/** Hired — English welcome (no credentials; account details sent separately). */
export const APPLICATION_HIRED_TEMPLATES_EN: Record<ApplicationPositionType, string> = {
  chatter: `Hi {name}! 🎉 Welcome to the Gunzo Agency team! I'm really excited to have you on board as a {position}.

I'll be sending over your account details separately, and we'll get you set up and ready to start. Looking forward to working with you!`,
  va: `Hi {name}! 🎉 Welcome to the Gunzo Agency team! I'm really excited to have you on board as a {position}.

I'll be sending over your account details separately, and we'll get you set up and ready to start. Looking forward to working with you!`,
};

/** Hired — Greek welcome (no credentials; account details sent separately). */
export const APPLICATION_HIRED_TEMPLATES_EL: Record<ApplicationPositionType, string> = {
  chatter: `Γεια σου {name}! 🎉 Καλώς ήρθες στην ομάδα του Gunzo Agency! Χαίρομαι ιδιαίτερα που θα είσαι μαζί μας ως {position}.

Θα σου στείλω τα στοιχεία του λογαριασμού σου ξεχωριστά και θα σε βοηθήσουμε να είσαι έτοιμος/η να ξεκινήσεις. Ανυπομονώ να δουλέψουμε μαζί!`,
  va: `Γεια σου {name}! 🎉 Καλώς ήρθες στην ομάδα του Gunzo Agency! Χαίρομαι ιδιαίτερα που θα είσαι μαζί μας ως {position}.

Θα σου στείλω τα στοιχεία του λογαριασμού σου ξεχωριστά και θα σε βοηθήσουμε να είσαι έτοιμος/η να ξεκινήσεις. Ανυπομονώ να δουλέψουμε μαζί!`,
};

const TEMPLATES_BY_STATUS: Record<
  ApprovalMessageStatus,
  Record<PipelineLanguage, Record<ApplicationPositionType, string>>
> = {
  shortlisted: {
    en: APPLICATION_APPROVAL_TEMPLATES_EN,
    el: APPLICATION_APPROVAL_TEMPLATES_EL,
  },
  hired: {
    en: APPLICATION_HIRED_TEMPLATES_EN,
    el: APPLICATION_HIRED_TEMPLATES_EL,
  },
};

export function resolveApplicationPositionType(formTitle: string): ApplicationPositionType {
  const t = formTitle.toLowerCase();
  if (/\bva\b|virtual\s*assistant/.test(t)) return "va";
  if (/chatter/.test(t)) return "chatter";
  return "chatter";
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

function fillTemplate(
  template: string,
  name: string,
  positionLabel: string,
): string {
  return template.replace(/\{name\}/g, name).replace(/\{position\}/g, positionLabel);
}

export type BuildApprovalMessageInput = {
  fullName: string;
  formTitle: string;
  preferredLanguage: PipelineLanguage | null | undefined;
  status: ApprovalMessageStatus;
};

export function buildApplicationApprovalMessage(input: BuildApprovalMessageInput): string {
  const lang: PipelineLanguage = input.preferredLanguage === "el" ? "el" : "en";
  const positionType = resolveApplicationPositionType(input.formTitle);
  const positionLabel = POSITION_LABELS[lang][positionType];
  const templates = TEMPLATES_BY_STATUS[input.status][lang];
  return fillTemplate(templates[positionType], input.fullName, positionLabel);
}

export function shouldShowApprovalMessage(
  status: ApplicationResponseStatus,
): status is ApprovalMessageStatus {
  return (APPROVAL_MESSAGE_STATUSES as readonly ApplicationResponseStatus[]).includes(status);
}
