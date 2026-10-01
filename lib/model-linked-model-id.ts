import { getRecord } from "@/lib/airtable-server";
import { linkedRecordIds, firstLinkedId } from "@/lib/airtable-linked";
import { getUserByAirtableId } from "@/services/users";
import {
  pickActiveModelProfileId,
  readActiveModelProfileCookie,
} from "@/lib/model-active-profile";
import { isSupabaseBackend } from "@/lib/data-backend";
import type { AuthUser } from "@/lib/auth-config";

type UserFields = {
  linked_model?: string | string[];
  linked_model_id?: string | string[];
};

/** Active modelss record id linked to the signed-in model user, or null. */
export async function getLinkedModelRecordIdForModelUser(user: AuthUser): Promise<string | null> {
  const userRecordId = user.airtableUserId ?? user.id;
  try {
    let linkedModelIds: string[] = [];
    let primary: string | null = null;
    if (isSupabaseBackend()) {
      const row = await getUserByAirtableId(userRecordId);
      linkedModelIds = row?.linked_model_ids?.length
        ? row.linked_model_ids
        : row?.linked_model_id
          ? [row.linked_model_id]
          : [];
      primary = row?.linked_model_id ?? linkedModelIds[0] ?? null;
    } else {
      const rec = await getRecord<UserFields>("users", userRecordId);
      const f = rec.fields ?? {};
      linkedModelIds = linkedRecordIds(f.linked_model);
      if (!linkedModelIds.length) {
        const one = firstLinkedId(f.linked_model_id);
        if (one) linkedModelIds = [one];
      }
      primary = linkedModelIds[0] ?? null;
    }
    const cookieId = await readActiveModelProfileCookie();
    return pickActiveModelProfileId(linkedModelIds, primary, cookieId);
  } catch {
    return null;
  }
}
