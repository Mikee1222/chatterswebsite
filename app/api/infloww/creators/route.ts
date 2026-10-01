import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getInflowwModels } from "@/lib/infloww-api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(user, "earnings:view"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const forceRefresh = new URL(req.url).searchParams.has("refresh");
    const data = await getInflowwModels({ forceRefresh });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Infloww creators fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
