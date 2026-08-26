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
  type InflowwStatsPreset,
} from "@/services/infloww-performance";
import { listCreatorModelRevenueRankings } from "@/services/infloww-creator-earnings";
import { getInstagramWeeklyProgressReport } from "@/services/instagram-weekly-progress";
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

      case "get_instagram_insights_summary": {
        const year = num(parameters.year);
        const month = num(parameters.month);
        if (year == null || month == null || month < 1 || month > 12) {
          return { ok: false, summary: "Invalid year/month", error: "year and month (1-12) required" };
        }
        const report = await getInstagramWeeklyProgressReport(Math.trunc(year), Math.trunc(month), {
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
        return {
          ok: true,
          summary: `IG insights ${year}-${String(month).padStart(2, "0")}: ${models.total} models`,
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
        return {
          ok: true,
          summary: `Task timer: ${Math.round((stats.total_tracked_seconds ?? 0) / 60)} min tracked`,
          data: {
            total_tracked_seconds: stats.total_tracked_seconds,
            by_category: stats.by_category,
            by_va: capArray(stats.by_va ?? [], 30).items,
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
        const capped = capArray(
          programs.map((p) => ({
            id: p.id,
            chatter_name: p.chatter_name,
            day: p.day,
            shift_type: p.shift_type,
            model_ids: p.model_ids,
            model_names: p.model_names,
            start_time: p.start_time,
            end_time: p.end_time,
            notes: p.notes,
          })),
          80,
        );
        return {
          ok: true,
          summary: `Weekly program ${weekStart}: ${capped.total} shifts`,
          data: { week_start: weekStart, truncated: capped.truncated, total: capped.total, programs: capped.items },
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
