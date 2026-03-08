import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { listAllShifts } from "@/services/shifts";
import { AdminShiftActivityClient } from "@/components/admin-shift-activity-client";
import type { Shift } from "@/types";

/** Week starts Monday; returns Monday 00:00 and Sunday 23:59:59 for the week containing d. */
function weekBounds(d: Date): { start: Date; end: Date } {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** Last day of month 23:59:59 for the month containing d. */
function monthEnd(d: Date): Date {
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return end;
}

function parseRange(range: "daily" | "weekly" | "monthly" | "custom", from?: string, to?: string): { start: Date; end: Date } {
  const now = new Date();

  if (range === "daily") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (range === "weekly") {
    return weekBounds(now);
  }

  if (range === "monthly") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end: monthEnd(now) };
  }

  if (range === "custom" && from && to) {
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    const endDate = new Date(to);
    endDate.setHours(23, 59, 59, 999);
    return { start, end: endDate };
  }

  // custom without from/to: default to current week
  if (range === "custom") {
    return weekBounds(now);
  }

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function shiftMinutes(shift: Shift): number {
  const start = shift.start_time ? new Date(shift.start_time).getTime() : 0;
  const end = shift.end_time ? new Date(shift.end_time).getTime() : 0;
  if (!start || !end) return 0;
  return Math.max(0, Math.floor((end - start) / 60000)) - (shift.break_minutes ?? 0);
}

export default async function AdminShiftActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) redirect(ROUTES.dashboard);

  const params = await searchParams;
  const range = (params.range as "daily" | "weekly" | "monthly" | "custom") || "weekly";
  const { start: rangeStart, end: rangeEnd } = parseRange(range, params.from, params.to);

  const allShifts = await listAllShifts().catch(() => []);
  const completed = allShifts.filter((s) => s.status === "completed" && s.start_time && s.end_time);
  const inRange = completed.filter((s) => {
    const t = new Date(s.start_time!).getTime();
    return t >= rangeStart.getTime() && t <= rangeEnd.getTime();
  });

  const byPerson: Record<string, { name: string; role: string; totalMinutes: number; shifts: number; breakMinutes: number }> = {};
  for (const s of inRange) {
    const key = `${s.chatter_id}:${s.staff_role ?? "chatter"}`;
    if (!byPerson[key]) {
      byPerson[key] = {
        name: s.chatter_name || "—",
        role: s.staff_role === "virtual_assistant" ? "Virtual assistant" : "Chatter",
        totalMinutes: 0,
        shifts: 0,
        breakMinutes: 0,
      };
    }
    byPerson[key].totalMinutes += shiftMinutes(s);
    byPerson[key].shifts += 1;
    byPerson[key].breakMinutes += s.break_minutes ?? 0;
  }

  const rows = Object.entries(byPerson).map(([_, v]) => ({
    ...v,
    avgDurationMinutes: v.shifts > 0 ? Math.round(v.totalMinutes / v.shifts) : 0,
  }));

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log("[shift-activity]", {
      range,
      from: params.from,
      to: params.to,
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      totalFetched: allShifts.length,
      completedCount: completed.length,
      inRangeCount: inRange.length,
      groupedCount: rows.length,
      sampleRows: rows.slice(0, 3).map((r) => ({ name: r.name, role: r.role, totalMinutes: r.totalMinutes, shifts: r.shifts })),
    });
  }

  const totalChatterMinutes = rows.filter((r) => r.role === "Chatter").reduce((s, r) => s + r.totalMinutes, 0);
  const totalVaMinutes = rows.filter((r) => r.role === "Virtual assistant").reduce((s, r) => s + r.totalMinutes, 0);
  const totalShifts = rows.reduce((s, r) => s + r.shifts, 0);
  const totalBreakMinutes = rows.reduce((s, r) => s + r.breakMinutes, 0);

  return (
    <AdminShiftActivityClient
      range={range}
      from={params.from}
      to={params.to}
      rows={rows}
      totalChatterHours={totalChatterMinutes / 60}
      totalVaHours={totalVaMinutes / 60}
      totalShifts={totalShifts}
      totalBreakMinutes={totalBreakMinutes}
    />
  );
}
