import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission, isSystemAdmin } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { createAgentToken, listAgentTokens } from "@/services/agent-tokens";

async function requireOwnerAdmin() {
  const session = await getSessionFromCookies();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!isSystemAdmin(session) || !(await hasPermission(session, PERMISSIONS.ROLES_MANAGE))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const gate = await requireOwnerAdmin();
  if ("error" in gate && gate.error) return gate.error;

  try {
    const tokens = await listAgentTokens({ includeRevoked: true });
    return NextResponse.json({
      tokens: tokens.map((t) => ({
        id: t.id,
        user_id: t.user_id,
        token_prefix: t.token_prefix,
        label: t.label,
        created_by: t.created_by,
        created_at: t.created_at,
        expires_at: t.expires_at,
        revoked_at: t.revoked_at,
        last_used_at: t.last_used_at,
        status: t.revoked_at
          ? "revoked"
          : Date.parse(t.expires_at) <= Date.now()
            ? "expired"
            : "active",
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to list tokens";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const gate = await requireOwnerAdmin();
  if ("error" in gate && gate.error) return gate.error;
  const session = gate.session!;

  let body: { user_email?: string; label?: string };
  try {
    body = (await req.json()) as { user_email?: string; label?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const user_email = String(body.user_email ?? "").trim().toLowerCase();
  if (!user_email) {
    return NextResponse.json({ error: "user_email required" }, { status: 400 });
  }

  try {
    const { token, row } = await createAgentToken({
      userEmail: user_email,
      label: body.label?.trim() || null,
      createdBy: session.email,
    });
    return NextResponse.json({
      token,
      warning: "Copy this token now. It will not be shown again.",
      row: {
        id: row.id,
        token_prefix: row.token_prefix,
        label: row.label,
        created_at: row.created_at,
        expires_at: row.expires_at,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create token";
    const status = msg.includes("is_agent") || msg.includes("No user") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
