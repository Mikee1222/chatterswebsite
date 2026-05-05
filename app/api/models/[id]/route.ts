import { NextResponse } from "next/server";
import { deleteModelForAdmin } from "@/app/actions/modelss";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const id = params.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const res = await deleteModelForAdmin(id);
  if (!res.success) {
    const status = res.error === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: res.error ?? "Delete failed" }, { status });
  }
  return NextResponse.json({ success: true });
}
