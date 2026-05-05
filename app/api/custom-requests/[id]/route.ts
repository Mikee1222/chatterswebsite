import { NextResponse } from "next/server";
import { deleteCustomRequestAction } from "@/app/actions/customs";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const id = params.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const res = await deleteCustomRequestAction(id);
  if (!res.success) {
    const status = res.error === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: res.error ?? "Delete failed" }, { status });
  }
  return NextResponse.json({ success: true });
}
