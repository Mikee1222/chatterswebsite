import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import {
  createModelTier,
  getAllModelTiers,
  getAllModelTiersAdmin,
  type ModelTierRecord,
} from "@/services/model-tiers";

function isAdminOrManager(role: string | undefined): boolean {
  return role === "admin" || role === "manager";
}

function parseBody(json: unknown): Omit<ModelTierRecord, "id"> | null {
  if (json == null || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const name = typeof o.model_name === "string" ? o.model_name.trim() : "";
  if (!name) return null;
  const tier: ModelTierRecord["tier"] =
    o.tier === "medium" ? "medium" : o.tier === "low" ? "low" : "high";
  const so = o.sort_order;
  const sort_order =
    typeof so === "number" && Number.isFinite(so)
      ? so
      : typeof so === "string"? Number.parseInt(so, 10)
        : 0;
  return {
    model_name: name,
    tier,
    is_active: o.is_active !== false,
    sort_order: Number.isFinite(sort_order) ? sort_order : 0,
  };
}

export async function GET() {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const rows = isAdminOrManager(user.role) ? await getAllModelTiersAdmin() : await getAllModelTiers();
    return NextResponse.json(rows);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load tiers";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminOrManager(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = parseBody(body);
  if (!parsed) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  try {
    const created = await createModelTier(parsed);
    return NextResponse.json(created);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
