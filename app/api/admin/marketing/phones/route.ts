import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createPhone, getPhones } from "@/services/marketing";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "marketing:manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const phones = await getPhones();
  return NextResponse.json({ phones });
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "marketing:manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const device_name = typeof b.device_name === "string" ? b.device_name.trim() : "";
  if (!device_name) {
    return NextResponse.json({ error: "Device name is required" }, { status: 400 });
  }
  const file_links = Array.isArray(b.file_links)
    ? b.file_links.filter((x): x is string => typeof x === "string")
    : undefined;
  const phone = await createPhone({
    device_name,
    icloud_email: typeof b.icloud_email === "string" ? b.icloud_email.trim() : "",
    icloud_password: typeof b.icloud_password === "string" ? b.icloud_password : "",
    recovery_email: typeof b.recovery_email === "string" ? b.recovery_email.trim() : "",
    recovery_phone: typeof b.recovery_phone === "string" ? b.recovery_phone.trim() : "",
    assigned_va_id: typeof b.assigned_va_id === "string" ? b.assigned_va_id : "",
    notes: typeof b.notes === "string" ? b.notes.trim() : "",
    file_links,
    active: b.active !== false,
  });
  return NextResponse.json({ phone });
}
