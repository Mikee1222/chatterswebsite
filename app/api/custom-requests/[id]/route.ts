import { NextResponse } from "next/server";
import { deleteCustomRequestAction } from "@/app/actions/customs";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const id = params.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const res = await deleteCustomRequestAction(id);
  if (!res.success) {
    const err = res.error ?? "Delete failed";
    let status = 400;
    if (err === "Unauthorized") status = 401;
    else if (err === "Request not found.") status = 404;
    else if (
      err.includes("Only pending") ||
      err.includes("Only waiting-schedule") ||
      err.includes("not assigned") ||
      err.includes("your own")
    ) {
      status = 403;
    }
    return NextResponse.json({ error: err }, { status });
  }
  return NextResponse.json({ success: true });
}
