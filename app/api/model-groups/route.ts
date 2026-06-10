import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createRecord, listAllRecords } from "@/lib/airtable-server";

const TABLE = "model_groups";

type ModelGroupFields = {
  name?: string;
  /** Links to modelss (canonical) — legacy CSV string still read if present. */
  model_ids?: string | string[];
  description?: string;
  created_at?: string;
};

function flattenModelIds(fields: ModelGroupFields): string {
  const raw = fields.model_ids;
  if (Array.isArray(raw)) return raw.map((id) => String(id).trim()).filter(Boolean).join(",");
  return String(raw ?? "").trim();
}

function mapGroup(r: { id: string; fields: ModelGroupFields }) {
  return {
    id: r.id,
    name: String(r.fields.name ?? "").trim(),
    model_ids: flattenModelIds(r.fields),
    description: String(r.fields.description ?? "").trim(),
    created_at: String(r.fields.created_at ?? "").trim(),
  };
}

export async function GET() {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(user, "models:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const records = await listAllRecords<ModelGroupFields>(TABLE, { _caller: "model-groups.GET" });
    return NextResponse.json(records.map(mapGroup));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load model groups";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(user, "models:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const body = await req.json();
    const name = String(body?.name ?? "").trim();
    const modelIds = Array.isArray(body?.model_ids)
      ? body.model_ids.map((v: unknown) => String(v).trim()).filter(Boolean)
      : String(body?.model_ids ?? "")
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
    if (!name) return NextResponse.json({ error: "Group name is required" }, { status: 400 });
    const rec = await createRecord<ModelGroupFields>(TABLE, {
      name,
      model_ids: modelIds,
      created_at: new Date().toISOString(),
    });
    return NextResponse.json(mapGroup(rec), { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create model group";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
