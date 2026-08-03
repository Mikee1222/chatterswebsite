/**
 * Dual-backend payment_methods reader/writer.
 */
import { isSupabaseBackend } from "@/lib/data-backend";
import {
  createRecord,
  deleteRecord,
  getRecord,
  listAllRecords,
  updateRecord,
} from "@/lib/airtable-server";
import { linkedRecordIds } from "@/lib/airtable-linked";
import {
  mapLinkedIds,
  publicId,
  requireSbUuidsOrEmpty,
  sbDeleteByPublicId,
  sbInsert,
  sbResolveUuidToAirtableMap,
  sbSelectAll,
  sbSelectByPublicId,
  sbUpdateByPublicId,
  type SbRow,
} from "@/lib/supabase-data";

const TABLE = "payment_methods";

export type PaymentMethodRow = {
  id: string;
  label: string;
  type: string;
  details: string;
  scope: string;
  network: string;
  is_available: boolean;
  open_url: string;
  fallback_url: string;
  beneficiary: string;
  iban: string;
  bic: string;
  wallet_address: string;
  /** Linked client public ids (Airtable-shaped during dual-run). */
  client: string[];
};

type Row = SbRow & {
  label?: string | null;
  type?: string | null;
  details?: string | null;
  scope?: string | null;
  network?: string | null;
  is_available?: boolean | null;
  open_url?: string | null;
  fallback_url?: string | null;
  beneficiary?: string | null;
  iban?: string | null;
  bic?: string | null;
  wallet_address?: string | null;
  client?: string[] | null;
};

function mapAirtable(rec: { id: string; fields: Record<string, unknown> }): PaymentMethodRow {
  return {
    id: rec.id,
    label: String(rec.fields.label ?? ""),
    type: String(rec.fields.type ?? ""),
    details: String(rec.fields.details ?? ""),
    scope: String(rec.fields.scope ?? ""),
    network: String(rec.fields.network ?? ""),
    is_available: rec.fields.is_available !== false,
    open_url: String(rec.fields.open_url ?? ""),
    fallback_url: String(rec.fields.fallback_url ?? ""),
    beneficiary: String(rec.fields.beneficiary ?? ""),
    iban: String(rec.fields.iban ?? ""),
    bic: String(rec.fields.bic ?? ""),
    wallet_address: String(rec.fields.wallet_address ?? ""),
    client: linkedRecordIds(rec.fields.client),
  };
}

function mapRowSync(row: Row, clientAtByUuid: Map<string, string>): PaymentMethodRow {
  return {
    id: publicId(row),
    label: row.label ?? "",
    type: row.type ?? "",
    details: row.details ?? "",
    scope: row.scope ?? "",
    network: row.network ?? "",
    is_available: row.is_available !== false,
    open_url: row.open_url ?? "",
    fallback_url: row.fallback_url ?? "",
    beneficiary: row.beneficiary ?? "",
    iban: row.iban ?? "",
    bic: row.bic ?? "",
    wallet_address: row.wallet_address ?? "",
    client: mapLinkedIds(row.client, clientAtByUuid),
  };
}

async function mapRows(rows: Row[]): Promise<PaymentMethodRow[]> {
  if (!rows.length) return [];
  const clientAtByUuid = await sbResolveUuidToAirtableMap(
    "clients",
    rows.map((r) => r.client)
  );
  return rows.map((r) => mapRowSync(r, clientAtByUuid));
}

async function resolveClientLinks(clientIds: string[] | undefined, scope: string): Promise<string[]> {
  const ids = (clientIds ?? []).map((id) => String(id).trim()).filter(Boolean);
  if (scope === "client") {
    if (!ids.length) {
      throw new Error("Select a client for client-specific methods.");
    }
    const uuids = await requireSbUuidsOrEmpty("clients", ids, "client");
    if (uuids.length === 0) {
      throw new Error("requireSbUuids clients: unresolved client id(s)");
    }
    return uuids;
  }
  // global (or other): allow empty; if ids provided still resolve fully or throw
  return requireSbUuidsOrEmpty("clients", ids, "client");
}

