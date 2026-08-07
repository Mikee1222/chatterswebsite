import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getWinnerSourcingRecreateConfig,
  setWinnerSourcingRecreateConfig,
} from "@/services/winner-sourcing";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.WINNER_SOURCING_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const settings = await getWinnerSourcingRecreateConfig();
  return NextResponse.json({ settings });
}

export async function PUT(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.WINNER_SOURCING_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    winner_recreate_count?: unknown;
    super_winner_recreate_count?: unknown;
  };

  try {
    const settings = await setWinnerSourcingRecreateConfig({
      winner_recreate_count: Number(body.winner_recreate_count),
      super_winner_recreate_count: Number(body.super_winner_recreate_count),
    });
    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}
