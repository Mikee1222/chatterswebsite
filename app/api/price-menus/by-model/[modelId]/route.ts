import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getMenuForModel } from "@/services/price-menus";

/** Read-only: chatter/VA lookup of a model's linked price menu. */
export async function GET(_req: Request, ctx: { params: Promise<{ modelId: string }> }) {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(user, PERMISSIONS.INFORMATIONS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Writes are never exposed here — manage routes are separate.
  const { modelId } = await ctx.params;
  if (!modelId?.trim()) return NextResponse.json({ error: "Missing modelId" }, { status: 400 });
  try {
    const result = await getMenuForModel(modelId.trim());
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
