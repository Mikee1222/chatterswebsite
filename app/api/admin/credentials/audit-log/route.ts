import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { listCredentialAccessLog } from "@/services/credential-entries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/credentials/audit-log */
export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CREDENTIALS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const credentialId = url.searchParams.get("credential_id")?.trim() || undefined;
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;

  try {
    const logs = await listCredentialAccessLog({ credentialId, limit });
    return NextResponse.json({ logs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load audit log";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
