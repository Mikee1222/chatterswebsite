import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { listAllModelss } from "@/services/modelss";

function isAdminOrManager(session: Awaited<ReturnType<typeof getSessionFromCookies>>) {
  return session != null && (session.role === "admin" || session.role === "manager");
}

export async function GET() {
  const session = await getSessionFromCookies();
  if (!isAdminOrManager(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const modelss = await listAllModelss();
  const models = modelss.map((m) => ({ id: m.id, model_name: m.model_name ?? "" }));
  return NextResponse.json({ models });
}
