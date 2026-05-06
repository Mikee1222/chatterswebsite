import { getRecord } from "@/lib/airtable-server";
import { firstLinkedId } from "@/lib/airtable-linked";
import type { AuthUser } from "@/lib/auth-config";

type UserFields = {
  linked_model?: string | string[];
  linked_model_id?: string | string[];
};

/** Airtable `modelss` record id linked to the signed-in model user, or null. */
export async function getLinkedModelRecordIdForModelUser(user: AuthUser): Promise<string | null> {
  const userRecordId = user.airtableUserId ?? user.id;
  try {
    const rec = await getRecord<UserFields>("users", userRecordId);
    const f = rec.fields ?? {};
    return firstLinkedId(f.linked_model) ?? firstLinkedId(f.linked_model_id) ?? null;
  } catch {
    return null;
  }
}
