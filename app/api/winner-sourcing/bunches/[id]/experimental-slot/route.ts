import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { coerceSlotOrigin, coerceSlotVideoType } from "@/lib/winner-sourcing-helpers";
import { createExperimentalSlot } from "@/services/winner-sourcing";

/** POST { description, video_link?, origin, video_type?, video_type_other? } — Head of Marketing adds an idea. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed =
    (await hasPermission(session, PERMISSIONS.EXPERIMENTAL_BUNCH_MANAGE)) ||
    (await hasPermission(session, PERMISSIONS.WINNER_SOURCING_MANAGE));
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const slot = await createExperimentalSlot({
      bunch_id: id,
      description: String(body.description ?? ""),
      video_link: String(body.video_link ?? ""),
      origin: coerceSlotOrigin(body.origin) || "own_idea",
      video_type: body.video_type ? coerceSlotVideoType(body.video_type) : "",
      video_type_other: String(body.video_type_other ?? ""),
      admin_instructions: String(body.admin_instructions ?? ""),
    });
    return NextResponse.json({ slot });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
