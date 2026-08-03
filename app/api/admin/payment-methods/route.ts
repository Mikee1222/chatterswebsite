import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  createPaymentMethod,
  listAllPaymentMethods,
} from "@/services/payment-methods";
import type { PaymentMethodRecord } from "@/types/client-portal";

function toRecord(m: Awaited<ReturnType<typeof listAllPaymentMethods>>[number]): PaymentMethodRecord {
  return {
    id: m.id,
    type: m.type,
    label: m.label,
    details: m.details,
    network: m.network || undefined,
    is_available: m.is_available,
    scope: m.scope,
    client: [],
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
  if (!(await hasPermission(session, "payments:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const methods = await listAllPaymentMethods();
    return NextResponse.json({ paymentMethods: methods.map(toRecord) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list payment methods.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!(await hasPermission(session, "payments:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

  try {
    const created = await createPaymentMethod({
      label: body.label?.trim() ?? "",
      type: body.type ?? "",
      details: body.details?.trim() ?? "",
      scope: body.scope?.trim() ?? "",
      network: body.network?.trim() ?? "",
      is_available: body.is_available ?? true,
      beneficiary: body.beneficiary?.trim() ?? "",
      iban: body.iban?.trim() ?? "",
      bic: body.bic?.trim() ?? "",
      wallet_address: body.wallet_address?.trim() ?? "",
      open_url: body.open_url?.trim() ?? "",
      fallback_url: body.fallback_url?.trim() ?? "",
    });
    return NextResponse.json({ paymentMethod: toRecord(created) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create payment method.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
