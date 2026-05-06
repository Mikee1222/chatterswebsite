import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getUserByAirtableId } from "@/services/users";
import { getModelById } from "@/services/modelss";
import type { ModelRecord } from "@/types";

export type ModelApiContext =
  | { ok: true; userRecordId: string; linkedModelId: string; modelRecord: ModelRecord }
  | { ok: false; response: NextResponse };

/**
 * Session cookie → user exists in Airtable, role is model, linked modelss row resolved.
 * Same resolution pattern as `app/api/infloww/model-week-earnings/route.ts` and model server actions.
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
  const linkedModelId = user.linked_model_id?.trim() ?? null;
  if (!linkedModelId) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const modelRecord = await getModelById(linkedModelId);
  if (!modelRecord) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, userRecordId, linkedModelId, modelRecord };
}
