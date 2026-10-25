/**
 * Persona completeness scoring — pure helpers safe for client + server.
 * Sensitive sections (physique / intimate) are scored only when the caller opts in.
 */

import {
  PERSONA_SECTIONS,
  SENSITIVE_PERSONA_SECTIONS,
  type PersonaSectionData,
  type PersonaSectionKey,
  type PersonaPersonalInfo,
} from "@/lib/persona-types";

export function isFilledValue(v: unknown): boolean {
  if (v == null || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "boolean") return true;
  if (typeof v === "object") {
    return Object.values(v as Record<string, unknown>).some(isFilledValue);
  }
  return String(v).trim().length > 0;
}

export function completenessForSection(
  key: PersonaSectionKey,
  sections: PersonaSectionData,
  liveCount: number,
): number {
  if (key === "live_updates") return liveCount > 0 ? 1 : 0;
  if (key === "bio") return sections.bio.trim() ? 1 : 0;

  const obj =
    key === "personal_info"
      ? sections.personal_info
      : key === "chatting"
        ? sections.chatting
        : key === "lifestyle"
          ? sections.lifestyle
          : key === "physique"
            ? sections.physique
            : key === "content"
              ? sections.content
              : key === "intimate_details"
                ? sections.intimate_details
                : sections.socials;

  const entries = Object.entries(obj as Record<string, unknown>).filter(([, v]) =>
    isFilledValue(v),
  );
  // Heuristic: ~8 meaningful fields ≈ complete (matches editor)
  return Math.min(1, entries.length / 8);
}

export function visiblePersonaSections(canViewSensitive: boolean): PersonaSectionKey[] {
  return PERSONA_SECTIONS.filter((k) => {
    if (
      (SENSITIVE_PERSONA_SECTIONS as readonly string[]).includes(k)
    ) {
      return canViewSensitive;
    }
    return true;
  });
}

export function overallCompleteness(
  sections: PersonaSectionData,
  liveCount: number,
  canViewSensitive: boolean,
): number {
  const keys = visiblePersonaSections(canViewSensitive);
  if (!keys.length) return 0;
  const sum = keys.reduce(
    (acc, k) => acc + completenessForSection(k, sections, liveCount),
    0,
  );
  return sum / keys.length;
}

export function sectionScoreMap(
  sections: PersonaSectionData,
  liveCount: number,
  canViewSensitive: boolean,
): Record<PersonaSectionKey, number> {
  const out = {} as Record<PersonaSectionKey, number>;
  for (const k of PERSONA_SECTIONS) {
    if (
      (SENSITIVE_PERSONA_SECTIONS as readonly string[]).includes(k) &&
      !canViewSensitive
    ) {
      out[k] = 0;
      continue;
    }
    out[k] = completenessForSection(k, sections, liveCount);
  }
  return out;
}

/** Client-safe 18+ check (mirrors services/model-personas.isPersonaAdult). */
export function isBirthDateAdult(personalInfo: PersonaPersonalInfo | { birth_date?: string }): boolean {
  const bd = personalInfo.birth_date?.trim();
  if (!bd) return false;
  const d = new Date(bd + (bd.length === 10 ? "T00:00:00Z" : ""));
  if (!Number.isFinite(d.getTime())) return false;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age -= 1;
  return age >= 18;
}

export function formatRelativeShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function isUpdatedThisWeek(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < 7 * 24 * 60 * 60 * 1000;
}

export const COMPLETE_THRESHOLD = 0.72;
