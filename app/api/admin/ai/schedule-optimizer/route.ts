import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { generateScheduleOptimizerSuggestions } from "@/services/ai-ops-features";
import { createProgramAction } from "@/app/actions/weekly-program";
import type { WeeklyProgramDay, WeeklyProgramShiftType } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAYS = new Set([
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]);
const SHIFT_TYPES = new Set(["Morning", "Midday", "Afternoon", "Night", "LateNight", "Custom"]);

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CHATTER_PROGRAM_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    week_start?: string;
    force?: boolean;
  };
  const weekStart = (body.week_start ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return NextResponse.json({ error: "week_start (YYYY-MM-DD) required" }, { status: 400 });
  }

  try {
    const result = await generateScheduleOptimizerSuggestions({
      week_start: weekStart,
      force: Boolean(body.force),
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Schedule optimizer failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

/**
 * Confirm a single suggested assignment (Gunzo-style confirm).
 * Requires weekly-program:manage.
 */
export async function PUT(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CHATTER_PROGRAM_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    confirm?: boolean;
    suggestion?: {
      chatter_id?: string;
      chatter_name?: string;
      model_ids?: string[];
      model_names?: string[];
      day?: string;
      shift_type?: string;
      week_start?: string;
    };
  };

  if (!body.confirm) {
    return NextResponse.json({
      dry_run: true,
      message: "Pass confirm:true to create the weekly program shift.",
      suggestion: body.suggestion ?? null,
    });
  }

  const s = body.suggestion;
  if (!s?.chatter_id || !s.chatter_name || !s.day || !s.shift_type || !s.week_start) {
    return NextResponse.json({ error: "Incomplete suggestion" }, { status: 400 });
  }
  if (!DAYS.has(s.day) || !SHIFT_TYPES.has(s.shift_type)) {
    return NextResponse.json({ error: "Invalid day or shift_type" }, { status: 400 });
  }

  const modelIds = (s.model_ids ?? []).filter(Boolean);
  if (modelIds.length === 0) {
    return NextResponse.json(
      { error: "Suggestion has no model_ids — resolve models before confirming" },
      { status: 400 },
    );
  }

  const modelIdToName: Record<string, string> = {};
  (s.model_names ?? []).forEach((name, i) => {
    const id = modelIds[i];
    if (id && name) modelIdToName[id] = name;
  });

  const result = await createProgramAction({
    chatter: [s.chatter_id],
    chatter_name: s.chatter_name,
    models: modelIds,
    day: s.day as WeeklyProgramDay,
    shift_type: s.shift_type as WeeklyProgramShiftType,
    week_start: s.week_start.slice(0, 10),
    notes: "Created from AI schedule optimizer suggestion",
    modelIdToName,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, id: result.id, week_start: result.week_start });
}
