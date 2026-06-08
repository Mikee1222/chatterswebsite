import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import {
  buildProgressUserSummaries,
  getProgressByRole,
} from "@/services/sop-progress";
import { getFunctionsByRoleAdmin, getSopRoleById } from "@/services/sops";
import { listAllUsers } from "@/services/users";

function isStaffAdmin(session: { role: string } | null): boolean {
  return session != null && (session.role === "admin" || session.role === "manager");
}

const querySchema = z.object({
  role_id: z.string().trim().min(1),
});

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!isStaffAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    role_id: url.searchParams.get("role_id") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "role_id is required" }, { status: 400 });
  }

  try {
    const role = await getSopRoleById(parsed.data.role_id);
    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    const [functions, progress, users] = await Promise.all([
      getFunctionsByRoleAdmin(role.id),
      getProgressByRole(role.id),
      listAllUsers(),
    ]);

    const activeFunctions = functions.filter((f) => f.is_active);
    const userNames = new Map(
      users.map((u) => [
        u.id,
        (u.full_name ?? "").trim() || u.email || u.id,
      ])
    );

    const summaries = buildProgressUserSummaries(
      progress.by_user,
      activeFunctions.length,
      userNames
    );

    return NextResponse.json({
      role,
      academy_mode: role.academy_mode,
      total_functions: activeFunctions.length,
      users: summaries,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
