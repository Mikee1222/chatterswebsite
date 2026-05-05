import { NextResponse } from "next/server";
import { deletePointsLedgerEntryAction } from "@/app/actions/rewards";

/** Deletes a `points_transactions` row by Airtable record id and adjusts chatter balances. */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const id = params.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const res = await deletePointsLedgerEntryAction(id);
  if (!res.success) {
    const status = res.error === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: res.error ?? "Delete failed" }, { status });
  }
  return NextResponse.json({ success: true });
}
