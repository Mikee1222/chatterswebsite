import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getRecord } from "@/lib/airtable-server";
import { createPhaseItem } from "@/services/task-phases";

type PhaseFields = { phase_id?: string };

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session || (session.role !== "admin" && session.role !== "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id: phaseAirtableId } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const task_id = typeof b.task_id === "string" ? b.task_id : "";
  const title = typeof b.title === "string" ? b.title : "";
  const description = typeof b.description === "string" ? b.description : "";
  const requires_screenshot = b.requires_screenshot === true;
  const sort_order = typeof b.sort_order === "number" ? b.sort_order : Number(b.sort_order) || 0;
  if (!task_id) {
    return NextResponse.json({ error: "task_id required" }, { status: 400 });
  }
  const phaseRec = await getRecord<PhaseFields>("va_task_phases", phaseAirtableId);
  const phaseKey = String(phaseRec.fields?.phase_id ?? phaseRec.id);
  const item = await createPhaseItem({
    phase_id: phaseKey,
    task_id,
    title,
    description,
    requires_screenshot,
    sort_order,
  });
  return NextResponse.json({ item });
}
