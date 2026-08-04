import { NextResponse } from "next/server";
import { deleteRecurringVaTaskAction, deleteVaTaskAction } from "@/app/actions/va-tasks";
import type { RecurringOccurrenceScope } from "@/lib/recurring-occurrence-scope";
import { isVirtualVaTaskId } from "@/lib/recurrence";
import type { VaTaskRecord } from "@/types";

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const id = params.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let body: {
    scope?: RecurringOccurrenceScope;
    taskPayload?: VaTaskRecord;
  } = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text) as typeof body;
  } catch {
    body = {};
  }

  const scope = body.scope;
  if (scope === "this_only" || scope === "this_and_future") {
    const res = await deleteRecurringVaTaskAction({
      taskId: id,
      scope,
      taskPayload: body.taskPayload,
    });
    if (!res.success) {
      const status = res.error?.toLowerCase().includes("unauthorized") ? 401 : 400;
      return NextResponse.json({ error: res.error ?? "Delete failed" }, { status });
    }
    return NextResponse.json({ success: true });
  }

  if (isVirtualVaTaskId(id)) {
    return NextResponse.json(
      {
        error:
          "Choose whether to delete this occurrence only or this and all future occurrences.",
      },
      { status: 400 },
    );
  }

  const res = await deleteVaTaskAction(id);
  if (!res.success) {
    const status = res.error?.toLowerCase().includes("unauthorized") ? 401 : 400;
    return NextResponse.json({ error: res.error ?? "Delete failed" }, { status });
  }
  return NextResponse.json({ success: true });
}
