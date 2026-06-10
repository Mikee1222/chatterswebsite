import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getActiveShifts, getShiftById, getActiveShiftByChatter, listShiftModels } from "@/services/shifts";
import {
  getShiftQueueWaitingForChatter,
  createShiftQueueEntry,
  deleteShiftQueueRecord,
  updateShiftQueueRecord,
} from "@/services/shift-queue";
import type { ActiveShiftBrief, ShiftQueueType } from "@/types";

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

function normalizeQueueType(raw: unknown): ShiftQueueType {
  const v = String(raw ?? "full_start")
    .trim()
    .toLowerCase();
  return v === "add_models" ? "add_models" : "full_start";
}

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "shifts:start"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const chatterId = session.airtableUserId ?? session.id;
  if (!chatterId?.trim()) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }

  try {
    const [rawQueueEntry, activeShifts, myActiveShift] = await Promise.all([
      getShiftQueueWaitingForChatter(chatterId),
      activeShiftsBrief(),
      getActiveShiftByChatter(chatterId).catch(() => null),
    ]);
    let queueEntry = rawQueueEntry;
    const nowIso = new Date().toISOString();

    if (queueEntry) {
      const qt = queueEntry.queue_type ?? "full_start";
      if (qt === "add_models") {
        const tid = (queueEntry.target_shift_id ?? "").trim();
        if (!tid || !myActiveShift || myActiveShift.id !== tid) {
          await updateShiftQueueRecord(queueEntry.id, {
            status: "expired",
            cancelled_at: nowIso,
          }).catch(() => {});
          queueEntry = null;
        }
      } else if (myActiveShift) {
        await updateShiftQueueRecord(queueEntry.id, {
          status: "expired",
          cancelled_at: nowIso,
        }).catch(() => {});
        queueEntry = null;
      }
    }

    if (queueEntry?.waiting_for_shift_id) {
      const waited = await getShiftById(queueEntry.waiting_for_shift_id);
      if (!waited || waited.status === "completed" || waited.status === "cancelled") {
        await updateShiftQueueRecord(queueEntry.id, {
          status: "expired",
          cancelled_at: nowIso,
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
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "shifts:start"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  const queue_type = normalizeQueueType(b.queue_type);
  const target_shift_id = String(b.target_shift_id ?? "").trim();

  if (selected_model_ids.length === 0) {
    return NextResponse.json({ error: "Select at least one model" }, { status: 400 });
  }
  if (!waiting_for_shift_id) {
    return NextResponse.json({ error: "waiting_for_shift_id is required" }, { status: 400 });
  }

  try {
    const [active, myActive] = await Promise.all([
      getActiveShifts("chatter"),
      getActiveShiftByChatter(chatterId).catch(() => null),
    ]);
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
    const created_at = new Date().toISOString();

    const namesPayload =
      selected_model_names.length >= selected_model_ids.length
        ? selected_model_names
        : [
            ...selected_model_names,
            ...Array(Math.max(0, selected_model_ids.length - selected_model_names.length)).fill(""),
          ];

    if (queue_type === "full_start") {
      if (myActive) {
        return NextResponse.json(
          { error: "You already have an active shift. Use queue for extra models from the shift screen." },
          { status: 400 }
        );
      }
      const created = await createShiftQueueEntry({
        queue_id,
        chatter_id: chatterId,
        chatter_name: chatterName,
        selected_model_ids: JSON.stringify(selected_model_ids),
        selected_model_names: JSON.stringify(namesPayload),
        status: "waiting",
        waiting_for_shift_id,
        waiting_for_chatter_name: waitingForChatterName,
        created_at,
        queue_type: "full_start",
      });
      return NextResponse.json({ success: true, queue_id, id: created.id });
    }

    // add_models
    if (!myActive) {
      return NextResponse.json({ error: "Start a shift before queuing to add models." }, { status: 400 });
    }
    if (!target_shift_id || target_shift_id !== myActive.id) {
      return NextResponse.json(
        { error: "target_shift_id must be your current active shift." },
        { status: 400 }
      );
    }

    const waitedModels = await listShiftModels(waiting_for_shift_id);
    const stillOnWaitedShift = new Set(
      waitedModels.filter((sm) => !sm.left_at && sm.model_id).map((sm) => String(sm.model_id))
    );
    const notOnShift = selected_model_ids.filter((id) => !stillOnWaitedShift.has(id));
    if (notOnShift.length > 0) {
      return NextResponse.json(
        {
          error:
            "Some models are not on the shift you are waiting for. Refresh the page and try again.",
        },
        { status: 400 }
      );
    }

    const created = await createShiftQueueEntry({
      queue_id,
      chatter_id: chatterId,
      chatter_name: chatterName,
      selected_model_ids: JSON.stringify(selected_model_ids),
      selected_model_names: JSON.stringify(namesPayload),
      status: "waiting",
      waiting_for_shift_id,
      waiting_for_chatter_name: waitingForChatterName,
      created_at,
      queue_type: "add_models",
      target_shift_id,
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
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "shifts:start"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
