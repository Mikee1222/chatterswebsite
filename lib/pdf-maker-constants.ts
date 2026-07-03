import type { PdfMetaField } from "@/services/pdf-maker";

export const SKIT_BRIEF_TEMPLATE_ID = "skit-brief";

export const SKIT_BRIEF_DEFAULT_META_LABELS = [
  "TYPE",
  "MODEL",
  "ΗΜΕΡΟΜΗΝΙΑ ΓΥΡΙΣΜΑΤΟΣ",
] as const;

export const SKIT_BRIEF_DEFAULT_FOOTER =
  "Gunzo Agency · Final Production Brief · Εμπιστευτικό έγγραφο";

export function emptyMetaFields(labels: readonly string[]): PdfMetaField[] {
  return labels.map((label) => ({ label, value: "" }));
}

export function resolveFooterText(template: string, title: string): string {
  return template.replace(/\{title\}/gi, title.trim());
}
