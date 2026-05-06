import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { revalidateCustomRequestSurfaces } from "@/lib/revalidate-custom-request-paths";
import { agencyAppendAdminNote } from "@/services/custom-request-agency-queue";

/** Appends to `custom_requests.admin_notes` (visible to agency). */
const bodySchema = z.object({
  request_id: z.string().trim().min(1),
  note: z.string().trim().min(1).max(8000),
});

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "virtual_assistant") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(" ") }, { status: 400 });
  }

  const res = await agencyAppendAdminNote(parsed.data.request_id, parsed.data.note);
  if (!res.ok) {
    const status = res.error === "Request not found." ? 404 : 400;
    return NextResponse.json({ error: res.error }, { status });
  }

  revalidateCustomRequestSurfaces();
  return NextResponse.json({ ok: true });
}
