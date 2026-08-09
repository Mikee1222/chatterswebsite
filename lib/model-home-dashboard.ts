/**
 * Pure builders for Model Home — model-scoped snapshot + friendly activity feed.
 *
 * Material runway is intentionally omitted from Model Home: urgency tiers
 * ("urgent" / "low") are admin pipeline ops signals and read as alarming to
 * models. Keep runway on admin iCloud / bunches surfaces only.
 */

import { formatMaterialDateShort, formatShootTime12h } from "@/lib/icloud-helpers";
import type { CustomRequest, ModelLiveStreamRecord, VaContentAssignmentRecord } from "@/types";
import type { CreatorTransactionRow } from "@/services/infloww-creator-earnings";

export type ModelHomeEarningsSnapshot = {
  linked: boolean;
  monthGross: number;
  previousGross: number;
  pctChange: number | null;
  direction: "up" | "down" | "flat" | "na";
  activeFans: number | null;
};

export type ModelHomeInstagramSnapshot = {
  linked: boolean;
  followers: number | null;
  engagementRate: number | null;
  followerDelta: number | null;
  topPostThumbUrl: string | null;
  topPostPermalink: string | null;
};

export type ModelHomeUpcomingShoot = {
  id: string;
  scheduleDate: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  source: "filming_schedule" | "model_schedule";
  /** True when shoot is within the next 14 Athens calendar days. */
  isSoon: boolean;
};

export type ModelHomeActivityKind =
  | "custom_approved"
  | "custom_filmed"
  | "live_session"
  | "large_sale"
  | "subscriber_milestone"
  | "va_completed"
  | "shoot_scheduled";

export type ModelHomeActivityItem = {
  id: string;
  kind: ModelHomeActivityKind;
  title: string;
  subtitle: string;
  atIso: string;
  href?: string;
};

export type ModelHomeHeroStats = {
  monthEarnings: number | null;
  earningsLinked: boolean;
  igFollowers: number | null;
  igLinked: boolean;
  nextShootLabel: string | null;
};

const LARGE_SALE_USD = 75;
const SOON_DAYS = 14;

export function formatShootLabel(shoot: {
  scheduleDate: string;
  startTime?: string | null;
  location?: string | null;
}): string {
  const date = formatMaterialDateShort(shoot.scheduleDate);
  const time = formatShootTime12h(shoot.startTime);
  const when = time ? `${date} · ${time}` : date;
  const loc = shoot.location?.trim();
  return loc ? `${when} · ${loc}` : when;
}

