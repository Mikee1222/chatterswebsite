import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  listClarioSuiteModelAccounts,
  saveClarioSuiteModelAccounts,
  type ClarioSuiteModelAccountInput,
} from "@/services/clariosuite-model-accounts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/models/[id]/clariosuite-accounts
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.ACCOUNTS_EDIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const accounts = await listClarioSuiteModelAccounts(id);
  return NextResponse.json({ accounts });
}

/**
 * PUT /api/admin/models/[id]/clariosuite-accounts
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.ACCOUNTS_EDIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    accounts?: ClarioSuiteModelAccountInput[];
  } | null;
  const inputs = Array.isArray(body?.accounts) ? body!.accounts : [];

  try {
    const accounts = await saveClarioSuiteModelAccounts(id, inputs);
    return NextResponse.json({ accounts });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
