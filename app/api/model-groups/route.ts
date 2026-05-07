import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { createRecord, listAllRecords } from "@/lib/airtable-server";

const TABLE = "model_groups";

type ModelGroupFields = {
  name?: string;
  model_ids?: string;
  created_at?: string;
  created_by?: string | string[];
};

function mapGroup(r: { id: string; fields: ModelGroupFields }) {
  return {
    id: r.id,
    name: String(r.fields.name ?? "").trim(),
    model_ids: String(r.fields.model_ids ?? "").trim(),
    created_at: String(r.fields.created_at ?? "").trim(),
    created_by: Array.isArray(r.fields.created_by) ? r.fields.created_by[0] ?? "" : String(r.fields.created_by ?? ""),
  };
}

export async function GET() {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
      model_ids: modelIds.join(","),
      created_at: new Date().toISOString(),
      created_by: [user.airtableUserId ?? user.id],
    });
    return NextResponse.json(mapGroup(rec), { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create model group";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
