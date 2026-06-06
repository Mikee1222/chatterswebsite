import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { deleteMassList, updateMassList, type MassListRecord } from "@/services/mass-lists";

function isAdminOrManager(role: string | undefined): boolean {
  return role === "admin" || role === "manager";
}

function parseUpdateBody(json: unknown): Partial<Omit<MassListRecord, "id">> | null {
  if (json == null || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const out: Partial<Omit<MassListRecord, "id">> = {};
  if ("emoji" in o && typeof o.emoji === "string") out.emoji = o.emoji;
  if ("name" in o && typeof o.name === "string") out.name = o.name;
  if ("type" in o) out.type = o.type === "exclude" ? "exclude" : "include";
  if ("description" in o && typeof o.description === "string") out.description = o.description;
  if ("is_different_mass" in o) out.is_different_mass = Boolean(o.is_different_mass);
  if ("applies_to_all_models" in o) out.applies_to_all_models = Boolean(o.applies_to_all_models);
  if ("model_names" in o && typeof o.model_names === "string") out.model_names = o.model_names;
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
  if ("created_at" in o && typeof o.created_at === "string") out.created_at = o.created_at;
  return out;
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromCookies();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminOrManager(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const patch = parseUpdateBody(body);
  if (!patch || Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }
  try {
    const updated = await updateMassList(id.trim(), patch);
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromCookies();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminOrManager(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  try {
    await deleteMassList(id.trim());
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