export function daysUntilYmd(ymd: string, todayYmd: string): number {
  const a = Date.parse(`${todayYmd}T12:00:00Z`);
  const b = Date.parse(`${ymd.slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 9999;
  return Math.round((b - a) / 86_400_000);
}

export function pickUpcomingShoot(params: {
  todayYmd: string;
  filming: Array<{
    id: string;
    schedule_date: string;
    start_time?: string | null;
    end_time?: string | null;
    location?: string | null;
  }>;
  scheduleShoots: Array<{
    id: string;
    date: string;
    start_time?: string | null;
    end_time?: string | null;
    details?: string | null;
  }>;
}): ModelHomeUpcomingShoot | null {
  const filmingUpcoming = [...params.filming]
    .filter((e) => (e.schedule_date ?? "").slice(0, 10) >= params.todayYmd)
    .sort(
      (a, b) =>
        a.schedule_date.localeCompare(b.schedule_date) ||
        (a.start_time ?? "").localeCompare(b.start_time ?? "")
    );

  if (filmingUpcoming[0]) {
    const e = filmingUpcoming[0];
    const scheduleDate = e.schedule_date.slice(0, 10);
    return {
      id: e.id,
      scheduleDate,
      startTime: e.start_time?.trim() || null,
      endTime: e.end_time?.trim() || null,
      location: e.location?.trim() || null,
      source: "filming_schedule",
      isSoon: daysUntilYmd(scheduleDate, params.todayYmd) <= SOON_DAYS,
    };
  }

  const scheduleUpcoming = [...params.scheduleShoots]
    .filter((e) => (e.date ?? "").slice(0, 10) >= params.todayYmd)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.start_time ?? "").localeCompare(b.start_time ?? "")
    );

  if (scheduleUpcoming[0]) {
    const e = scheduleUpcoming[0];
    const scheduleDate = e.date.slice(0, 10);
    const locMatch = (e.details ?? "").match(/Location:\s*(.+)/i);
    return {
      id: e.id,
      scheduleDate,
      startTime: e.start_time?.trim() || null,
      endTime: e.end_time?.trim() || null,
      location: locMatch?.[1]?.trim() || null,
      source: "model_schedule",
      isSoon: daysUntilYmd(scheduleDate, params.todayYmd) <= SOON_DAYS,
    };
  }

  return null;
}

function statusLabel(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/_/g, " ") || "update";
}

/**
 * Friendly, model-scoped activity — celebrates wins; avoids admin ops language.
 */
export function buildModelHomeRecentActivity(params: {
  customs: CustomRequest[];
  liveStreams: ModelLiveStreamRecord[];
  transactions: CreatorTransactionRow[];
  vaAssignments: VaContentAssignmentRecord[];
  upcomingShoot: ModelHomeUpcomingShoot | null;
  dailyNewSubs?: Array<{ date: string; new_subscribers: number }>;
  limit?: number;
}): ModelHomeActivityItem[] {
  const limit = params.limit ?? 10;
  const items: ModelHomeActivityItem[] = [];

  for (const c of params.customs) {
    const uploaded = Boolean(c.uploaded_at) || c.model_status === "uploaded" || c.model_status === "completed";
    if (uploaded) {
      const raw = c.uploaded_at || c.updated_at || c.created_at;
      const ms = Date.parse(raw ?? "");
      items.push({
        id: `custom-done-${c.id}`,
        kind: "custom_filmed",
        title: "Custom filmed",
        subtitle: c.request_title?.trim() || "Custom request completed",
        atIso: Number.isFinite(ms) ? new Date(ms).toISOString() : new Date(0).toISOString(),
      });
      continue;
    }
    if (c.admin_status === "accepted") {
      const ms = Date.parse(c.updated_at || c.created_at || "");
      items.push({
        id: `custom-ok-${c.id}`,
        kind: "custom_approved",
        title: "Custom approved",
        subtitle: c.request_title?.trim() || "Ready for your schedule",
        atIso: Number.isFinite(ms) ? new Date(ms).toISOString() : new Date(0).toISOString(),
      });
    }
  }

  for (const live of params.liveStreams) {
    const st = (live.status ?? "").toLowerCase();
    if (st === "scheduled") continue;
    const ms = Date.parse(live.actual_end || live.actual_start || live.planned_start || live.created_at || "");
    const active = st === "live" || st === "in_progress";
    items.push({
      id: `live-${live.id}`,
      kind: "live_session",
      title: active ? "You’re live" : "Live session",
      subtitle: `${(live.platform ?? "Platform").trim()} · ${statusLabel(st)}`,
      atIso: Number.isFinite(ms) ? new Date(ms).toISOString() : new Date(0).toISOString(),
    });
  }

  const large = [...params.transactions]
    .filter((t) => (t.amount ?? 0) >= LARGE_SALE_USD)
    .sort((a, b) => (Date.parse(b.created_time ?? "") || 0) - (Date.parse(a.created_time ?? "") || 0))
    .slice(0, 20);
  for (const t of large) {
    const ms = Date.parse(t.created_time ?? "");
    const amt = Math.round(t.amount ?? 0);
    items.push({
      id: `sale-${t.transaction_id}`,
      kind: "large_sale",
      title: `Nice sale · $${amt.toLocaleString("en-US")}`,
      subtitle: `${statusLabel(t.type)} · ${t.fan_name?.trim() || "Fan"}`,
      atIso: Number.isFinite(ms) ? new Date(ms).toISOString() : new Date(0).toISOString(),
    });
  }

  for (const row of params.dailyNewSubs ?? []) {
    const n = row.new_subscribers ?? 0;
    if (n < 5) continue;
    const ymd = row.date.slice(0, 10);
    items.push({
      id: `subs-${ymd}`,
      kind: "subscriber_milestone",
      title: `${n} new subscribers`,
      subtitle: "A strong day on OnlyFans",
      atIso: `${ymd}T18:00:00.000Z`,
    });
  }

  for (const a of params.vaAssignments) {
    const st = (a.status ?? "").toLowerCase();
    if (st !== "completed" && !a.completed_at) continue;
    const ms = Date.parse(a.completed_at || a.updated_at || a.created_at || "");
    items.push({
      id: `va-${a.id}`,
      kind: "va_completed",
      title: "Assignment completed",
      subtitle: a.title?.trim() || "Chatting assignment",
      atIso: Number.isFinite(ms) ? new Date(ms).toISOString() : new Date(0).toISOString(),
    });
  }

  if (params.upcomingShoot?.isSoon) {
    const s = params.upcomingShoot;
    items.push({
      id: `shoot-${s.id}`,
      kind: "shoot_scheduled",
      title: "Upcoming shoot",
      subtitle: formatShootLabel({
        scheduleDate: s.scheduleDate,
        startTime: s.startTime,
        location: s.location,
      }),
      atIso: `${s.scheduleDate}T09:00:00.000Z`,
    });
  }

  return items
    .sort((a, b) => (Date.parse(b.atIso) || 0) - (Date.parse(a.atIso) || 0))
    .slice(0, limit);
}

export function buildModelHomeHeroStats(params: {
  earnings: ModelHomeEarningsSnapshot;
  instagram: ModelHomeInstagramSnapshot;
  upcomingShoot: ModelHomeUpcomingShoot | null;
}): ModelHomeHeroStats {
  return {
    monthEarnings: params.earnings.linked ? params.earnings.monthGross : null,
    earningsLinked: params.earnings.linked,
    igFollowers: params.instagram.linked ? params.instagram.followers : null,
    igLinked: params.instagram.linked,
    nextShootLabel:
      params.upcomingShoot && params.upcomingShoot.isSoon
        ? formatShootLabel({
            scheduleDate: params.upcomingShoot.scheduleDate,
            startTime: params.upcomingShoot.startTime,
            location: params.upcomingShoot.location,
          })
        : null,
  };
}
