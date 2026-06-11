import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { declareWinner } from "@/services/link-ab-testing";
import type { LinkPageAbVariant } from "@/types";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.LINK_PAGES_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = (await request.json()) as { winner?: string };

  if (body.winner !== "a" && body.winner !== "b") {
    return NextResponse.json({ error: "winner must be 'a' or 'b'" }, { status: 400 });
  }

  try {
    const page = await declareWinner(id, body.winner as LinkPageAbVariant);
    revalidatePath(`/l/${page.slug}`);
    return NextResponse.json({ page });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to declare winner";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
