import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import {
  createMassList,
  getAllMassLists,
  getAllMassListsAdmin,
  type MassListRecord,
} from "@/services/mass-lists";

function isAdminOrManager(role: string | undefined): boolean {
  return role === "admin" || role === "manager";
}

function isChatterOrVa(role: string | undefined): boolean {
  return role === "chatter" || role === "virtual_assistant";
}

function parseCreateBody(json: unknown): Omit<MassListRecord, "id" | "created_at"> | null {
  if (json == null || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name) return null;
  const type: MassListRecord["type"] = o.type === "exclude" ? "exclude" : "include";
  const sortRaw = o.sort_order;
  const sort_order =
    typeof sortRaw === "number" && Number.isFinite(sortRaw)
      ? sortRaw
      : typeof sortRaw === "string"? Number.parseInt(sortRaw, 10)
        : 0;
  return {
    emoji: typeof o.emoji === "string" ? o.emoji : "",
    name,
    type,
    description: typeof o.description === "string" ? o.description : "",
    is_different_mass: Boolean(o.is_different_mass),
    applies_to_all_models: o.applies_to_all_models !== false,
    model_names: typeof o.model_names === "string" ? o.model_names : "",
    is_active: o.is_active !== false,
    sort_order: Number.isFinite(sort_order) ? sort_order : 0,
  };
}

export async function GET() {
  const user = await getSessionFromCookies();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    if (isAdminOrManager(user.role)) {
      const lists = await getAllMassListsAdmin();
      return NextResponse.json(lists);
    }
    if (isChatterOrVa(user.role)) {
      const lists = await getAllMassLists();
      return NextResponse.json(lists);
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load mass lists";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getSessionFromCookies();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminOrManager(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = parseCreateBody(body);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid body: name is required" }, { status: 400 });
  }
  try {
    const created = await createMassList(parsed);
    return NextResponse.json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
