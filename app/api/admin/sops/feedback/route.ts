import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { buildFeedbackSummaries, getFeedbackByRole } from "@/services/sop-feedback";
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

    const [functions, feedbackRows] = await Promise.all([
      getFunctionsByRoleAdmin(role.id),
      getFeedbackByRole(role.id),
    ]);

    const activeFunctions = functions.filter((f) => f.is_active);
    const summaries = buildFeedbackSummaries(
      feedbackRows,
      activeFunctions.map((f) => f.id)
    );

    return NextResponse.json({
      role_id: role.id,
      summaries,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
