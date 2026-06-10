import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  createPricingRow,
  createPricingSpecial,
  getAllPricingRows,
  getAllPricingRowsAdmin,
  getAllPricingSpecials,
  getAllPricingSpecialsAdmin,
  type PricingRow,
  type PricingSpecial,
} from "@/services/pricing";
import type { ModelTier } from "@/services/model-tiers";
import type { SpenderTier } from "@/services/pricing";

function coerceMt(v: unknown): ModelTier {
  if (v === "medium") return "medium";
  if (v === "low") return "low";
  return "high";
}

function coerceSt(v: unknown): SpenderTier {
  if (v === "medium_low") return "medium_low";
  if (v === "medium") return "medium";
  if (v === "low") return "low";
  return "high";
}

function num(v: unknown, d = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : d;
  }
  return d;
}

function parseRowCreate(json: unknown): Omit<PricingRow, "id"> | null {
  if (json == null || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  return {
    model_tier: coerceMt(o.model_tier),
    spender_tier: coerceSt(o.spender_tier),
    video_number: num(o.video_number),
    price_normal: String(o.price_normal ?? ""),
    price_negotiation: String(o.price_negotiation ?? ""),
    description: String(o.description ?? ""),
    notes: String(o.notes ?? ""),
    is_active: o.is_active !== false,
    sort_order: num(o.sort_order),
  };
}

function parseSpecialCreate(json: unknown): Omit<PricingSpecial, "id"> | null {
  if (json == null || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const label = String(o.label ?? "").trim();
  if (!label) return null;
  return {
    label,
    price_normal: String(o.price_normal ?? ""),
    price_negotiation: String(o.price_negotiation ?? ""),
    description: String(o.description ?? ""),
    models_applicable: String(o.models_applicable ?? ""),
    is_active: o.is_active !== false,
    sort_order: num(o.sort_order),
  };
}

export async function GET() {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(user, "pricing:view")) && !(await hasPermission(user, "pricing:manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const admin = await hasPermission(user, "pricing:manage");
    const [rows, specials] = await Promise.all([
      admin ? getAllPricingRowsAdmin() : getAllPricingRows(),
      admin ? getAllPricingSpecialsAdmin() : getAllPricingSpecials(),
    ]);
    return NextResponse.json({ rows, specials });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(user, "pricing:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body == null || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const t = (body as { type?: unknown }).type;
  try {
    if (t === "special") {
      const parsed = parseSpecialCreate(body);
      if (!parsed) return NextResponse.json({ error: "Invalid special" }, { status: 400 });
      const created = await createPricingSpecial(parsed);
      return NextResponse.json(created);
    }
    if (t === "row") {
      const parsed = parseRowCreate(body);
      if (!parsed) return NextResponse.json({ error: "Invalid row" }, { status: 400 });
      const created = await createPricingRow(parsed);
      return NextResponse.json(created);
    }
    return NextResponse.json({ error: "type must be row or special" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
