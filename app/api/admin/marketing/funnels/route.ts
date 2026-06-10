import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createFunnel, getAllFunnels } from "@/services/marketing";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "marketing:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const modelId = searchParams.get("model_id");
  let funnels = await getAllFunnels();
  if (modelId) funnels = funnels.filter((f) => f.model_id === modelId);
  return NextResponse.json({ funnels });
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
  const b = body as Record<string, unknown>;
  const model_id = typeof b.model_id === "string" ? b.model_id : "";
  const model_name = typeof b.model_name === "string" ? b.model_name : "";
  const label = typeof b.label === "string" ? b.label : "";
  const url = typeof b.url === "string" ? b.url : "";
  const platform = typeof b.platform === "string" ? b.platform : "";
  const region = b.region === "USA" || b.region === "Greek" || b.region === "Global" ? b.region : "Global";
  if (!model_id || !label || !url) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const funnel = await createFunnel({ model_id, model_name, label, url, platform, region });
  return NextResponse.json({ funnel });
}
