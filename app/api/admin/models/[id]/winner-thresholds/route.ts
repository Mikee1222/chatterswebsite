import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getModelWinnerThresholds,
  upsertModelWinnerThresholds,
} from "@/services/model-winner-thresholds";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.WINNER_SOURCING_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const modelId = decodeURIComponent(id).trim();
  if (!modelId) return NextResponse.json({ error: "Model id required" }, { status: 400 });

  const thresholds = await getModelWinnerThresholds(modelId);
  return NextResponse.json({ thresholds });
}

export async function PUT(req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.WINNER_SOURCING_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const modelId = decodeURIComponent(id).trim();
  if (!modelId) return NextResponse.json({ error: "Model id required" }, { status: 400 });

  const body = (await req.json()) as {
    winner_threshold_views?: unknown;
    super_winner_threshold_views?: unknown;
  };

  try {
    const thresholds = await upsertModelWinnerThresholds({
      model_id: modelId,
      winner_threshold_views: Number(body.winner_threshold_views),
      super_winner_threshold_views: Number(body.super_winner_threshold_views),
      updated_by: (session.fullName || session.email || session.id || "").trim(),
    });
    return NextResponse.json({ thresholds });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}
