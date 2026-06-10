import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { listAllUsers } from "@/services/users";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "sops:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const users = await listAllUsers();
    const pick = users
      .filter((u) => (u.status ?? "").toLowerCase() !== "inactive")
      .map((u) => ({
        id: u.id,
        name: (u.full_name ?? "").trim() || u.email || u.id,
        role: u.role,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ users: pick });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
