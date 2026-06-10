import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createPlatform, getAllPlatforms } from "@/services/marketing";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "marketing:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const platforms = await getAllPlatforms();
  return NextResponse.json({ platforms });
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "marketing:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const platform = await createPlatform(body as Parameters<typeof createPlatform>[0]);
  return NextResponse.json({ platform });
}
