import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getActiveShifts, getShiftById } from "@/services/shifts";
import {
  getShiftQueueWaitingForChatter,
  createShiftQueueEntry,
  deleteShiftQueueRecord,
  updateShiftQueueRecord,
} from "@/services/shift-queue";
import type { ActiveShiftBrief } from "@/types";

function activeShiftsBrief(): Promise<ActiveShiftBrief[]> {
  return getActiveShifts("chatter").then((shifts) => {
    const now = Date.now();
    const rows: ActiveShiftBrief[] = shifts.map((s) => {
      const startMs = s.start_time ? new Date(s.start_time).getTime() : NaN;
      const duration_minutes =
        !Number.isNaN(startMs) ? Math.max(0, Math.floor((now - startMs) / 60_000)) : 0;
      return {
        id: s.id,
        chatter_name: (s.chatter_name ?? "Chatter").trim() || "Chatter",
        duration_minutes,
      };
    });
    rows.sort((a, b) => b.duration_minutes - a.duration_minutes);
    return rows;
  });
}

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "chatter") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const chatterId = session.airtableUserId ?? session.id;
  if (!chatterId?.trim()) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }

  try {
    const [rawQueueEntry, activeShifts] = await Promise.all([
      getShiftQueueWaitingForChatter(chatterId),
      activeShiftsBrief(),
    ]);
    let queueEntry = rawQueueEntry;
    if (queueEntry?.waiting_for_shift_id) {
      const waited = await getShiftById(queueEntry.waiting_for_shift_id);
      if (!waited || waited.status === "completed" || waited.status === "cancelled") {
        await updateShiftQueueRecord(queueEntry.id, {
          status: "expired",
          cancelled_at: new Date().toISOString(),
        }).catch(() => {});
        queueEntry = null;
      }
    }
    const inQueue = queueEntry != null;
    return NextResponse.json({
      inQueue,
      queueEntry,
      activeShifts,
    });
  } catch (e) {
    console.error("[GET /api/chatter/shift-queue]", e);
    return NextResponse.json(
      { error: "Failed to load shift queue", inQueue: false, queueEntry: null, activeShifts: [] },
      { status: 503 }
    );
  }
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "chatter") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const chatterId = session.airtableUserId ?? session.id;
  if (!chatterId?.trim()) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const selected_model_ids = Array.isArray(b.selected_model_ids)
    ? (b.selected_model_ids as unknown[]).map((x) => String(x).trim()).filter(Boolean)
    : [];
  const selected_model_names = Array.isArray(b.selected_model_names)
    ? (b.selected_model_names as unknown[]).map((x) => String(x).trim())
    : [];
  const waiting_for_shift_id = String(b.waiting_for_shift_id ?? "").trim();

  if (selected_model_ids.length === 0) {
    return NextResponse.json({ error: "Select at least one model" }, { status: 400 });
  }
  if (!waiting_for_shift_id) {
    return NextResponse.json({ error: "waiting_for_shift_id is required" }, { status: 400 });
  }

  try {
    const active = await getActiveShifts("chatter");
    const target = active.find((s) => s.id === waiting_for_shift_id);
    if (!target) {
      return NextResponse.json({ error: "That shift is no longer active" }, { status: 400 });
    }
    if (target.chatter_id === chatterId) {
      return NextResponse.json({ error: "You cannot queue for your own shift" }, { status: 400 });
    }

    const existing = await getShiftQueueWaitingForChatter(chatterId);
    if (existing) {
      return NextResponse.json({ error: "You are already in the queue" }, { status: 409 });
    }

    const chatterName = session.fullName?.trim() || session.email || "Chatter";
    const waitingForChatterName = (target.chatter_name ?? "Chatter").trim() || "Chatter";
    const queue_id = `sq_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const created = await createShiftQueueEntry({
      queue_id,
      chatter_id: chatterId,
      chatter_name: chatterName,
      selected_model_ids: JSON.stringify(selected_model_ids),
      selected_model_names: JSON.stringify(
        selected_model_names.length >= selected_model_ids.length
          ? selected_model_names
          : [
              ...selected_model_names,
              ...Array(Math.max(0, selected_model_ids.length - selected_model_names.length)).fill(""),
            ]
      ),
      status: "waiting",
      waiting_for_shift_id,
      waiting_for_chatter_name: waitingForChatterName,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, queue_id, id: created.id });
  } catch (e) {
    console.error("[POST /api/chatter/shift-queue]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg || "Failed to join queue" }, { status: 503 });
  }
}

export async function DELETE() {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "chatter") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const chatterId = session.airtableUserId ?? session.id;
  if (!chatterId?.trim()) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }

  try {
    const existing = await getShiftQueueWaitingForChatter(chatterId);
    if (!existing) {
      return NextResponse.json({ success: true, removed: false });
    }
    await deleteShiftQueueRecord(existing.id);
    return NextResponse.json({ success: true, removed: true });
  } catch (e) {
    console.error("[DELETE /api/chatter/shift-queue]", e);
    return NextResponse.json({ error: "Failed to cancel queue" }, { status: 503 });
  }
}
