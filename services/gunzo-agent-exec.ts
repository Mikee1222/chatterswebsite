/**
 * Gunzo Agent — execute READ/ACTION tools with permission gates.
 * ACTION tools only run when confirmed === true.
 */

import type { AuthUser } from "@/lib/auth-config";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  GUNZO_TOOL_META,
  isGunzoActionTool,
  isGunzoToolName,
  type GunzoToolName,
} from "@/lib/gunzo-agent-tools";
import {
  getAdminInflowwPerformanceReport,
  resolveInflowwStatsRange,
  currentAthensYearMonth,
  type InflowwStatsPreset,
  type InflowwStatsRange,
} from "@/services/infloww-performance";
import { listCreatorModelRevenueRankings, listCreatorDailyStats } from "@/services/infloww-creator-earnings";
import {
  computeChurnRisk,
  pickLatestCreatorDailySnapshot,
} from "@/services/infloww-creator-analytics";
import { getTodayYmdAthens } from "@/lib/airtable-datetime";
import { getInstagramWeeklyProgressReport } from "@/services/instagram-weekly-progress";
import {
  getGetMySocialAnalyticsForModel,
} from "@/services/getmysocial-analytics";
import {
  computeVaStatisticsReport,
  resolveVaStatisticsRange,
  type VaStatisticsPreset,
} from "@/services/va-statistics";
import { computeCategoryTimeStats } from "@/services/task-category-timer";
import { getSpotChecks, updateSpotCheck } from "@/services/marketing-reviews";
import { listMistakesForAdmin } from "@/services/chatter-mistakes";
import {
  getApplicationFormsOverview,
  listApplicationForms,
  listResponses,
  updateResponse,
} from "@/services/application-forms";
import { getAllWinnerVideos } from "@/services/winner-videos";
import { getProgramsForWeek } from "@/services/weekly-program";
import { reviewExtraRevenueSubmission } from "@/services/fines-bonuses";
import {
  getPreferencesByUserId,
  updateNotificationPreference,
} from "@/services/notification-preferences";
import { upsertModelWinnerThresholds } from "@/services/model-winner-thresholds";
import { createProgramAction } from "@/app/actions/weekly-program";
import type { WeeklyProgramDay, WeeklyProgramShiftType } from "@/types";
import {
  getCredentialLibraryInsights,
  listCredentialEntries,
} from "@/services/credential-entries";
import {
  getAllAccounts,
  getAllShadowbanReports,
  getPendingShadowbanReports,
  getPhones,
} from "@/services/marketing";
import { listVideoBunches } from "@/services/winner-sourcing";
import { getPipelineOverviewContext } from "@/services/icloud";
import { getAcademyOverview } from "@/services/sop-academy-overview";
import { getClientPartnershipInflowwStats } from "@/services/client-partnership-infloww";
import { listAllClients } from "@/services/client-portal";
import { resolveGunzoToolParameters } from "@/lib/gunzo-agent-resolve";

const READ_CAP = 40;

const NOTIF_CATEGORIES = new Set([
  "whale_alerts",
  "shift_alerts",
  "model_alerts",
  "system_alerts",
  "task_alerts",
  "mistake_alerts",
  "fine_bonus_alerts",
  "period_alerts",
  "marketing_alerts",
  "phase_alerts",
  "reward_alerts",
  "custom_request_alerts",
  "billing_alerts",
  "training_alerts",
  "schedule_alerts",
]);

export type GunzoExecContext = {
  user: AuthUser;
  /** When true, action tools may mutate. Read tools ignore this. */
  confirmed: boolean;
};

export type GunzoExecResult = {
  ok: boolean;
  summary: string;
  data?: unknown;
  error?: string;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function bool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  return null;
}

function capArray<T>(arr: T[], limit = READ_CAP): { items: T[]; truncated: boolean; total: number } {
  const total = arr.length;
  if (total <= limit) return { items: arr, truncated: false, total };
  return { items: arr.slice(0, limit), truncated: true, total };
}

function adminIds(user: AuthUser): { admin_id: string; admin_name: string } {
  const admin_id = (user.airtableUserId ?? user.id)?.trim() || user.id;
  const admin_name = (user.fullName ?? user.email ?? "Admin").trim() || "Admin";
  return { admin_id, admin_name };
}

async function requireToolPermission(
  user: AuthUser,
  toolName: GunzoToolName,
): Promise<string | null> {
  const meta = GUNZO_TOOL_META[toolName];
  if (!meta.requiredPermission) return null;
  if (!(await hasPermission(user, meta.requiredPermission))) {
    return `Missing permission: ${meta.requiredPermission}`;
  }
  return null;
}

function asPreset(v: unknown, fallback: InflowwStatsPreset = "this_month"): InflowwStatsPreset {
  const s = str(v);
  if (
    s === "this_week" ||
    s === "last_week" ||
    s === "this_month" ||
    s === "last_month" ||
    s === "custom"
  ) {
    return s;
  }
  return fallback;
}

type SubscriberStatsDateRange =
  | "today"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "custom";

function resolveSubscriberStatsRange(
  dateRange: unknown,
  startYmd?: string | null,
  endYmd?: string | null,
): InflowwStatsRange {
  const today = getTodayYmdAthens();
  const dr = (str(dateRange).toLowerCase() || "today") as SubscriberStatsDateRange;
  if (dr === "today") {
    return { startYmd: today, endYmd: today, preset: "custom" };
  }
  if (dr === "custom") {
    return resolveInflowwStatsRange("custom", startYmd || today, endYmd || today);
  }
  if (
    dr === "this_week" ||
    dr === "last_week" ||
    dr === "this_month" ||
    dr === "last_month"
  ) {
    return resolveInflowwStatsRange(dr);
  }
  return { startYmd: today, endYmd: today, preset: "custom" };
}

