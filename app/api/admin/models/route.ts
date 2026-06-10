import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { listAllModelss } from "@/services/modelss";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!(await hasPermission(session, "models:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const modelss = await listAllModelss();
  const models = modelss.map((m) => ({ id: m.id, model_name: m.model_name ?? "" }));
  return NextResponse.json({ models });
}
