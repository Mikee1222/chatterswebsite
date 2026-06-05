import type { AuthUser } from "@/lib/auth-config";

/** Client portal Airtable record id from session (clients table). */
export function getClientAirtableId(user: AuthUser): string {
  return user.airtableUserId ?? user.id;
}
