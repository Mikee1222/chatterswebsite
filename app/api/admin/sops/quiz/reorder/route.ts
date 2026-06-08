import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { reorderQuizQuestions } from "@/services/sop-quiz";

function isStaffAdmin(session: { role: string } | null): boolean {
  return session != null && (session.role === "admin" || session.role === "manager");
}

const bodySchema = z.object({
  ordered_ids: z.array(z.string().trim().min(1)).min(1),
});

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!isStaffAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    await reorderQuizQuestions(parsed.data.ordered_ids);
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
