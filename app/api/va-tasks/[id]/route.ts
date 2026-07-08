import { NextResponse } from "next/server";
import { deleteVaTaskAction } from "@/app/actions/va-tasks";
import { isVirtualVaTaskId } from "@/lib/recurrence";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const id = params.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  if (isVirtualVaTaskId(id)) {
    return NextResponse.json(
      {
        error:
          "Cannot delete a projected recurring day — it has no Airtable record yet. Delete a real occurrence of the series instead.",
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
