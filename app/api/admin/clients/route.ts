import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { listAllClients } from "@/services/client-portal";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session || (session.role !== "admin" && session.role !== "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clients = await listAllClients();
  return NextResponse.json({ clients });
}
