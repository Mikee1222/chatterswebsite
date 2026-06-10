import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  buildQuizInsightsByFunction,
  getAttemptsByRole,
} from "@/services/sop-quiz-attempts";
import { getFunctionsByRoleAdmin, getSopRoleById } from "@/services/sops";

const querySchema = z.object({
  role_id: z.string().trim().min(1),
});

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "sops:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

    const [functions, attempts] = await Promise.all([
      getFunctionsByRoleAdmin(role.id),
      getAttemptsByRole(role.id),
    ]);

    const insights = buildQuizInsightsByFunction(attempts, functions);

    return NextResponse.json({
      role_id: role.id,
      academy_mode: role.academy_mode,
      insights,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
