import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { createAccount, getAllAccounts } from "@/services/marketing";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session || (session.role !== "admin" && session.role !== "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const modelId = searchParams.get("model_id");
  const vaId = searchParams.get("va_id");
  const platform = searchParams.get("platform");
  let accounts = await getAllAccounts();
  if (modelId) accounts = accounts.filter((a) => a.model_id === modelId);
  if (vaId) accounts = accounts.filter((a) => a.assigned_va_id === vaId);
  if (platform) accounts = accounts.filter((a) => a.platform === platform);
  return NextResponse.json({ accounts });
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session || (session.role !== "admin" && session.role !== "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const model_id = typeof b.model_id === "string" ? b.model_id : "";
  const model_name = typeof b.model_name === "string" ? b.model_name : "";
  const platform = typeof b.platform === "string" ? b.platform : "";
  const account_link = typeof b.account_link === "string" ? b.account_link : "";
  const username = typeof b.username === "string" ? b.username : "";
  const account_type = b.account_type === "secondary" ? "secondary" : "main";
  const region = b.region === "USA" || b.region === "Greek" || b.region === "Global" ? b.region : "Global";
  const assigned_va_id = typeof b.assigned_va_id === "string" ? b.assigned_va_id : "";
  const assigned_va_name = typeof b.assigned_va_name === "string" ? b.assigned_va_name : "";
  const notes = typeof b.notes === "string" ? b.notes : "";
  if (!model_id || !platform || !username) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const account = await createAccount({
    model_id,
    model_name,
    platform,
    account_link,
    username,
    account_type,
    region,
    assigned_va_id,
    assigned_va_name,
    notes,
  });
  return NextResponse.json({ account });
}
