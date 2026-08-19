/**
 * Supabase sync for Infloww monthly billing data.
 * Agency-level endpoint — one set of records, not per-creator.
 * STRICT 10 QPM rate limit: call once daily, never multiple times per day.
 */

import { fetchMonthlyBilling, InflowwApiError, logInflowwFailure } from "@/lib/infloww-api";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import type { InflowwMonthlyBillingRow } from "@/types/infloww";

export type { InflowwMonthlyBillingRow };

export interface InflowwMonthlyBillingSyncResult {
  upserted: number;
  errors: string[];
}

/**
 * Sync monthly billing records for the given year-month range.
 * startTime / endTime are yyyy-MM strings (e.g. "2026-01").
 * Max 12-month range per call (Infloww limit).
 *
 * IMPORTANT: Do NOT call more than once per day — 10 QPM strict rate limit.
 */
export async function syncInflowwMonthlyBilling(params: {
  startTime: string;
  endTime: string;
}): Promise<InflowwMonthlyBillingSyncResult> {
  const errors: string[] = [];
  let upserted = 0;

  let rows: InflowwMonthlyBillingRow[] = [];
  try {
    rows = await fetchMonthlyBilling(params);
  } catch (e) {
    logInflowwFailure("syncInflowwMonthlyBilling/fetch", e);
    errors.push(e instanceof Error ? e.message : String(e));
    return { upserted, errors };
  }

  if (rows.length === 0) {
    return { upserted: 0, errors };
  }

  const supabase = getSupabaseServiceClient();
  const records = rows.map((r) => ({
    billing_id: r.billingId,
    invoice_id: r.invoiceId ?? null,
    billing_period: r.billingPeriod,
    currency: r.currency,
    subscription: r.subscription,
    discount: r.discount,
    igic: r.igic,
    total: r.total,
    deductions: r.deductions,
    balance_due: r.balanceDue,
    paid: r.paid,
    pending: r.pending,
    synced_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("infloww_monthly_billing")
    .upsert(records, { onConflict: "billing_id" });

  if (error) {
    errors.push(`Supabase upsert: ${error.message}`);
  } else {
    upserted = records.length;
  }

  return { upserted, errors };
}

/**
 * Fetch all billing rows from Supabase (most recent periods first).
 */
export async function getInflowwMonthlyBilling(): Promise<InflowwMonthlyBillingRow[]> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("infloww_monthly_billing")
    .select("*")
    .order("billing_period", { ascending: false });

  if (error) throw new Error(`infloww_monthly_billing fetch: ${error.message}`);

  return (data ?? []).map((r) => ({
    billingId: r.billing_id as string,
    invoiceId: r.invoice_id ?? undefined,
    billingPeriod: r.billing_period as string,
    currency: r.currency as string,
    subscription: Number(r.subscription),
    discount: Number(r.discount),
    igic: Number(r.igic),
    total: Number(r.total),
    deductions: Number(r.deductions),
    balanceDue: Number(r.balance_due),
    paid: Number(r.paid),
    pending: Number(r.pending),
  }));
}
