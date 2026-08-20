import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  defaultModelWinnerThresholds,
  getModelWinnerThresholds,
  listModelWinnerThresholds,
  upsertModelWinnerThresholds,
} from "@/services/model-winner-thresholds";
import { listActiveGunzoTeamModelss } from "@/services/modelss";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.WINNER_SOURCING_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const modelId = url.searchParams.get("model_id")?.trim() ?? "";

  if (modelId) {
    const thresholds = await getModelWinnerThresholds(modelId);
    return NextResponse.json({ thresholds });
  }

  const [stored, models] = await Promise.all([
    listModelWinnerThresholds(),
    listActiveGunzoTeamModelss().catch(() => []),
  ]);
  const byId = new Map(stored.map((t) => [t.model_id, t]));
  const thresholds = models.map((m) => {
    const id = m.id || m.model_id;
    return byId.get(id) ?? defaultModelWinnerThresholds(id);
  });

  return NextResponse.json({
    thresholds,
    models: models.map((m) => ({
      model_id: m.id || m.model_id,
      model_name: m.model_name || m.model_id || "Creator",
    })),
  });
}

export async function PUT(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.WINNER_SOURCING_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    model_id?: unknown;
    winner_threshold_views?: unknown;
    super_winner_threshold_views?: unknown;
  };

  const modelId = String(body.model_id ?? "").trim();
  if (!modelId) {
    return NextResponse.json({ error: "model_id is required" }, { status: 400 });
  }

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