export async function getPaymentMethodById(id: string): Promise<PaymentMethodRow | null> {
  if (isSupabaseBackend()) {
    const row = await sbSelectByPublicId<Row>(TABLE, id);
    if (!row) return null;
    const [mapped] = await mapRows([row]);
    return mapped ?? null;
  }
  try {
    const rec = await getRecord<Record<string, unknown>>(TABLE, id);
    return mapAirtable(rec);
  } catch {
    return null;
  }
}

export async function listAllPaymentMethods(): Promise<PaymentMethodRow[]> {
  if (isSupabaseBackend()) {
    const rows = await sbSelectAll<Row>(TABLE);
    return mapRows(rows);
  }
  const records = await listAllRecords<Record<string, unknown>>(TABLE);
  return records.map(mapAirtable);
}

export async function createPaymentMethod(
  fields: Partial<PaymentMethodRow>
): Promise<PaymentMethodRow> {
  if (isSupabaseBackend()) {
    const scope = fields.scope ?? "";
    const client = await resolveClientLinks(fields.client, scope);
    const row = await sbInsert<Row>(TABLE, {
      label: fields.label ?? "",
      type: fields.type ?? "",
      details: fields.details ?? "",
      scope,
      network: fields.network ?? "",
      is_available: fields.is_available ?? true,
      open_url: fields.open_url ?? "",
      fallback_url: fields.fallback_url ?? "",
      beneficiary: fields.beneficiary ?? "",
      iban: fields.iban ?? "",
      bic: fields.bic ?? "",
      wallet_address: fields.wallet_address ?? "",
      client,
    });
    const [mapped] = await mapRows([row]);
    return mapped!;
  }
  const payload: Record<string, unknown> = {
    label: fields.label ?? "",
    type: fields.type ?? "",
    details: fields.details ?? "",
    scope: fields.scope ?? "",
    network: fields.network ?? "",
    is_available: fields.is_available ?? true,
    open_url: fields.open_url ?? "",
    fallback_url: fields.fallback_url ?? "",
    beneficiary: fields.beneficiary ?? "",
    iban: fields.iban ?? "",
    bic: fields.bic ?? "",
    wallet_address: fields.wallet_address ?? "",
  };
  if (fields.client !== undefined) payload.client = fields.client;
  const rec = await createRecord(TABLE, payload);
  return (await getPaymentMethodById(rec.id))!;
}

export async function updatePaymentMethod(
  id: string,
  fields: Partial<PaymentMethodRow>
): Promise<PaymentMethodRow> {
  if (isSupabaseBackend()) {
    const patch: Record<string, unknown> = {};
    if (fields.label !== undefined) patch.label = fields.label;
    if (fields.type !== undefined) patch.type = fields.type;
    if (fields.details !== undefined) patch.details = fields.details;
    if (fields.scope !== undefined) patch.scope = fields.scope;
    if (fields.network !== undefined) patch.network = fields.network;
    if (fields.is_available !== undefined) patch.is_available = fields.is_available;
    if (fields.open_url !== undefined) patch.open_url = fields.open_url;
    if (fields.fallback_url !== undefined) patch.fallback_url = fields.fallback_url;
    if (fields.beneficiary !== undefined) patch.beneficiary = fields.beneficiary;
    if (fields.iban !== undefined) patch.iban = fields.iban;
    if (fields.bic !== undefined) patch.bic = fields.bic;
    if (fields.wallet_address !== undefined) patch.wallet_address = fields.wallet_address;
    if (fields.client !== undefined || fields.scope !== undefined) {
      const existing = await sbSelectByPublicId<Row>(TABLE, id);
      const scope = fields.scope ?? existing?.scope ?? "";
      const clientIds = fields.client ?? [];
      patch.client = await resolveClientLinks(clientIds, scope);
    }
    const row = await sbUpdateByPublicId<Row>(TABLE, id, patch);
    const [mapped] = await mapRows([row]);
    return mapped!;
  }
  const payload: Record<string, unknown> = { ...fields };
  await updateRecord(TABLE, id, payload);
  return (await getPaymentMethodById(id))!;
}

export async function deletePaymentMethod(id: string): Promise<void> {
  if (isSupabaseBackend()) {
    await sbDeleteByPublicId(TABLE, id);
    return;
  }
  await deleteRecord(TABLE, id);
}
