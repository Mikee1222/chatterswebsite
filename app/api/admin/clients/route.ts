import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { createAdminClient, listAllClients } from "@/services/client-portal";
import type { ClientTeamRole, ClientUserType } from "@/types/client-portal";

const TEAM_ROLES: ClientTeamRole[] = ["admin", "manager", "chatter", "virtual_assistant"];

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session || (session.role !== "admin" && session.role !== "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clients = await listAllClients();
  return NextResponse.json({ clients });
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session || (session.role !== "admin" && session.role !== "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const displayName = typeof body.display_name === "string" ? body.display_name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const userType: ClientUserType = body.user_type === "team_member" ? "team_member" : "client";
  const status = body.status === "inactive" ? "inactive" : "active";

  if (!displayName || !email || !password) {
    return NextResponse.json({ error: "Display name, email, and password are required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const companyName = typeof body.company_name === "string" ? body.company_name.trim() : "";
  if (userType === "client" && !companyName) {
    return NextResponse.json({ error: "Company name is required for clients." }, { status: 400 });
  }

  let clientPercentage: number | undefined;
  if (userType === "client" && body.client_percentage !== undefined && body.client_percentage !== null) {
    const raw =
      typeof body.client_percentage === "number"
        ? body.client_percentage
        : Number(body.client_percentage);
    if (Number.isNaN(raw) || raw < 0 || raw > 1) {
      return NextResponse.json({ error: "Client percentage must be between 0 and 1." }, { status: 400 });
    }
    clientPercentage = raw;
  }

  let role: ClientTeamRole | undefined;
  if (userType === "team_member") {
    const rawRole = typeof body.role === "string" ? body.role : "";
    if (!TEAM_ROLES.includes(rawRole as ClientTeamRole)) {
      return NextResponse.json({ error: "A valid role is required for team members." }, { status: 400 });
    }
    role = rawRole as ClientTeamRole;
  }

  const bcryptjs = await import("bcryptjs");
  const passwordHash = await bcryptjs.hash(password, 10);

  try {
    const client = await createAdminClient({
      company_name: companyName || undefined,
      display_name: displayName,
      email,
      passwordHash,
      client_percentage: clientPercentage,
      user_type: userType,
      role,
      status,
    });
    return NextResponse.json({ client });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create user.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
