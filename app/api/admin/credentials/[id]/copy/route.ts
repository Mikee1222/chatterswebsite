import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { parseCredentialFieldRef } from "@/lib/credentials-types";
import { copyCredentialField } from "@/services/credential-entries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function actorFromSession(session: NonNullable<Awaited<ReturnType<typeof getSessionFromCookies>>>) {
  return {
    userId: session.airtableUserId ?? session.id,
    userName: session.fullName?.trim() || session.email?.trim() || "Unknown",
  };
}

/** POST /api/admin/credentials/[id]/copy — decrypt one field for clipboard (logged). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CREDENTIALS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { field?: string } | null;
  const field = parseCredentialFieldRef(body?.field);
  if (!field) return NextResponse.json({ error: "Invalid field" }, { status: 400 });

  try {
    const result = await copyCredentialField(id, field, actorFromSession(session));
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Copy failed";
    const status = msg.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
