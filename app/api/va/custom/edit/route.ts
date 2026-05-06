import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { revalidateCustomRequestSurfaces } from "@/lib/revalidate-custom-request-paths";
import { agencyEditCustomRequest } from "@/services/custom-request-agency-queue";

/** JSON `request_id` = Airtable **record id** (`rec…`). Rows with `admin_status` **pending** or **accepted**. */
const bodySchema = z.object({
  request_id: z.string().trim().min(1),
  request_details: z.string().trim().max(20000).optional(),
  price: z.string().trim().max(500).optional(),
  deadline_requested: z.string().trim().max(80).nullable().optional(),
});

export async function PATCH(req: Request) {
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

  const { request_id, ...fields } = parsed.data;
  const res = await agencyEditCustomRequest(request_id, fields, "virtual_assistant");
  if (!res.ok) {
    const status = res.error === "Request not found." ? 404 : 400;
    return NextResponse.json({ error: res.error }, { status });
  }

  revalidateCustomRequestSurfaces();
  return NextResponse.json({ ok: true });
}
