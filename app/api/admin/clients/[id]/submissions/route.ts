import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getPendingPaymentSubmissionsForClient } from "@/services/client-portal";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session || (session.role !== "admin" && session.role !== "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const submissions = await getPendingPaymentSubmissionsForClient(id);
  return NextResponse.json({ submissions });
}
