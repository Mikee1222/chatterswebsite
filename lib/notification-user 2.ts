import type { SessionUser } from "@/types";

/**
 * Resolve the canonical user id used by notifications + push subscriptions.
 * Airtable-linked record id is preferred; falls back to session id when missing.
 */
export function getNotificationUserId(user: SessionUser | null | undefined): string | null {
  if (!user) return null;
  const airtableId = user.airtableUserId?.trim();
  if (airtableId) return airtableId;
  const sessionId = user.id?.trim();
  if (sessionId) return sessionId;
  return null;
}
