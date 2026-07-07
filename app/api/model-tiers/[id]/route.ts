import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { deleteModelTier, updateModelTier, type ModelTierRecord } from "@/services/model-tiers";

function parsePatch(json: unknown): Partial<Omit<ModelTierRecord, "id">> | null {
  if (json == null || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const out: Partial<Omit<ModelTierRecord, "id">> = {};
  if ("model_name" in o && typeof o.model_name === "string") out.model_name = o.model_name;
  if ("tier" in o) out.tier = o.tier === "medium" ? "medium" : o.tier === "low" ? "low" : "high";
  if ("is_active" in o) out.is_active = Boolean(o.is_active);
  if ("sort_order" in o) {
    const s = o.sort_order;
    const n =
      typeof s === "number" && Number.isFinite(s)
        ? s
        : typeof s === "string"? Number.parseInt(s, 10)
          : undefined;
    if (n !== undefined && Number.isFinite(n)) out.sort_order = n;
  }
  return out;
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(user, PERMISSIONS.INFORMATIONS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  if (!id?.trim()) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const patch = parsePatch(body);
  if (!patch || Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields" }, { status: 400 });
  }
  try {
    const updated = await updateModelTier(id.trim(), patch);
    return NextResponse.json(updated);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(user, PERMISSIONS.INFORMATIONS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  if (!id?.trim()) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  try {
    await deleteModelTier(id.trim());
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
