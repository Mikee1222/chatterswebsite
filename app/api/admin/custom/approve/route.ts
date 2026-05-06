import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { revalidateCustomRequestSurfaces } from "@/lib/revalidate-custom-request-paths";
import { agencyApproveCustomRequest } from "@/services/custom-request-agency-queue";

/** JSON `request_id` = Airtable record id (`rec…`) for `custom_requests`. Notifications use `notify()` like VA approve / shift flows. */
const bodySchema = z.object({
  request_id: z.string().trim().min(1),
});

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session || (session.role !== "admin" && session.role !== "manager")) {
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

  const res = await agencyApproveCustomRequest(parsed.data.request_id);
  if (!res.ok) {
    const status = res.error === "Request not found." ? 404 : 400;
    return NextResponse.json({ error: res.error }, { status });
  }

  revalidateCustomRequestSurfaces();
  return NextResponse.json({ ok: true });
}
