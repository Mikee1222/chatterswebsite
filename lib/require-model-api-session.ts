import { getSessionFromCookies } from "@/lib/auth";
import { getUserByAirtableId } from "@/services/users";
import {
  pickActiveModelProfileId,
  readActiveModelProfileCookie,
} from "@/lib/model-active-profile";

/** Active modelss id for the signed-in model user only (API routes). */
export async function requireModelLinkedModelId(): Promise<
  { ok: true; modelId: string; linkedModelIds: string[] } | { ok: false; status: number; error: string }
> {
  const session = await getSessionFromCookies();
  if (!session) return { ok: false, status: 401, error: "Not signed in." };
  if (session.role !== "model") return { ok: false, status: 403, error: "Model role required." };
  const recordId = (session.airtableUserId ?? session.id)?.trim();
  if (!recordId) return { ok: false, status: 401, error: "Missing user record id." };
  const row = await getUserByAirtableId(recordId);
  const linkedModelIds = (
    row?.linked_model_ids?.length
      ? row.linked_model_ids
      : row?.linked_model_id
        ? [row.linked_model_id]
        : []
  )
    .map((id) => id.trim())
    .filter(Boolean);
  const cookieId = await readActiveModelProfileCookie();
  const linked = pickActiveModelProfileId(
    linkedModelIds,
    row?.linked_model_id ?? null,
    cookieId
  );
  if (!linked) return { ok: false, status: 400, error: "No model profile linked." };
  return { ok: true, modelId: linked, linkedModelIds };
}
