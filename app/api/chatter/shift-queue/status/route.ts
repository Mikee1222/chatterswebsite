import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getShiftById } from "@/services/shifts";
import {
  getShiftQueueWaitingForChatter,
  listShiftQueueWaitingForShift,
  updateShiftQueueRecord,
} from "@/services/shift-queue";

export type ShiftQueuePollResponse = {
  inQueue: boolean;
  status: "waiting" | "started" | "cancelled";
  waitingForChatter: string;
  waitingForShiftId: string;
  activeShiftDuration: number;
  estimatedWait: string;
  queuePosition: number;
  totalInQueue: number;
  selectedModelNames: string[];
  /** `full_start` = new shift after wait; `add_models` = attach to existing shift. */
  queue_type: "full_start" | "add_models";
};

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "chatter") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const chatterId = session.airtableUserId ?? session.id;
  if (!chatterId?.trim()) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }

  const empty: ShiftQueuePollResponse = {
    inQueue: false,
    status: "waiting",
    waitingForChatter: "",
    waitingForShiftId: "",
    activeShiftDuration: 0,
    estimatedWait: "",
    queuePosition: 0,
    totalInQueue: 0,
    selectedModelNames: [],
    queue_type: "full_start",
  };

  try {
    const entry = await getShiftQueueWaitingForChatter(chatterId);
    if (!entry) {
      return NextResponse.json({ ...empty, inQueue: false });
    }

    const waitedShift = await getShiftById(entry.waiting_for_shift_id);
    if (!waitedShift || waitedShift.status === "completed" || waitedShift.status === "cancelled") {
      const nowIso = new Date().toISOString();
      await updateShiftQueueRecord(entry.id, { status: "expired", cancelled_at: nowIso }).catch(() => {});
      return NextResponse.json({ ...empty, inQueue: false });
    }
    const shiftLive =
      waitedShift && (waitedShift.status === "active" || waitedShift.status === "on_break");
    let activeShiftDuration = 0;
    if (shiftLive && waitedShift?.start_time) {
      const startMs = new Date(waitedShift.start_time).getTime();
      if (!Number.isNaN(startMs)) {
        activeShiftDuration = Math.max(0, Math.floor((Date.now() - startMs) / 60_000));
      }
    }

    const sameShiftWaiting = await listShiftQueueWaitingForShift(entry.waiting_for_shift_id);
    const qt = entry.queue_type ?? "full_start";
    const fifoSlice =
      qt === "add_models"
        ? sameShiftWaiting.filter((r) => (r.queue_type ?? "full_start") === "add_models")
        : sameShiftWaiting.filter((r) => (r.queue_type ?? "full_start") !== "add_models");
    const queuePosition = Math.max(1, fifoSlice.findIndex((r) => r.id === entry.id) + 1);
    const totalInQueue = fifoSlice.length;

    const payload: ShiftQueuePollResponse = {
      inQueue: true,
      status: "waiting",
      waitingForChatter: entry.waiting_for_chatter_name || "Chatter",
      waitingForShiftId: entry.waiting_for_shift_id,
      activeShiftDuration,
      estimatedWait: "~15 min",
      queuePosition,
      totalInQueue,
      selectedModelNames: entry.selected_model_names.filter(Boolean),
      queue_type: qt,
    };

    return NextResponse.json(payload);
  } catch (e) {
    console.error("[GET /api/chatter/shift-queue/status]", e);
    return NextResponse.json({ ...empty, inQueue: false }, { status: 503 });
  }
}
