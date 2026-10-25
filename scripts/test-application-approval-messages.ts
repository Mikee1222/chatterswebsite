/**
 * Resolution tests for hiring approval messages (no build).
 * Usage: npx tsx scripts/test-application-approval-messages.ts
 */

import {
  buildApplicationApprovalMessage,
  emptyApprovalMessageTemplates,
  parseApprovalMessageTemplates,
} from "@/lib/application-approval-messages";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function assertIncludes(hay: string, needle: string, msg: string) {
  assert(hay.includes(needle), `${msg}\n---\n${hay}\n---`);
}

function assertNotIncludes(hay: string, needle: string, msg: string) {
  assert(!hay.toLowerCase().includes(needle.toLowerCase()), `${msg}\n---\n${hay}\n---`);
}

const chatterTemplates = parseApprovalMessageTemplates({
  shortlisted: {
    en: "Hi {name}! shortlisted for the {position} role on {form_title}.",
    el: "Γεια σου {name}! προκρίθηκες για τη θέση {position} ({form_title}).",
  },
  hired: {
    en: "Welcome {name} as a {position}. Details separately.",
    el: "Καλώς ήρθες {name} ως {position}.",
  },
});

const vaTemplates = chatterTemplates;

// Chatter form → Chatter
{
  const msg = buildApplicationApprovalMessage({
    fullName: "Maria",
    formTitle: "New Chatters Apply Form",
    preferredLanguage: "en",
    status: "shortlisted",
    positionTitle: "Chatter",
    templates: chatterTemplates,
  });
  assertIncludes(msg, "Chatter", "Chatter form shortlisted EN");
  assertIncludes(msg, "Maria", "name filled");
  assertNotIncludes(msg, "password", "no credentials in shortlisted");
}

{
  const msg = buildApplicationApprovalMessage({
    fullName: "Maria",
    formTitle: "New Chatters Apply Form",
    preferredLanguage: "el",
    status: "hired",
    positionTitle: "Chatter",
    templates: chatterTemplates,
  });
  assertIncludes(msg, "Chatter", "Chatter form hired EL");
  assertIncludes(msg, "Maria", "EL name");
  assertNotIncludes(msg, "password", "hired never credentials");
  assertNotIncludes(msg, "@gmail", "hired never credentials email");
}

// VA form → Marketing Executive
{
  const msg = buildApplicationApprovalMessage({
    fullName: "Nikos",
    formTitle: "New VA Application",
    preferredLanguage: "en",
    status: "shortlisted",
    positionTitle: "Marketing Executive",
    templates: vaTemplates,
  });
  assertIncludes(msg, "Marketing Executive", "VA form uses Marketing Executive");
  assertNotIncludes(msg, "Chatter", "VA must not say Chatter");
  assert(!/\bas a VA\b/i.test(msg), "VA must not say 'as a VA' role");
}

// No position_title → neutral, no role name
{
  const msg = buildApplicationApprovalMessage({
    fullName: "Sam",
    formTitle: "Trend Researcher Application",
    preferredLanguage: "en",
    status: "shortlisted",
    positionTitle: null,
    templates: emptyApprovalMessageTemplates(),
  });
  assertIncludes(msg, "the role", "neutral shortlisted uses the role");
  assertNotIncludes(msg, "Chatter", "neutral must not say Chatter");
  assertNotIncludes(msg, "VA", "neutral must not say VA");
  assertNotIncludes(msg, "Marketing Executive", "neutral must not say ME");
  assertIncludes(msg, "quick call", "shortlisted = quick call");
}

{
  const msg = buildApplicationApprovalMessage({
    fullName: "Sam",
    formTitle: "Trend Researcher Application",
    preferredLanguage: "en",
    status: "hired",
    positionTitle: null,
    templates: emptyApprovalMessageTemplates(),
  });
  assert(msg.includes("Welcome"), "neutral hired welcome");
  assertNotIncludes(msg, "as a ", "neutral hired has no as a {position}");
  assertNotIncludes(msg, "password", "hired never credentials");
}

// Form template overrides neutral
{
  const custom = parseApprovalMessageTemplates({
    shortlisted: { en: "CUSTOM {name} / {position} / {form_title}", el: "" },
    hired: { en: "", el: "" },
  });
  const msg = buildApplicationApprovalMessage({
    fullName: "Pat",
    formTitle: "My Form",
    preferredLanguage: "en",
    status: "shortlisted",
    positionTitle: "Researcher",
    templates: custom,
  });
  assert(msg === "CUSTOM Pat / Researcher / My Form", `custom template: ${msg}`);
}

// Language follows preferred_language (defaults EN)
{
  const msg = buildApplicationApprovalMessage({
    fullName: "Pat",
    formTitle: "My Form",
    preferredLanguage: null,
    status: "hired",
    positionTitle: "Chatter",
    templates: emptyApprovalMessageTemplates(),
  });
  assertIncludes(msg, "Welcome", "null lang → EN");
  assertIncludes(msg, "as a Chatter", "EN hired with position");
}

console.log("OK: application approval message resolution tests passed");
