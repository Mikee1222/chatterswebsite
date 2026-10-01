import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getUserByAirtableId } from "@/services/users";
import { getModelById } from "@/services/modelss";
import {
  pickActiveModelProfileId,
  readActiveModelProfileCookie,
} from "@/lib/model-active-profile";
import type { ModelRecord } from "@/types";

export type ModelApiContext =
  | {
      ok: true;
      userRecordId: string;
      linkedModelId: string;
      linkedModelIds: string[];
      modelRecord: ModelRecord;
    }
  | { ok: false; response: NextResponse };

/**
 * Session cookie → user exists, role is model, active linked modelss row resolved
 * (cookie / primary / first among linked_model_ids).
 */
export async function requireModelApiContext(): Promise<ModelApiContext> {
  const session = await getSessionFromCookies();
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.role !== "model") {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const userRecordId = (session.airtableUserId ?? session.id)?.trim();
  if (!userRecordId) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const user = await getUserByAirtableId(userRecordId);
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const linkedModelIds = (
    user.linked_model_ids?.length
      ? user.linked_model_ids
      : user.linked_model_id
        ? [user.linked_model_id]
        : []
  )
    .map((id) => id.trim())
    .filter(Boolean);
  const cookieId = await readActiveModelProfileCookie();
  const linkedModelId = pickActiveModelProfileId(
    linkedModelIds,
    user.linked_model_id ?? null,
    cookieId
  );
  if (!linkedModelId) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const modelRecord = await getModelById(linkedModelId);
  if (!modelRecord) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, userRecordId, linkedModelId, linkedModelIds, modelRecord };
}
