import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { addDaysAthensYmd, getWeekStartYmdInAthens } from "@/lib/airtable-datetime";
import { getInflowwEarningsSnapshot, InflowwApiError } from "@/lib/infloww-api";
import { listEarningsAgencyCutConfig } from "@/services/earnings-config";
import { getModelById } from "@/services/modelss";
import { getUserByAirtableId } from "@/services/users";

/**
 * Current calendar week (Mon–Sun, Athens +3 convention) gross/net/agency totals
 * for the logged-in model’s linked Infloww creator (`modelss.model_id`).
 */
export async function GET() {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(user, "models:view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userRecordId = user.airtableUserId ?? user.id;
  let linkedModelId: string | null = null;
  try {
    const rec = await getUserByAirtableId(userRecordId);
    linkedModelId = rec?.linked_model_id?.trim() || null;
  } catch {
    linkedModelId = null;
  }

  if (!linkedModelId) {
    return NextResponse.json(
      {
        week_start: getWeekStartYmdInAthens(0),
        week_end: addDaysAthensYmd(getWeekStartYmdInAthens(0), 6),
        gross: 0,
        net: 0,
        agency_cut: 0,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const modelRecord = await getModelById(linkedModelId);
  const inflowwCreatorId = modelRecord?.model_id?.trim();
  if (!inflowwCreatorId) {
    const ws = getWeekStartYmdInAthens(0);
    return NextResponse.json(
      { week_start: ws, week_end: addDaysAthensYmd(ws, 6), gross: 0, net: 0, agency_cut: 0 },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const weekStart = getWeekStartYmdInAthens(0);
  const weekEnd = addDaysAthensYmd(weekStart, 6);
  const agencyPct = await listEarningsAgencyCutConfig().catch(() => ({}));

  try {
    const snap = await getInflowwEarningsSnapshot({
      from: weekStart,
      to: weekEnd,
      modelId: inflowwCreatorId,
      agencyCutPercentByModelId: agencyPct,
    });
    return NextResponse.json(
      {
        week_start: weekStart,
        week_end: weekEnd,
        gross: snap.totals.gross,
        net: snap.totals.net,
        agency_cut: snap.totals.cut,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof InflowwApiError) {
      if (error.status === 400 && /invalid\s+creator|creator\s+status/i.test(error.message)) {
        return NextResponse.json(
          {
            week_start: weekStart,
            week_end: weekEnd,
            gross: 0,
            net: 0,
            agency_cut: 0,
          },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