function subscriberConversion(newSubs: number, profileVisitors: number): number | null {
  if (profileVisitors <= 0) return null;
  return newSubs / profileVisitors;
}

function mapCreatorDailyStatsDay(row: Awaited<ReturnType<typeof listCreatorDailyStats>>[number]) {
  const conversion = subscriberConversion(row.new_subscribers, row.profile_visitors);
  const churn = computeChurnRisk({
    active_fans: row.active_fans,
    fans_with_renew_on: row.fans_with_renew_on,
  });
  return {
    date: row.date,
    performance_rank: row.performance_rank,
    profile_visitors: row.profile_visitors,
    guest_visitors: row.guest_visitors,
    logged_in_visitors: row.logged_in_visitors,
    active_fans: row.active_fans,
    expired_fans: row.expired_fans,
    new_subscribers: row.new_subscribers,
    subscriber_renewals: row.renewals,
    renewals: row.renewals,
    fans_with_renew_on: row.fans_with_renew_on,
    renew_on_share: churn.renew_on_share,
    new_subscriber_conversion: conversion,
    messages_sent: row.messages_sent,
    ppvs_sent: row.ppvs_sent,
    fans_chatted: row.fans_chatted,
    reply_time_ms: row.reply_time_ms,
  };
}

export async function executeGunzoTool(
  toolName: string,
  parameters: Record<string, unknown>,
  ctx: GunzoExecContext,
): Promise<GunzoExecResult> {
  if (!isGunzoToolName(toolName)) {
    return { ok: false, summary: "Unknown tool", error: `Unknown tool: ${toolName}` };
  }

  const permErr = await requireToolPermission(ctx.user, toolName);
  if (permErr) return { ok: false, summary: permErr, error: permErr };

  if (isGunzoActionTool(toolName) && !ctx.confirmed) {
    return {
      ok: false,
      summary: "Action requires confirmation",
      error: "Action tools only run when confirmed is true",
    };
  }

  try {
    const resolvedParams = await resolveGunzoToolParameters(toolName, parameters);
    if ("error" in resolvedParams) {
      return resolvedParams.error;
    }
    parameters = resolvedParams.parameters;

    switch (toolName) {
      case "get_chatter_performance": {
        const preset = asPreset(parameters.preset);
        const range = resolveInflowwStatsRange(
          preset,
          str(parameters.start_ymd) || null,
          str(parameters.end_ymd) || null,
        );
        const publicUserId = str(parameters.public_user_id) || undefined;
        const report = await getAdminInflowwPerformanceReport(range, {
          publicUserId,
          includeRoi: false,
        });
        const chatters = capArray(
          (report.chatters ?? []).map((c) => ({
            name: c.full_name || c.user_public_id,
            publicUserId: c.user_public_id,
            sales: c.totals?.sales,
            tips: c.totals?.tips,
            messages_sent: c.totals?.messages_sent,
            fans_chatted: c.totals?.fans_chatted,
            golden_ratio: c.totals?.golden_ratio,
          })),
        );
        return {
          ok: true,
          summary: `Chatter performance ${range.startYmd}→${range.endYmd}: ${chatters.total} chatters`,
          data: {
            range,
            truncated: chatters.truncated,
            total: chatters.total,
            chatters: chatters.items,
            team_totals: report.team_totals ?? null,
          },
        };
      }

      case "get_model_revenue": {
        const start = str(parameters.start_ymd);
        const end = str(parameters.end_ymd);
        const preset = asPreset(
          parameters.preset,
          start && end ? "custom" : "this_month",
        );
        const range = resolveInflowwStatsRange(
          start && end ? "custom" : preset,
          start || null,
          end || null,
        );
        const rankings = await listCreatorModelRevenueRankings({
          startYmd: range.startYmd,
          endYmd: range.endYmd,
          modelRecordId: str(parameters.model_record_id) || undefined,
        });
        const capped = capArray(rankings);
        const top = capped.items[0];
        return {
          ok: true,
          summary: top
            ? `Model revenue ${range.startYmd}→${range.endYmd}: ${capped.total} models — #1 ${top.model_name} $${top.revenue.toFixed(2)}`
            : `Model revenue ${range.startYmd}→${range.endYmd}: no revenue rows`,
          data: {
            range,
            truncated: capped.truncated,
            total: capped.total,
            models: capped.items,
          },
        };
      }

      case "get_model_subscriber_stats": {
        const modelRecordId = str(parameters.model_name_or_id);
        if (!modelRecordId) {
          return {
            ok: false,
            summary: "model_name_or_id required",
            error: "model_name_or_id required",
          };
        }
        const range = resolveSubscriberStatsRange(
          parameters.date_range,
          str(parameters.start_ymd) || null,
          str(parameters.end_ymd) || null,
        );
        const rows = await listCreatorDailyStats({
          startYmd: range.startYmd,
          endYmd: range.endYmd,
          modelRecordId,
        });
        if (!rows.length) {
          return {
            ok: true,
            summary: `No subscriber stats for model ${modelRecordId} (${range.startYmd}→${range.endYmd})`,
            data: {
              model_record_id: modelRecordId,
              range,
              days: [],
              totals: null,
              snapshot: null,
            },
          };
        }
        const days = rows.map(mapCreatorDailyStatsDay);
        const latest = pickLatestCreatorDailySnapshot(rows);
        const snapshot = latest ? mapCreatorDailyStatsDay(latest) : null;
        const totals = {
          new_subscribers: days.reduce((s, d) => s + d.new_subscribers, 0),
          subscriber_renewals: days.reduce((s, d) => s + d.subscriber_renewals, 0),
          profile_visitors: days.reduce((s, d) => s + d.profile_visitors, 0),
          guest_visitors: days.reduce((s, d) => s + d.guest_visitors, 0),
          logged_in_visitors: days.reduce((s, d) => s + d.logged_in_visitors, 0),
          expired_fans: days.reduce((s, d) => s + d.expired_fans, 0),
          messages_sent: days.reduce((s, d) => s + d.messages_sent, 0),
          ppvs_sent: days.reduce((s, d) => s + d.ppvs_sent, 0),
          fans_chatted: days.reduce((s, d) => s + d.fans_chatted, 0),
          new_subscriber_conversion: subscriberConversion(
            days.reduce((s, d) => s + d.new_subscribers, 0),
            days.reduce((s, d) => s + d.profile_visitors, 0),
          ),
        };
        const modelName = rows[0]?.model_name ?? modelRecordId;
        const todaySubs = range.startYmd === range.endYmd ? days[0]?.new_subscribers ?? 0 : totals.new_subscribers;
        return {
          ok: true,
          summary: `${modelName}: ${todaySubs} new subs (${range.startYmd}→${range.endYmd}) · ${snapshot?.active_fans ?? "—"} active fans`,
          data: {
            model_record_id: modelRecordId,
            model_name: modelName,
            creator_infloww_id: rows[0]?.creator_infloww_id ?? null,
            range,
            days,
            totals,
            snapshot: snapshot
              ? {
                  date: snapshot.date,
                  active_fans: snapshot.active_fans,
                  fans_with_renew_on: snapshot.fans_with_renew_on,
                  renew_on_share: snapshot.renew_on_share,
                  performance_rank: snapshot.performance_rank,
                  churn_label: computeChurnRisk({
                    active_fans: snapshot.active_fans,
                    fans_with_renew_on: snapshot.fans_with_renew_on,
                  }).label,
                }
              : null,
            note: "Flow metrics (new subs, visitors, messages) sum over the range; active_fans and renew-on are point-in-time from the latest complete daily snapshot.",
          },
        };
      }

      case "get_instagram_insights_summary": {
        const explicitYear = num(parameters.year);
        const explicitMonth = num(parameters.month);
        const presetRaw = str(parameters.preset).toLowerCase();
        let year: number;
        let month: number;
        if (
          explicitYear != null &&
          explicitMonth != null &&
          explicitMonth >= 1 &&
          explicitMonth <= 12
        ) {
          year = Math.trunc(explicitYear);
          month = Math.trunc(explicitMonth);
        } else if (presetRaw === "last_month") {
          const cur = currentAthensYearMonth();
          if (cur.month === 1) {
            year = cur.year - 1;
            month = 12;
          } else {
            year = cur.year;
            month = cur.month - 1;
          }
        } else {
          // this_month (default) — same Athens month as Instagram Insights UI
          const cur = currentAthensYearMonth();
          year = cur.year;
          month = cur.month;
        }
        const report = await getInstagramWeeklyProgressReport(year, month, {
          modelRecordId: str(parameters.model_record_id) || undefined,
        });
        const models = capArray(
          (report.models ?? []).map((m) => ({
            modelName: m.modelName ?? m.modelId,
            modelId: m.modelId,
            month_reach: m.month_totals?.reach,
            month_views: m.month_totals?.views,
            month_follower_delta: m.month_totals?.follower_delta,
            weeks: (m.weeks ?? []).map((w) => ({
              label: w.displayLabel || w.label,
              reach: w.totals?.reach,
              views: w.totals?.views,
              follower_delta: w.totals?.follower_delta,
            })),
          })),
          25,
        );
        const teamReach = report.team_month_totals?.reach ?? 0;
        const teamViews = report.team_month_totals?.views ?? 0;
        const viewsNote =
          teamReach > 0 && teamViews === 0
            ? " (reach present; account-level daily views may be historically unavailable before ~2026-08-07 — not a blackout)"
            : "";
        return {
          ok: true,
          summary: `IG insights ${year}-${String(month).padStart(2, "0")}: ${models.total} models · team reach ${Math.round(teamReach).toLocaleString()} · views ${Math.round(teamViews).toLocaleString()}${viewsNote}`,
          data: {
            year,
            month,
            truncated: models.truncated,
            total: models.total,
            models: models.items,
            team_month_totals: report.team_month_totals ?? null,
          },
        };
      }

      case "get_link_analytics": {
        const modelId = str(parameters.model_id);
        if (!modelId) {
          return { ok: false, summary: "model_id required", error: "model_id required" };
        }
        const start = str(parameters.start_ymd);
        const end = str(parameters.end_ymd);
        const preset = asPreset(
          parameters.preset,
          start && end ? "custom" : "this_month",
        );
        const range = resolveInflowwStatsRange(
          start && end ? "custom" : preset,
          start || null,
          end || null,
        );
        const summary = await getGetMySocialAnalyticsForModel(modelId, {
          startYmd: range.startYmd,
          endYmd: range.endYmd,
          timeframe: "thisMonth",
        });
        if (!summary) {
          return {
            ok: true,
            summary: `No GetMySocial links linked for model ${modelId}`,
            data: { model_id: modelId, range, linked: false },
          };
        }
        return {
          ok: true,
          summary: `${summary.modelName}: ${summary.totals.button_clicks} bio clicks · ${summary.totals.pageviews} views · CTR ${summary.totals.ctr_pct ?? "—"}% (${range.startYmd}→${range.endYmd})`,
          data: {
            linked: true,
            range,
            model_id: summary.modelId,
            model_name: summary.modelName,
            last_synced_at: summary.lastSyncedAt,
            totals: summary.totals,
            link_a: {
              shortcode: summary.linkA.link?.shortcode ?? null,
              pageviews: summary.linkA.pageviews,
              button_clicks: summary.linkA.button_clicks,
              unique_visitors: summary.linkA.unique_visitors,
              ctr_pct: summary.linkA.ctr_pct,
              shield_blocked_pct: summary.linkA.shield_blocked_pct,
            },
            link_b: {
              shortcode: summary.linkB.link?.shortcode ?? null,
              pageviews: summary.linkB.pageviews,
              button_clicks: summary.linkB.button_clicks,
              unique_visitors: summary.linkB.unique_visitors,
              ctr_pct: summary.linkB.ctr_pct,
              shield_blocked_pct: summary.linkB.shield_blocked_pct,
            },
            winners: summary.winners,
            trends: {
              clicks_dod: summary.trends.clicks_dod,
              clicks_wow: summary.trends.clicks_wow,
              pageviews_dod: summary.trends.pageviews_dod,
              pageviews_wow: summary.trends.pageviews_wow,
            },
            mobile_device_pct: summary.mobile_device_pct,
            visitor_insights: {
              sample_size: summary.visitorInsights.sample_size,
              bot_pct: summary.visitorInsights.bot_pct,
              peak_hour_athens: summary.visitorInsights.peak_hour_athens,
            },
            funnel_totals: summary.funnelTotals,
            top_referrers: summary.referrers.slice(0, 8),
            top_devices: summary.devices.slice(0, 6),
            talking_points: summary.talking_points,
            note: "Funnel joins IG reach + bio clicks + OF subs/revenue by Athens day — correlation, not hard attribution.",
          },
        };
      }

      case "get_va_stats": {
        const preset = asPreset(parameters.preset) as VaStatisticsPreset;
        const range = resolveVaStatisticsRange(
          preset,
          str(parameters.start_ymd) || null,
          str(parameters.end_ymd) || null,
        );
        const report = await computeVaStatisticsReport(range);
        const vas = capArray(
          (report.by_va ?? []).map((v) => ({
            name: v.va_name || v.va_id,
            vaId: v.va_id,
            tasks_completed: v.tasks?.completed,
            tasks_assigned: v.tasks?.assigned,
            completion_rate: v.tasks?.completion_rate,
            shift_hours: v.shifts?.total_hours,
          })),
        );
        return {
          ok: true,
          summary: `VA stats ${range.startYmd}→${range.endYmd}: ${vas.total} VAs`,
          data: {
            range,
            truncated: vas.truncated,
            total: vas.total,
            vas: vas.items,
            team: report.team ?? null,
          },
        };
      }

      case "get_task_timer_data": {
        const stats = await computeCategoryTimeStats({
          startYmd: str(parameters.start_ymd) || undefined,
          endYmd: str(parameters.end_ymd) || undefined,
          va_id: str(parameters.va_id) || undefined,
        });
        const byVa = capArray(stats.by_va ?? [], 30);
        const byTask = capArray(stats.by_task_instance ?? [], 25);
        return {
          ok: true,
          summary: `Task timer: ${Math.round((stats.total_tracked_seconds ?? 0) / 60)} min tracked`,
          data: {
            total_tracked_seconds: stats.total_tracked_seconds,
            by_category: stats.by_category,
            by_va: byVa.items,
            by_va_truncated: byVa.truncated,
            longest_items: stats.longest_items ?? [],
            shortest_items: stats.shortest_items ?? [],
            by_task_instance: byTask.items,
            by_task_truncated: byTask.truncated,
          },
        };
      }

      case "get_spot_check_history": {
        const checks = await getSpotChecks({
          status: (str(parameters.status) as "Pending" | "Fixed" | "Escalated" | "") || undefined,
          exec_va_id: str(parameters.exec_va_id) || undefined,
          creator_id: str(parameters.creator_id) || undefined,
          date_from: str(parameters.date_from) || undefined,
          date_to: str(parameters.date_to) || undefined,
          unresolved_only: bool(parameters.unresolved_only) ?? undefined,
        });
        const capped = capArray(
          checks.map((c) => ({
            id: c.id,
            subject: c.subject,
            status: c.status,
            type: c.type,
            exec_va_name: c.exec_va_name,
            creator_name: c.creator_name,
            manager_name: c.manager_name,
            timestamp: c.timestamp,
            what_was_wrong: (c.what_was_wrong ?? "").slice(0, 200),
          })),
        );
        return {
          ok: true,
          summary: `Spot checks: ${capped.total} matching`,
          data: { truncated: capped.truncated, total: capped.total, checks: capped.items },
        };
      }

      case "search_mistakes": {
        const rows = await listMistakesForAdmin({
          status: str(parameters.status) || undefined,
          chatter_id: str(parameters.chatter_id) || undefined,
          model_id: str(parameters.model_id) || undefined,
          reason_category: str(parameters.reason_category) || undefined,
          date_from: str(parameters.date_from) || undefined,
          date_to: str(parameters.date_to) || undefined,
        });
        const capped = capArray(
          rows.map((r) => ({
            id: r.id,
            status: r.status,
            chatter_name: r.chatter_name,
            model_name: r.model_name,
            reason_label: r.reason_label,
            reason_category: r.reason_category,
            mistake_date: r.mistake_date,
            points_deducted: r.points_deducted,
          })),
        );
        return {
          ok: true,
          summary: `Mistakes: ${capped.total} matching`,
          data: { truncated: capped.truncated, total: capped.total, mistakes: capped.items },
        };
      }

      case "get_application_pipeline_stats": {
        const overview = await getApplicationFormsOverview();
        return {
          ok: true,
          summary: `Applications: ${overview.total_candidates ?? 0} candidates, ${overview.awaiting_review ?? 0} awaiting review`,
          data: overview,
        };
      }

      case "get_winner_videos": {
        const limit = Math.min(Math.max(num(parameters.limit) ?? READ_CAP, 1), 80);
        const statusFilter = str(parameters.status);
        let rows = await getAllWinnerVideos(
          statusFilter ? { status: statusFilter as "" } : {},
        );
        const modelId = str(parameters.model_id);
        if (modelId) {
          rows = rows.filter((r) => r.reference_model_id === modelId);
        }
        const capped = capArray(
          rows.map((r) => ({
            id: r.id,
            status: r.status,
            reference_model_name: r.reference_model_name,
            video_link: r.video_link,
            submitted_by_name: r.submitted_by_name,
            submitted_at: r.submitted_at,
            views_at_submission: r.views_at_submission,
          })),
          limit,
        );
        return {
          ok: true,
          summary: `Winner videos: ${capped.total} matching`,
          data: { truncated: capped.truncated, total: capped.total, videos: capped.items },
        };
      }

      case "get_weekly_program": {
        const weekStart = str(parameters.week_start);
        if (!weekStart) {
          return { ok: false, summary: "week_start required", error: "week_start required" };
        }
        const programs = await getProgramsForWeek(weekStart);
        const mapped = programs.map((p) => ({
          id: p.id,
          chatter_name: p.chatter_name,
          day: p.day,
          shift_type: p.shift_type,
          model_ids: p.model_ids,
          model_names: p.model_names,
          start_time: p.start_time,
          end_time: p.end_time,
          notes: p.notes,
        }));
        const capped = capArray(mapped, 100);

        const coverageMap = new Map<
          string,
          { model_id: string; model_name: string; days: Set<string>; shift_count: number }
        >();
        const byDayMap = new Map<string, { day: string; shift_count: number; chatters: Set<string> }>();
        for (const p of programs) {
          const dayKey = String(p.day ?? "");
          if (dayKey) {
            const dayRow = byDayMap.get(dayKey) ?? {
              day: dayKey,
              shift_count: 0,
              chatters: new Set<string>(),
            };
            dayRow.shift_count += 1;
            if (p.chatter_name) dayRow.chatters.add(p.chatter_name);
            byDayMap.set(dayKey, dayRow);
          }
          const ids = p.model_ids ?? [];
          const names = p.model_names ?? [];
          for (let i = 0; i < ids.length; i++) {
            const mid = String(ids[i] ?? "").trim();
            if (!mid) continue;
            const mname = String(names[i] ?? mid).trim() || mid;
            const row = coverageMap.get(mid) ?? {
              model_id: mid,
              model_name: mname,
              days: new Set<string>(),
              shift_count: 0,
            };
            if (dayKey) row.days.add(dayKey);
            row.shift_count += 1;
            if (!row.model_name && mname) row.model_name = mname;
            coverageMap.set(mid, row);
          }
        }

        return {
          ok: true,
          summary: `Weekly program ${weekStart}: ${capped.total} shifts, ${coverageMap.size} models covered`,
          data: {
            week_start: weekStart,
            truncated: capped.truncated,
            total: capped.total,
            programs: capped.items,
            by_day: [...byDayMap.values()].map((d) => ({
              day: d.day,
              shift_count: d.shift_count,
              chatters: [...d.chatters],
            })),
            model_coverage: [...coverageMap.values()].map((m) => ({
              model_id: m.model_id,
              model_name: m.model_name,
              days: [...m.days],
              shift_count: m.shift_count,
            })),
          },
        };
      }

      case "get_password_library_metadata": {
        const mode = str(parameters.mode) || "list";
        if (mode === "insights") {
          const insights = await getCredentialLibraryInsights();
          return {
            ok: true,
            summary: `Password Library insights: ${insights.general_count + insights.model_specific_count} entries, ${insights.needs_attention.length} need attention`,
            data: {
              category_breakdown: insights.category_breakdown,
              general_count: insights.general_count,
              model_specific_count: insights.model_specific_count,
              recently_added: insights.recently_added,
              recently_accessed: insights.recently_accessed,
              never_accessed_count: insights.never_accessed_ids.length,
              never_accessed_ids: insights.never_accessed_ids.slice(0, 40),
              model_coverage: insights.model_coverage,
              // Intentionally omit note_snippet (may contain secrets)
              needs_attention: insights.needs_attention.map((n) => ({
                id: n.id,
                label: n.label,
                category: n.category,
                model_id: n.model_id,
                reason: n.reason,
              })),
            },
          };
        }

        const modelFilter = str(parameters.model_id);
        const categoryFilter = str(parameters.category).toLowerCase();
        let entries = await listCredentialEntries();
        if (modelFilter) {
          entries = entries.filter((e) => (e.model_id ?? "") === modelFilter);
        }
        if (categoryFilter) {
          entries = entries.filter((e) => e.category.toLowerCase().includes(categoryFilter));
        }
        const capped = capArray(
          entries.map((e) => ({
            id: e.id,
            model_id: e.model_id,
            category: e.category,
            label: e.label,
            // Metadata only — which secret fields exist, never values
            fields_present: Object.fromEntries(
              Object.entries(e.has_value ?? {}).filter(([, v]) => v === true),
            ),
            custom_field_keys: e.custom_field_keys ?? [],
            has_custom_fields: e.has_custom_fields,
            created_at: e.created_at,
            updated_at: e.updated_at,
            created_by_name: e.created_by_name,
            updated_by_name: e.updated_by_name,
          })),
          60,
        );
        return {
          ok: true,
          summary: `Password Library metadata: ${capped.total} credentials (values never included)`,
          data: { truncated: capped.truncated, total: capped.total, entries: capped.items },
        };
      }

      case "get_marketing_control_room": {
        const section = str(parameters.section) || "all";
        const modelId = str(parameters.model_id);
        const pendingOnly = bool(parameters.shadowban_pending_only);
        const wantAccounts = section === "all" || section === "accounts";
        const wantPhones = section === "all" || section === "phones";
        const wantShadowban = section === "all" || section === "shadowban";

        const data: Record<string, unknown> = { section };
        const bits: string[] = [];

        if (wantAccounts) {
          let accounts = await getAllAccounts();
          if (modelId) accounts = accounts.filter((a) => a.model_id === modelId);
          const capped = capArray(
            accounts.map((a) => ({
              id: a.id,
              account_id: a.account_id,
              model_id: a.model_id,
              model_name: a.model_name,
              platform: a.platform,
              username: a.username,
              account_link: a.account_link,
              account_type: a.account_type,
              region: a.region,
              assigned_va_name: a.assigned_va_name,
              account_status: a.account_status,
              shadowban_reported_at: a.shadowban_reported_at,
              linked_phone_name: a.linked_phone_name,
              active: a.active,
              // password intentionally omitted
            })),
            60,
          );
          data.accounts = capped.items;
          data.accounts_total = capped.total;
          data.accounts_truncated = capped.truncated;
          bits.push(`${capped.total} accounts`);
        }

        if (wantPhones) {
          const phones = await getPhones();
          const capped = capArray(
            phones.map((p) => ({
              id: p.id,
              device_name: p.device_name,
              assigned_va_name: p.assigned_va_name,
              linked_account_count: p.linked_account_count,
              active: p.active,
              photo_count: p.phone_photos?.length ?? 0,
              // icloud_email/password, recovery_* intentionally omitted
            })),
            40,
          );
          data.phones = capped.items;
          data.phones_total = capped.total;
          data.phones_truncated = capped.truncated;
          bits.push(`${capped.total} phones`);
        }

        if (wantShadowban) {
          const reports =
            pendingOnly === false
              ? await getAllShadowbanReports()
              : await getPendingShadowbanReports();
          let filtered = reports;
          if (modelId) filtered = filtered.filter((r) => r.model_id === modelId);
          const capped = capArray(
            filtered.map((r) => ({
              id: r.id,
              report_id: r.report_id,
              model_name: r.model_name,
              platform: r.platform,
              username: r.username,
              report_type: r.report_type,
              status: r.status,
              reported_by_name: r.reported_by_name,
              created_at: r.created_at,
              notes: (r.notes ?? "").slice(0, 160),
            })),
            40,
          );
          data.shadowban_reports = capped.items;
          data.shadowban_total = capped.total;
          data.shadowban_truncated = capped.truncated;
          bits.push(`${capped.total} shadowban reports`);
        }

        return {
          ok: true,
          summary: `Marketing Control Room: ${bits.join(", ") || "empty"}`,
          data,
        };
      }

      case "get_bunch_pipeline": {
        const statusRaw = str(parameters.status) || "open";
        const modelId = str(parameters.model_id);
        const includeRunways = bool(parameters.include_runways) !== false;

        const statusFilter =
          statusRaw === "all" ? undefined : (statusRaw as "open" | "closed");
        let bunches = await listVideoBunches(
          statusFilter ? { status: statusFilter } : undefined,
        );
        if (modelId) bunches = bunches.filter((b) => b.model_id === modelId);

        const capped = capArray(
          bunches.map((b) => ({
            id: b.id,
            name: b.name,
            model_id: b.model_id,
            model_name: b.model_name,
            status: b.status,
            target_video_count: b.target_video_count,
            provided_count: b.provided_count,
            pending_review_count: b.pending_review_count,
            remaining_count: b.remaining_count,
            assigned_creative_name: b.assigned_creative_name,
            assigned_filmer_name: b.assigned_filmer_name,
            assigned_editor_name: b.assigned_editor_name,
            filming_status: b.filming_status,
            filmed_count: b.filmed_count,
            filmable_count: b.filmable_count,
            editing_status: b.editing_status,
            edited_count: b.edited_count,
            editable_count: b.editable_count,
            icloud_status: b.icloud_status,
            icloud_organized_at: b.icloud_organized_at,
            uploaded_at: b.uploaded_at,
            edited_uploaded_at: b.edited_uploaded_at,
          })),
          50,
        );

        let runways: unknown[] | undefined;
        if (includeRunways) {
          const ctx = await getPipelineOverviewContext();
          let runwayRows = ctx.modelRunways ?? [];
          if (modelId) runwayRows = runwayRows.filter((r) => r.model_id === modelId);
          runways = runwayRows.slice(0, 40).map((r) => ({
            model_id: r.model_id,
            model_name: r.model_name,
            furthest_material_until: r.furthest_material_until,
            days_remaining: r.days_remaining,
            alert: r.alert,
            next_shoot_date: r.next_shoot?.schedule_date ?? null,
            last_shoot_date: r.last_shoot?.schedule_date ?? null,
          }));
        }

        return {
          ok: true,
          summary: `Bunch pipeline: ${capped.total} bunches${runways ? `, ${runways.length} model runways` : ""}`,
          data: {
            truncated: capped.truncated,
            total: capped.total,
            bunches: capped.items,
            model_runways: runways,
          },
        };
      }

      case "get_application_pipeline_detail": {
        const formId = str(parameters.form_id);
        if (!formId) {
          const forms = await listApplicationForms();
          const capped = capArray(
            forms.map((f) => ({
              id: f.id,
              title: f.title,
              slug: f.slug,
              status: f.status,
              response_count: f.response_count,
            })),
            40,
          );
          return {
            ok: true,
            summary: `Application forms: ${capped.total} — pass form_id for candidate scores/flags`,
            data: { forms: capped.items, truncated: capped.truncated, total: capped.total },
          };
        }

        const status = str(parameters.status) || "all";
        const sort = str(parameters.sort) || "newest";
        const flag = str(parameters.flag) || null;
        const limit = Math.min(Math.max(num(parameters.limit) ?? READ_CAP, 1), 80);

        const rows = await listResponses(formId, {
          status: status as
            | "new"
            | "reviewed"
            | "shortlisted"
            | "rejected"
            | "hired"
            | "all",
          sort: sort as
            | "newest"
            | "oldest"
            | "cognitive_desc"
            | "cognitive_asc"
            | "eq_desc"
            | "eq_asc"
            | "typing_desc"
            | "typing_asc",
          flag,
        });

        const capped = capArray(
          rows.map((r) => ({
            id: r.id,
            status: r.status,
            submitted_at: r.submitted_at,
            preferred_language: r.preferred_language,
            generated_username: r.generated_username,
            has_hire_password: r.has_hire_password,
            ai_summary: (r.ai_summary ?? "").slice(0, 280) || null,
            auto_flags: (r.auto_flags ?? []).map((f) => ({
              id: f.id,
              label: f.label,
              severity: f.severity,
            })),
            cognitive_percentile: r.cognitive?.percentile_at_time_of_completion ?? null,
            eq_score: r.eq?.overall_score ?? null,
            typing_wpm: r.typing?.wpm ?? null,
            typing_accuracy: r.typing?.accuracy_percent ?? null,
            // answers / respondent_ip / hire secrets intentionally omitted
          })),
          limit,
        );

        return {
          ok: true,
          summary: `Application candidates for ${formId}: ${capped.total} matching`,
          data: {
            form_id: formId,
            truncated: capped.truncated,
            total: capped.total,
            candidates: capped.items,
          },
        };
      }

      case "get_sop_completion_status": {
        const overview = await getAcademyOverview();
        return {
          ok: true,
          summary: `SOP Academy: ${overview.total_members} members, ${overview.total_completed} completed, ${overview.behind.length} behind`,
          data: {
            total_members: overview.total_members,
            total_in_training: overview.total_in_training,
            total_completed: overview.total_completed,
            total_signed_off: overview.total_signed_off,
            roles: overview.roles,
            behind: overview.behind.slice(0, 40),
            chart_by_role: overview.chart_by_role,
            chart_totals: overview.chart_totals,
          },
        };
      }

      case "get_client_partnership": {
        const clientId = str(parameters.client_id);
        if (!clientId) {
          const activeOnly = bool(parameters.active_only) !== false;
          const clients = await listAllClients(activeOnly);
          const capped = capArray(
            clients
              .filter((c) => (c.user_type ?? "client") === "client")
              .map((c) => ({
                id: c.id,
                company_name: c.company_name,
                display_name: c.display_name,
                email: c.email,
                status: c.status,
                client_percentage: c.client_percentage,
                portal_access: c.portal_access,
              })),
            50,
          );
          return {
            ok: true,
            summary: `Clients: ${capped.total} — pass client_id for partnership stats`,
            data: { truncated: capped.truncated, total: capped.total, clients: capped.items },
          };
        }

        const preset = asPreset(parameters.preset, "this_month") as InflowwStatsPreset;
        const stats = await getClientPartnershipInflowwStats(
          clientId,
          preset,
          str(parameters.start_ymd) || undefined,
          str(parameters.end_ymd) || undefined,
        );
        return {
          ok: true,
          summary: stats.linked
            ? `Partnership ${clientId}: net $${Number(stats.revenue?.net ?? 0).toFixed(2)} (${stats.range?.startYmd}→${stats.range?.endYmd})`
            : `Partnership ${clientId}: no linked Infloww data`,
          data: {
            client_id: clientId,
            linked: stats.linked,
            modelNames: stats.modelNames,
            range: stats.range,
            revenue: stats.revenue
              ? {
                  gross: stats.revenue.gross,
                  net: stats.revenue.net,
                  fees: stats.revenue.fees,
                  refunds: stats.revenue.refunds,
                  change: stats.revenue.change,
                  dailyTrend: (stats.revenue.dailyTrend ?? []).slice(0, 31),
                }
              : null,
            fans: stats.fans,
            ranking: stats.ranking,
            marketing: (stats.marketing ?? []).slice(0, 15),
          },
        };
      }

      case "approve_reject_extra_revenue": {
        const recordId = str(parameters.record_id);
        const action = str(parameters.action);
        if (!recordId || (action !== "approve" && action !== "reject")) {
          return { ok: false, summary: "Invalid params", error: "record_id and action required" };
        }
        if (action === "reject" && !str(parameters.reject_reason)) {
          return { ok: false, summary: "Reject reason required", error: "reject_reason required" };
        }
        const { admin_id, admin_name } = adminIds(ctx.user);
        const record = await reviewExtraRevenueSubmission(
          recordId,
          action,
          { admin_id, admin_name },
          str(parameters.reject_reason) || undefined,
        );
        return {
          ok: true,
          summary: `Extra revenue ${action}d for ${record.user_name || recordId}`,
          data: { id: record.id, status: record.status, user_name: record.user_name },
        };
      }

      case "approve_reject_spot_check": {
        const id = str(parameters.spot_check_id);
        const status = str(parameters.status);
        if (!id || !["Pending", "Fixed", "Escalated"].includes(status)) {
          return {
            ok: false,
            summary: "Invalid params",
            error: "spot_check_id and status (Pending|Fixed|Escalated) required",
          };
        }
        await updateSpotCheck(id, { status: status as "Pending" | "Fixed" | "Escalated" });
        return { ok: true, summary: `Spot check ${id} → ${status}`, data: { id, status } };
      }

      case "set_application_pipeline_status": {
        const responseId = str(parameters.response_id);
        const status = str(parameters.status);
        const allowed = ["new", "reviewed", "shortlisted", "rejected"];
        if (!responseId || !allowed.includes(status)) {
          return {
            ok: false,
            summary: "Invalid status",
            error: "status must be new|reviewed|shortlisted|rejected (never hired)",
          };
        }
        if (status === "hired") {
          return { ok: false, summary: "hired forbidden", error: "Cannot set hired via agent" };
        }
        const notes = parameters.internal_notes;
        const updated = await updateResponse(responseId, {
          status: status as "new" | "reviewed" | "shortlisted" | "rejected",
          ...(typeof notes === "string" ? { internal_notes: notes } : {}),
        });
        return {
          ok: true,
          summary: `Application ${responseId} → ${status}`,
          data: { id: updated.id, status: updated.status },
        };
      }

      case "toggle_notification_category": {
        const category = str(parameters.category);
        const enabled = bool(parameters.enabled);
        if (!NOTIF_CATEGORIES.has(category) || enabled == null) {
          return { ok: false, summary: "Invalid category", error: "Valid category + enabled required" };
        }
        const { admin_id } = adminIds(ctx.user);
        let userId = str(parameters.user_id) || admin_id;
        if (userId !== admin_id) {
          if (!(await hasPermission(ctx.user, PERMISSIONS.NOTIFICATIONS_MANAGE))) {
            return {
              ok: false,
              summary: "Cannot edit other users' prefs",
              error: "Missing notifications:manage for other users",
            };
          }
        }
        const prefs = await getPreferencesByUserId(userId);
        if (!prefs) {
          return { ok: false, summary: "Prefs not found", error: `No notification prefs for ${userId}` };
        }
        const updated = await updateNotificationPreference(prefs.id, {
          [category]: enabled,
        });
        return {
          ok: true,
          summary: `${category} → ${enabled ? "on" : "off"} for ${userId}`,
          data: { user_id: userId, category, enabled, preference_id: updated.id },
        };
      }

      case "adjust_winner_thresholds": {
        const modelId = str(parameters.model_id);
        const winner = num(parameters.winner_threshold_views);
        const superWinner = num(parameters.super_winner_threshold_views);
        if (!modelId || winner == null || superWinner == null) {
          return { ok: false, summary: "Invalid thresholds", error: "model_id and both thresholds required" };
        }
        const { admin_id } = adminIds(ctx.user);
        const row = await upsertModelWinnerThresholds({
          model_id: modelId,
          winner_threshold_views: Math.trunc(winner),
          super_winner_threshold_views: Math.trunc(superWinner),
          updated_by: admin_id,
        });
        return {
          ok: true,
          summary: `Thresholds for ${modelId}: winner=${row.winner_threshold_views}, super=${row.super_winner_threshold_views}`,
          data: row,
        };
      }

      case "create_weekly_program_shift": {
        const chatterId = str(parameters.chatter_id);
        const chatterName = str(parameters.chatter_name);
        const day = str(parameters.day) as WeeklyProgramDay;
        const shiftType = str(parameters.shift_type) as WeeklyProgramShiftType;
        const weekStart = str(parameters.week_start);
        const modelIds = Array.isArray(parameters.model_ids)
          ? parameters.model_ids.map((x) => str(x)).filter(Boolean)
          : [];
        if (!chatterId || !chatterName || !day || !shiftType || !weekStart || modelIds.length === 0) {
          return {
            ok: false,
            summary: "Missing shift fields",
            error: "chatter_id, chatter_name, model_ids, day, shift_type, week_start required",
          };
        }
        const modelIdToName =
          parameters.model_id_to_name &&
          typeof parameters.model_id_to_name === "object" &&
          !Array.isArray(parameters.model_id_to_name)
            ? (parameters.model_id_to_name as Record<string, string>)
            : undefined;
        const result = await createProgramAction({
          chatter: [chatterId],
          chatter_name: chatterName,
          models: modelIds,
          day,
          shift_type: shiftType,
          week_start: weekStart,
          notes: str(parameters.notes) || undefined,
          modelIdToName,
          custom_start_time: str(parameters.custom_start_time) || undefined,
          custom_end_time: str(parameters.custom_end_time) || undefined,
        });
        if (!result.success) {
          return { ok: false, summary: result.error || "Create shift failed", error: result.error };
        }
        return {
          ok: true,
          summary: `Created shift ${result.id} for ${chatterName} (${day} ${shiftType})`,
          data: result,
        };
      }

      default:
        return { ok: false, summary: "Unhandled tool", error: `Unhandled: ${toolName}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, summary: msg, error: msg };
  }
}
