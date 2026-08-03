import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  deletePaymentMethod,
  updatePaymentMethod,
  type PaymentMethodRow,
} from "@/services/payment-methods";
import type { PaymentMethodRecord } from "@/types/client-portal";

function toRecord(m: PaymentMethodRow): PaymentMethodRecord {
  return {
    id: m.id,
    type: m.type,
    label: m.label,
    details: m.details,
    network: m.network || undefined,
    is_available: m.is_available,
    scope: m.scope,
    client: m.client ?? [],
    open_url: m.open_url || undefined,
    fallback_url: m.fallback_url || undefined,
    beneficiary: m.beneficiary || undefined,
    iban: m.iban || undefined,
    bic: m.bic || undefined,
    wallet_address: m.wallet_address || undefined,
  };
}

type PaymentMethodBody = {
  label?: string;
  type?: string;
  details?: string;
  scope?: string;
  network?: string;
  is_available?: boolean;
  beneficiary?: string;
  iban?: string;
  bic?: string;
  wallet_address?: string;
  open_url?: string;
  fallback_url?: string;
  client?: string[];
};

function buildFields(body: PaymentMethodBody): Partial<PaymentMethodRow> {
  const fields: Partial<PaymentMethodRow> = {};
  if (typeof body.label === "string") fields.label = body.label.trim();
  if (body.type === "Bank" || body.type === "Crypto") fields.type = body.type;
  if (typeof body.details === "string") fields.details = body.details.trim();
  if (typeof body.scope === "string") fields.scope = body.scope.trim();
  if (typeof body.network === "string") fields.network = body.network.trim();
  if (typeof body.is_available === "boolean") fields.is_available = body.is_available;
  if (typeof body.beneficiary === "string") fields.beneficiary = body.beneficiary.trim();
  if (typeof body.iban === "string") fields.iban = body.iban.trim();
  if (typeof body.bic === "string") fields.bic = body.bic.trim();
  if (typeof body.wallet_address === "string") fields.wallet_address = body.wallet_address.trim();
  if (typeof body.open_url === "string") fields.open_url = body.open_url.trim();
  if (typeof body.fallback_url === "string") fields.fallback_url = body.fallback_url.trim();
  if (Array.isArray(body.client)) {
    fields.client = body.client.map((id) => String(id).trim()).filter(Boolean);
  } else if (typeof body.scope === "string" && body.scope.trim() === "global") {
    fields.client = [];
  }
  return fields;
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!(await hasPermission(session, "payments:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let body: PaymentMethodBody;
  try {
    body = (await request.json()) as PaymentMethodBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const fields = buildFields(body);
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  if (body.type === "Crypto") {
    const wallet = typeof body.wallet_address === "string" ? body.wallet_address.trim() : "";
    if (body.wallet_address !== undefined && !wallet) {
      return NextResponse.json({ error: "Wallet address cannot be empty." }, { status: 400 });
    }
  }

  if (body.type === "Bank") {
    const iban = typeof body.iban === "string" ? body.iban.trim() : "";
    if (body.iban !== undefined && !iban) {
      return NextResponse.json({ error: "IBAN cannot be empty." }, { status: 400 });
    }
  }

  if (body.scope === "client") {
    const clientIds = Array.isArray(body.client) ? body.client.filter(Boolean) : [];
    if (clientIds.length === 0) {
      return NextResponse.json({ error: "Select a client for client-specific methods." }, { status: 400 });
    }
  }

  try {
    const updated = await updatePaymentMethod(id, fields);
    return NextResponse.json({ paymentMethod: toRecord(updated) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update payment method.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!(await hasPermission(session, "payments:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    await deletePaymentMethod(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete payment method.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
