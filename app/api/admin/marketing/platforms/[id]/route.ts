import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { updatePlatform } from "@/services/marketing";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session || (session.role !== "admin" && session.role !== "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  await updatePlatform(id, body as Parameters<typeof updatePlatform>[1]);
  return NextResponse.json({ success: true });
}
