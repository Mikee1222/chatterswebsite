import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasAnyPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { createBunchForCycle } from "@/services/content-cycles";
import { coerceBunchKind } from "@/lib/winner-sourcing-helpers";

type Ctx = { params: Promise<{ id: string }> };

/** Create a missing Proven / Experimental bunch for a cycle (after delete). */
export async function POST(req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    !(await hasAnyPermission(session, [
      PERMISSIONS.WINNER_SOURCING_MANAGE,
      PERMISSIONS.CONTENT_CYCLES_MANAGE,
    ]))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { kind?: string };
  const rawKind = String(body.kind ?? "").trim();
  if (rawKind !== "proven" && rawKind !== "experimental") {
    return NextResponse.json({ error: "kind must be proven or experimental" }, { status: 400 });
  }
  const kind = coerceBunchKind(rawKind);
  try {
    const cycle = await createBunchForCycle({
      cycle_id: id,
      kind,
      actor_id: session.airtableUserId ?? session.id,
      actor_name: (session.fullName || session.email || "").trim(),
    });
    return NextResponse.json({ cycle });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
