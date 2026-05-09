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
};

function estimateWait(activeMinutes: number): string {
  const rough = Math.max(5, Math.min(180, 120 - Math.min(activeMinutes, 115)));
  return `~${rough} min`;
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
    const queuePosition = Math.max(
      1,
      sameShiftWaiting.findIndex((r) => r.id === entry.id) + 1
    );
    const totalInQueue = sameShiftWaiting.length;

    const payload: ShiftQueuePollResponse = {
      inQueue: true,
      status: "waiting",
      waitingForChatter: entry.waiting_for_chatter_name || "Chatter",
      waitingForShiftId: entry.waiting_for_shift_id,
      activeShiftDuration,
      estimatedWait: shiftLive ? estimateWait(activeShiftDuration) : "~soon",
      queuePosition,
      totalInQueue,
      selectedModelNames: entry.selected_model_names.filter(Boolean),
    };

    return NextResponse.json(payload);
  } catch (e) {
    console.error("[GET /api/chatter/shift-queue/status]", e);
    return NextResponse.json({ ...empty, inQueue: false }, { status: 503 });
  }
}
