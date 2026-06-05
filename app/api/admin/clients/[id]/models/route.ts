import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { createClientModelAssignment } from "@/services/client-portal";

function isAdminOrManager(session: Awaited<ReturnType<typeof getSessionFromCookies>>) {
  return session != null && (session.role === "admin" || session.role === "manager");
}

const postSchema = z.object({
  modelId: z.string().min(1),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!isAdminOrManager(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: clientId } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 }
    );
  }

  try {
    const assignment = await createClientModelAssignment(clientId, parsed.data.modelId);
    return NextResponse.json({ assignment });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to assign model.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
