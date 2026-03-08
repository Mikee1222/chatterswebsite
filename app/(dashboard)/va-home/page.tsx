import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import {
  getShiftsByChatter,
  getActiveShiftByStaff,
  listShiftModels,
} from "@/services/shifts";
import { formatDateEuropean, formatDateTimeEuropean } from "@/lib/format";
import { VaHomeClient } from "@/components/va-home-client";
import type { Shift } from "@/types";

export type VaHomeShiftCardData =
  | {
      kind: "live";
      date: string;
      startTime: string | null;
      modelsCount: number;
      modelNames: string[];
    }
  | {
      kind: "last";
      date: string;
      durationMinutes: number | null;
      modelNames: string[];
    }
  | { kind: "none" };

async function getVaHomeShiftCardData(vaId: string): Promise<VaHomeShiftCardData> {
  const activeShift = await getActiveShiftByStaff(vaId, "virtual_assistant").catch(() => null);
  if (activeShift) {
    const shiftModels = await listShiftModels(activeShift.id).catch(() => []);
    const modelNames = shiftModels.map((sm) => sm.model_name?.trim()).filter(Boolean) as string[];
    const startTime = activeShift.start_time ?? null;
    return {
      kind: "live",
      date: activeShift.date ?? "",
      startTime,
      modelsCount: activeShift.models_count ?? 0,
      modelNames,
    };
  }
  const shifts = await getShiftsByChatter(vaId, "virtual_assistant").catch(() => []);
  const completed = shifts.filter((s) => s.status === "completed");
  const sorted = [...completed].sort((a, b) => {
    const d = (b.date ?? "").localeCompare(a.date ?? "");
    if (d !== 0) return d;
    return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
  });
  const lastShift = sorted[0];
  if (!lastShift) return { kind: "none" };
  const shiftModels = await listShiftModels(lastShift.id).catch(() => []);
  const modelNames = shiftModels.map((sm) => sm.model_name?.trim()).filter(Boolean) as string[];
  const durationMinutes = lastShift.worked_minutes ?? lastShift.total_minutes ?? null;
  return {
    kind: "last",
    date: lastShift.date ?? "",
    durationMinutes,
    modelNames,
  };
}

function minutesFromShift(s: Shift, now: Date): number {
  const start = s.start_time ? new Date(s.start_time).getTime() : 0;
  if (!start) return 0;
  const end = s.end_time ? new Date(s.end_time).getTime() : now.getTime();
  const rawMs = end - start;
  const breakMs = (s.break_minutes ?? 0) * 60 * 1000;
  return Math.max(0, Math.round((rawMs - breakMs) / 60000));
}

function hoursFromMinutes(m: number): string {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min ? `${h}h ${min}m` : `${h}h`;
}

export default async function VaHomePage() {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "virtual_assistant") redirect(ROUTES.dashboard);

  const vaId = user.airtableUserId ?? user.id;
  const vaName = user.fullName ?? user.email ?? "VA";
  const [allShifts, shiftCardData] = await Promise.all([
    getShiftsByChatter(vaId, "virtual_assistant").catch(() => []),
    getVaHomeShiftCardData(vaId),
  ]);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = (() => {
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toISOString().slice(0, 10);
  })();

  let totalMinutes = 0;
  let weekMinutes = 0;
  let todayMinutes = 0;
  for (const s of allShifts) {
    const mins = minutesFromShift(s, now);
    totalMinutes += mins;
    if (s.date >= weekStart) weekMinutes += mins;
    if (s.date >= todayStart.slice(0, 10)) todayMinutes += mins;
  }

  const recentActivity: { type: string; label: string; at: string }[] = [];
  const sorted = [...allShifts].sort((a, b) => (b.start_time ?? "").localeCompare(a.start_time ?? ""));
  for (const s of sorted.slice(0, 15)) {
    if (s.start_time) {
      recentActivity.push({
        type: "started",
        label: "Started shift",
        at: formatDateTimeEuropean(s.start_time),
      });
    }
    if (s.end_time) {
      recentActivity.push({
        type: "ended",
        label: "Ended shift",
        at: formatDateTimeEuropean(s.end_time),
      });
    }
  }
  recentActivity.sort((a, b) => b.at.localeCompare(a.at));
  const recent = recentActivity.slice(0, 10);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white">
          Welcome back{vaName ? `, ${vaName.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-white/60">Virtual assistant ops dashboard</p>
      </div>

      <VaHomeClient
        totalWorkedHours={hoursFromMinutes(totalMinutes)}
        weekHours={hoursFromMinutes(weekMinutes)}
        todayHours={hoursFromMinutes(todayMinutes)}
        shiftCardData={shiftCardData}
        recentActivity={recent}
      />
    </div>
  );
}
