import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { updateAccount } from "@/services/marketing";
import type { SocialAccountStatus } from "@/services/marketing";

const ALLOWED: SocialAccountStatus[] = ["active", "shadowbanned", "banned"];

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session || (session.role !== "admin" && session.role !== "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  let body: { account_status?: string };
  try {
    body = (await req.json()) as { account_status?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const account_status = body.account_status as SocialAccountStatus;
  if (!account_status || !ALLOWED.includes(account_status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  await updateAccount(id, { account_status });
  return NextResponse.json({ success: true });
}
