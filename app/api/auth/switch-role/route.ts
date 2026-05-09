import { NextResponse } from "next/server";
import { getSessionFromCookies, updateSessionCookie } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth-config";
import type { StaffPairRole } from "@/lib/staff-session-role";

function normalizeTargetRole(raw: unknown): StaffPairRole | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "chatter") return "chatter";
  if (s === "va" || s === "virtual_assistant") return "virtual_assistant";
  return null;
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!session.secondary_role) {
    return NextResponse.json({ error: "No secondary role" }, { status: 403 });
  }

  let body: { target_role?: unknown };
  try {
    body = (await req.json()) as { target_role?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const target_role = normalizeTargetRole(body.target_role);
  if (!target_role) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const primary =
    session.role === "chatter" || session.role === "virtual_assistant" ? session.role : null;
  const secondary = session.secondary_role;
  const allowed = new Set<StaffPairRole>();
  if (primary) allowed.add(primary);
  if (secondary) allowed.add(secondary);
  if (!allowed.has(target_role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const next: AuthUser = {
    ...session,
    active_role: target_role,
  };
  await updateSessionCookie(next);

  return NextResponse.json({ success: true, active_role: target_role });
}
