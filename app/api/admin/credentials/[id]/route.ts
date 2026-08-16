import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  deleteCredentialEntry,
  getCredentialEntryMasked,
  logCredentialViewedMasked,
  updateCredentialEntry,
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

/** GET /api/admin/credentials/[id] — masked single entry. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CREDENTIALS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const entry = await getCredentialEntryMasked(id);
    if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await logCredentialViewedMasked(id, actorFromSession(session));
    return NextResponse.json({ entry });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load credential";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** PUT /api/admin/credentials/[id] */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CREDENTIALS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
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
    const entry = await updateCredentialEntry(id, input, actorFromSession(session));
    return NextResponse.json({ entry });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Update failed";
    const status = msg.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

/** DELETE /api/admin/credentials/[id] */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CREDENTIALS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    await deleteCredentialEntry(id, actorFromSession(session));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
