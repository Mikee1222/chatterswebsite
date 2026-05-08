import { NextResponse } from "next/server";
import { requireModelApiContext } from "@/lib/model-api-auth";
import { deleteModelPersonalEvent, listModelPersonalEventsForModel } from "@/services/model-personal-events";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await requireModelApiContext();
  if (!ctx.ok) return ctx.response;

  const id = params.id?.trim();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const mine = await listModelPersonalEventsForModel(ctx.linkedModelId);
  const target = mine.find((e) => e.id === id);
  if (!target) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  await deleteModelPersonalEvent(id);
  return NextResponse.json({ success: true });
}
