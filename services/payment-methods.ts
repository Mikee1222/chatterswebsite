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
import {
  publicId,
  sbDeleteByPublicId,
  sbInsert,
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
};

function mapRow(row: Row): PaymentMethodRow {
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
  };
}

export async function getPaymentMethodById(id: string): Promise<PaymentMethodRow | null> {
  if (isSupabaseBackend()) {
    const row = await sbSelectByPublicId<Row>(TABLE, id);
    return row ? mapRow(row) : null;
  }
  try {
    const rec = await getRecord<Record<string, unknown>>(TABLE, id);
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
    };
  } catch {
    return null;
  }
}

export async function listAllPaymentMethods(): Promise<PaymentMethodRow[]> {
  if (isSupabaseBackend()) {
    const rows = await sbSelectAll<Row>(TABLE);
    return rows.map(mapRow);
  }
  const records = await listAllRecords<Record<string, unknown>>(TABLE);
  return records.map((rec) => ({
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
  }));
}

export async function createPaymentMethod(
  fields: Partial<PaymentMethodRow>
): Promise<PaymentMethodRow> {
  if (isSupabaseBackend()) {
    const row = await sbInsert<Row>(TABLE, {
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
    });
    return mapRow(row);
  }
  const rec = await createRecord(TABLE, fields as Record<string, unknown>);
  return (await getPaymentMethodById(rec.id))!;
}

export async function updatePaymentMethod(
  id: string,
  fields: Partial<PaymentMethodRow>
): Promise<PaymentMethodRow> {
  if (isSupabaseBackend()) {
    const row = await sbUpdateByPublicId<Row>(TABLE, id, fields as Record<string, unknown>);
    return mapRow(row);
  }
  await updateRecord(TABLE, id, fields as Record<string, unknown>);
  return (await getPaymentMethodById(id))!;
}

export async function deletePaymentMethod(id: string): Promise<void> {
  if (isSupabaseBackend()) {
    await sbDeleteByPublicId(TABLE, id);
    return;
  }
  await deleteRecord(TABLE, id);
}
