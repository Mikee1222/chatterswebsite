import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createCredentialEntry,
  listCredentialEntries,
  type CredentialEntryInput,
} from "@/services/credential-entries";
import type { CredentialSecretData } from "@/lib/credentials-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function actorFromSession(session: NonNullable<Awaited<ReturnType<typeof getSessionFromCookies>>>) {
  return {
    userId: session.airtableUserId ?? session.id,
    userName: session.fullName?.trim() || session.email?.trim() || "Unknown",
  };
}

/** GET /api/admin/credentials — masked list (no plaintext secrets). */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CREDENTIALS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const entries = await listCredentialEntries();
    return NextResponse.json({ entries });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load credentials";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** POST /api/admin/credentials — create entry (manage permission). */
export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CREDENTIALS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    model_id?: string | null;
    category?: string;
    label?: string;
    data?: CredentialSecretData;
  } | null;

  const input: CredentialEntryInput = {
    model_id: body?.model_id ?? null,
    category: body?.category ?? "",
    label: body?.label ?? "",
    data: body?.data ?? {},
  };

  try {
    const entry = await createCredentialEntry(input, actorFromSession(session));
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
