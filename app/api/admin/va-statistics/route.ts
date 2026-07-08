import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  computeVaStatisticsReport,
  resolveVaStatisticsRange,
  type VaStatisticsPreset,
} from "@/services/va-statistics";

const PRESETS = new Set<VaStatisticsPreset>([
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "custom",
]);

export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.VA_STATISTICS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const presetRaw = (url.searchParams.get("preset") || "this_week").trim() as VaStatisticsPreset;
  const preset = PRESETS.has(presetRaw) ? presetRaw : "this_week";
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const range = resolveVaStatisticsRange(preset, start, end);

  try {
    const report = await computeVaStatisticsReport(range);
    return NextResponse.json({ report });
  } catch (err) {
    console.error("[api/admin/va-statistics]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to compute statistics" },
      { status: 500 },
    );
  }
}
