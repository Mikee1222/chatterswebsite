import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getCredentialLibraryInsights } from "@/services/credential-entries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/credentials/insights — dashboard stats and security health metadata. */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CREDENTIALS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const insights = await getCredentialLibraryInsights();
    return NextResponse.json({ insights });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load insights";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
