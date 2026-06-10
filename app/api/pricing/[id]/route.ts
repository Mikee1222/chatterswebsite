import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  deletePricingRow,
  deletePricingSpecial,
  updatePricingRow,
  updatePricingSpecial,
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

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function parseRowPatch(json: unknown): Partial<Omit<PricingRow, "id">> | null {
  if (json == null || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const out: Partial<Omit<PricingRow, "id">> = {};
  if ("model_tier" in o) out.model_tier = coerceMt(o.model_tier);
  if ("spender_tier" in o) out.spender_tier = coerceSt(o.spender_tier);
  if ("video_number" in o) {
    const n = num(o.video_number);
    if (n !== undefined) out.video_number = n;
  }
  if ("price_normal" in o && typeof o.price_normal === "string") out.price_normal = o.price_normal;
  if ("price_negotiation" in o && typeof o.price_negotiation === "string") {
    out.price_negotiation = o.price_negotiation;
  }
  if ("description" in o && typeof o.description === "string") out.description = o.description;
  if ("notes" in o && typeof o.notes === "string") out.notes = o.notes;
  if ("is_active" in o) out.is_active = Boolean(o.is_active);
  if ("sort_order" in o) {
    const n = num(o.sort_order);
    if (n !== undefined) out.sort_order = n;
  }
  return out;
}

function parseSpecialPatch(json: unknown): Partial<Omit<PricingSpecial, "id">> | null {
  if (json == null || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const out: Partial<Omit<PricingSpecial, "id">> = {};
  if ("label" in o && typeof o.label === "string") out.label = o.label;
  if ("price_normal" in o && typeof o.price_normal === "string") out.price_normal = o.price_normal;
  if ("price_negotiation" in o && typeof o.price_negotiation === "string") {
    out.price_negotiation = o.price_negotiation;
  }
  if ("description" in o && typeof o.description === "string") out.description = o.description;
  if ("models_applicable" in o && typeof o.models_applicable === "string") {
    out.models_applicable = o.models_applicable;
  }
  if ("is_active" in o) out.is_active = Boolean(o.is_active);
  if ("sort_order" in o) {
    const n = num(o.sort_order);
    if (n !== undefined) out.sort_order = n;
  }
  return out;
}

function readType(json: unknown): "row" | "special" | null {
  if (json == null || typeof json !== "object") return null;
  const t = (json as { type?: unknown }).type;
  return t === "row" || t === "special" ? t : null;
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(user, "pricing:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  if (!id?.trim()) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const kind = readType(body);
  if (!kind) return NextResponse.json({ error: "body.type must be row or special" }, { status: 400 });
  try {
    if (kind === "row") {
      const patch = parseRowPatch(body);
      if (!patch || Object.keys(patch).length === 0) {
        return NextResponse.json({ error: "No row fields" }, { status: 400 });
      }
      const updated = await updatePricingRow(id.trim(), patch);
      return NextResponse.json(updated);
    }
    const patch = parseSpecialPatch(body);
    if (!patch || Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No special fields" }, { status: 400 });
    }
    const updated = await updatePricingSpecial(id.trim(), patch);
    return NextResponse.json(updated);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(user, "pricing:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  if (!id?.trim()) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    /* allow empty */
  }
  const kind = readType(body);
  if (!kind) return NextResponse.json({ error: "body.type must be row or special" }, { status: 400 });
  try {
    if (kind === "row") await deletePricingRow(id.trim());
    else await deletePricingSpecial(id.trim());
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
