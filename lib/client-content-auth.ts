import { getSessionFromCookies } from "@/lib/auth";
import { getClientAirtableId } from "@/lib/client-session";
import { getClientModels } from "@/services/client-portal";

/** True when `modelRecordId` (modelss Airtable id) is linked to the client via `client_models`. */
export async function verifyClientOwnsModel(
  clientId: string,
  modelRecordId: string,
): Promise<boolean> {
  const id = modelRecordId?.trim();
  if (!clientId?.trim() || !id) return false;
  const assignments = await getClientModels(clientId);
  return assignments.some((row) => row.model.includes(id));
}

export type ClientModelAccessResult =
  | { ok: true; clientId: string; actorUserId: string; actorName: string }
  | { ok: false; status: 401 | 403; error: string };

/** Authenticated client session + ownership check for a modelss record id. */
export async function requireClientModelAccess(
  modelRecordId: string,
): Promise<ClientModelAccessResult> {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "client") {
    return { ok: false, status: 401, error: "Unauthorized." };
  }

  const clientId = getClientAirtableId(session);
  const owns = await verifyClientOwnsModel(clientId, modelRecordId);
  if (!owns) {
    return { ok: false, status: 403, error: "Model not found or access denied." };
  }

  return {
    ok: true,
    clientId,
    actorUserId: session.airtableUserId ?? session.id,
    actorName: session.fullName?.trim() || session.email || "Client",
  };
}
