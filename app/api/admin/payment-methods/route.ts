import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { createRecord, listAllRecords, type AirtableRecord } from "@/lib/airtable-server";
import { linkedRecordIds } from "@/lib/airtable-linked";
import type { PaymentMethodRecord } from "@/types/client-portal";

function isAdminOrManager(session: { role: string } | null): boolean {
  return session != null && (session.role === "admin" || session.role === "manager");
}

function mapPaymentMethod(rec: AirtableRecord<Record<string, unknown>>): PaymentMethodRecord {
  const f = rec.fields;
  return {
    id: rec.id,
    type: String(f.type ?? ""),
    label: String(f.label ?? ""),
    details: String(f.details ?? ""),
    network: typeof f.network === "string" ? f.network : undefined,
    is_available: Boolean(f.is_available),
    scope: String(f.scope ?? ""),
    client: linkedRecordIds(f.client),
    open_url: typeof f.open_url === "string" ? f.open_url : undefined,
    fallback_url: typeof f.fallback_url === "string" ? f.fallback_url : undefined,
    beneficiary: typeof f.beneficiary === "string" ? f.beneficiary : undefined,
    iban: typeof f.iban === "string" ? f.iban : undefined,
    bic: typeof f.bic === "string" ? f.bic : undefined,
    wallet_address: typeof f.wallet_address === "string" ? f.wallet_address : undefined,
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

function buildFields(body: PaymentMethodBody): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

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

  if (body.scope === "global") {
    fields.client = [];
  } else if (Array.isArray(body.client)) {
    fields.client = body.client.filter((id) => typeof id === "string" && id.trim());
  }

  return fields;
}

function validateCreate(body: PaymentMethodBody): string | null {
  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label) return "Label is required.";

  if (body.type !== "Bank" && body.type !== "Crypto") return "Type must be Bank or Crypto.";

  const scope = typeof body.scope === "string" ? body.scope.trim() : "";
  if (scope !== "global" && scope !== "client") return "Scope must be global or client.";

  if (scope === "client") {
    const clientIds = Array.isArray(body.client) ? body.client.filter(Boolean) : [];
    if (clientIds.length === 0) return "Select a client for client-specific methods.";
  }

  if (body.type === "Crypto") {
    const wallet = typeof body.wallet_address === "string" ? body.wallet_address.trim() : "";
    if (!wallet) return "Wallet address is required for crypto methods.";
  }

  if (body.type === "Bank") {
    const iban = typeof body.iban === "string" ? body.iban.trim() : "";
    if (!iban) return "IBAN is required for bank methods.";
  }

  return null;
}

export async function GET() {
  const session = await getSessionFromCookies();
  if (!isAdminOrManager(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const records = await listAllRecords<Record<string, unknown>>("payment_methods", {
      _caller: "admin/payment-methods:GET",
    });
    return NextResponse.json({ paymentMethods: records.map(mapPaymentMethod) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list payment methods.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!isAdminOrManager(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: PaymentMethodBody;
  try {
    body = (await request.json()) as PaymentMethodBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validationError = validateCreate(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const fields = buildFields({
    ...body,
    is_available: body.is_available ?? true,
  });

  try {
    const created = await createRecord<Record<string, unknown>>("payment_methods", fields);
    return NextResponse.json({ paymentMethod: mapPaymentMethod(created) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create payment method.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
