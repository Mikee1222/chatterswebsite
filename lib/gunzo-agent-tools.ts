/**
 * Gunzo Agent — Anthropic tool definitions + system prompt.
 * READ tools execute immediately; ACTION tools require human confirmation.
 */

import type { AnthropicToolDef } from "@/lib/ai-assistant";
import { AI_GROUNDING_RULES } from "@/lib/ai-assistant";
import { PERMISSIONS, type Permission } from "@/lib/permissions";

export type GunzoToolKind = "read" | "action";

export type GunzoToolMeta = {
  name: string;
  kind: GunzoToolKind;
  /** Permission required in addition to AI_AGENT_USE (checked at execute time). */
  requiredPermission: Permission | null;
  description: string;
};

export const GUNZO_READ_TOOL_NAMES = [
  "get_chatter_performance",
  "get_model_revenue",
  "get_instagram_insights_summary",
  "get_va_stats",
  "get_task_timer_data",
  "get_spot_check_history",
  "search_mistakes",
  "get_application_pipeline_stats",
  "get_winner_videos",
  "get_weekly_program",
] as const;

export const GUNZO_ACTION_TOOL_NAMES = [
  "approve_reject_extra_revenue",
  "approve_reject_spot_check",
  "set_application_pipeline_status",
  "toggle_notification_category",
  "adjust_winner_thresholds",
  "create_weekly_program_shift",
] as const;

export type GunzoReadToolName = (typeof GUNZO_READ_TOOL_NAMES)[number];
export type GunzoActionToolName = (typeof GUNZO_ACTION_TOOL_NAMES)[number];
export type GunzoToolName = GunzoReadToolName | GunzoActionToolName;

export const GUNZO_TOOL_META: Record<GunzoToolName, GunzoToolMeta> = {
  get_chatter_performance: {
    name: "get_chatter_performance",
    kind: "read",
    requiredPermission: PERMISSIONS.INFLOWW_STATS_VIEW_ALL,
    description: "Infloww chatter performance report for a date range",
  },
  get_model_revenue: {
    name: "get_model_revenue",
    kind: "read",
    requiredPermission: PERMISSIONS.EARNINGS_VIEW,
    description: "Creator/model revenue rankings (Creator Earnings source of truth)",
  },
  get_instagram_insights_summary: {
    name: "get_instagram_insights_summary",
    kind: "read",
    requiredPermission: PERMISSIONS.INSTAGRAM_INSIGHTS_VIEW,
    description: "Instagram weekly progress summary for a calendar month",
  },
  get_va_stats: {
    name: "get_va_stats",
    kind: "read",
    requiredPermission: PERMISSIONS.VA_STATISTICS_VIEW,
    description: "VA statistics report for a date range",
  },
  get_task_timer_data: {
    name: "get_task_timer_data",
    kind: "read",
    requiredPermission: PERMISSIONS.TASK_PROGRESS_VIEW,
    description: "Task category timer aggregates",
  },
  get_spot_check_history: {
    name: "get_spot_check_history",
    kind: "read",
    requiredPermission: PERMISSIONS.SPOTCHECK_MANAGE,
    description: "List spot checks with optional filters",
  },
  search_mistakes: {
    name: "search_mistakes",
    kind: "read",
    requiredPermission: PERMISSIONS.MISTAKES_VIEW,
    description: "Search chatter mistakes for admin",
  },
  get_application_pipeline_stats: {
    name: "get_application_pipeline_stats",
    kind: "read",
    requiredPermission: PERMISSIONS.APPLICATIONS_VIEW,
    description: "Application forms overview / pipeline funnel",
  },
  get_winner_videos: {
    name: "get_winner_videos",
    kind: "read",
    requiredPermission: PERMISSIONS.WINNER_VIDEOS_MANAGE,
    description: "List winner video submissions",
  },
  get_weekly_program: {
    name: "get_weekly_program",
    kind: "read",
    requiredPermission: PERMISSIONS.CHATTER_PROGRAM_VIEW,
    description: "Weekly chatter program for a week_start (Monday)",
  },
  approve_reject_extra_revenue: {
    name: "approve_reject_extra_revenue",
    kind: "action",
    requiredPermission: PERMISSIONS.FINES_REVIEW,
    description: "Approve or reject an extra revenue submission",
  },
  approve_reject_spot_check: {
    name: "approve_reject_spot_check",
    kind: "action",
    requiredPermission: PERMISSIONS.SPOTCHECK_MANAGE,
    description: "Set spot check status to Fixed, Escalated, or Pending",
  },
  set_application_pipeline_status: {
    name: "set_application_pipeline_status",
    kind: "action",
    requiredPermission: PERMISSIONS.APPLICATIONS_MANAGE,
    description: "Set application response status (never hired)",
  },
  toggle_notification_category: {
    name: "toggle_notification_category",
    kind: "action",
    requiredPermission: null,
    description: "Toggle a notification category preference for a user",
  },
  adjust_winner_thresholds: {
    name: "adjust_winner_thresholds",
    kind: "action",
    requiredPermission: PERMISSIONS.WINNER_SOURCING_MANAGE,
    description: "Upsert model winner / super-winner view thresholds",
  },
  create_weekly_program_shift: {
    name: "create_weekly_program_shift",
    kind: "action",
    requiredPermission: PERMISSIONS.CHATTER_PROGRAM_MANAGE,
    description: "Create a chatter weekly program shift (with conflict detection)",
  },
};

export function isGunzoToolName(name: string): name is GunzoToolName {
  return name in GUNZO_TOOL_META;
}

export function isGunzoActionTool(name: string): name is GunzoActionToolName {
  return (GUNZO_ACTION_TOOL_NAMES as readonly string[]).includes(name);
}

export function isGunzoReadTool(name: string): name is GunzoReadToolName {
  return (GUNZO_READ_TOOL_NAMES as readonly string[]).includes(name);
}

const presetEnum = ["this_week", "last_week", "this_month", "last_month", "custom"] as const;

export const GUNZO_AGENT_TOOLS: AnthropicToolDef[] = [
  {
    name: "get_chatter_performance",
    description:
      "Get Infloww chatter performance (sales, tips, messages, golden ratio, etc.) for a date range. Optionally filter by publicUserId.",
    input_schema: {
      type: "object",
      properties: {
        preset: { type: "string", enum: [...presetEnum], description: "Date range preset" },
        start_ymd: { type: "string", description: "YYYY-MM-DD when preset=custom" },
        end_ymd: { type: "string", description: "YYYY-MM-DD when preset=custom" },
        public_user_id: { type: "string", description: "Optional chatter public id / uuid filter" },
      },
      required: ["preset"],
    },
  },
  {
    name: "get_model_revenue",
    description:
      "Rank creators/models by revenue (post-OF creator share) for a date range — same numbers as Creator Earnings / Admin Home. Defaults to this_month (Athens) when dates omitted. Use to answer best/top model questions.",
    input_schema: {
      type: "object",
      properties: {
        preset: {
          type: "string",
          enum: [...presetEnum],
          description: "Date range preset; defaults to this_month when dates omitted",
        },
        start_ymd: { type: "string", description: "YYYY-MM-DD start (with end_ymd, or preset=custom)" },
        end_ymd: { type: "string", description: "YYYY-MM-DD end (with start_ymd, or preset=custom)" },
        model_record_id: { type: "string", description: "Optional filter to one model Airtable record id" },
      },
      required: [],
    },
  },
  {
    name: "get_instagram_insights_summary",
    description: "Instagram weekly progress report for a calendar year/month. Optional model_record_id filter.",
    input_schema: {
      type: "object",
      properties: {
        year: { type: "integer" },
        month: { type: "integer", description: "1-12" },
        model_record_id: { type: "string" },
      },
      required: ["year", "month"],
    },
  },
  {
    name: "get_va_stats",
    description: "VA statistics report for a date range preset.",
    input_schema: {
      type: "object",
      properties: {
        preset: { type: "string", enum: [...presetEnum] },
        start_ymd: { type: "string" },
        end_ymd: { type: "string" },
      },
      required: ["preset"],
    },
  },
  {
    name: "get_task_timer_data",
    description: "Task category timer aggregates (seconds by category).",
    input_schema: {
      type: "object",
      properties: {
        start_ymd: { type: "string" },
        end_ymd: { type: "string" },
        va_id: { type: "string" },
      },
    },
  },
  {
    name: "get_spot_check_history",
    description: "List marketing spot checks. Statuses: Pending, Fixed, Escalated.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["Pending", "Fixed", "Escalated", ""] },
        exec_va_id: { type: "string" },
        creator_id: { type: "string" },
        date_from: { type: "string" },
        date_to: { type: "string" },
        unresolved_only: { type: "boolean" },
      },
    },
  },
  {
    name: "search_mistakes",
    description: "Search chatter mistakes (pending/approved/rejected).",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string" },
        chatter_id: { type: "string" },
        model_id: { type: "string" },
        reason_category: { type: "string" },
        date_from: { type: "string" },
        date_to: { type: "string" },
      },
    },
  },
  {
    name: "get_application_pipeline_stats",
    description: "Application forms overview: funnel counts, published/draft, hired this month/quarter.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_winner_videos",
    description: "List winner video submissions with optional filters.",
    input_schema: {
      type: "object",
      properties: {
        model_id: { type: "string" },
        status: { type: "string" },
        limit: { type: "integer", description: "Max rows to return (default 40)" },
      },
    },
  },
  {
    name: "get_weekly_program",
    description: "Get chatter weekly program rows for week_start (Monday YYYY-MM-DD).",
    input_schema: {
      type: "object",
      properties: {
        week_start: { type: "string", description: "Monday YYYY-MM-DD" },
      },
      required: ["week_start"],
    },
  },
  {
    name: "approve_reject_extra_revenue",
    description:
      "Propose approving or rejecting an extra-revenue fines/bonuses submission. Requires human confirmation. Reject requires reject_reason.",
    input_schema: {
      type: "object",
      properties: {
        record_id: { type: "string" },
        action: { type: "string", enum: ["approve", "reject"] },
        reject_reason: { type: "string" },
      },
      required: ["record_id", "action"],
    },
  },
  {
    name: "approve_reject_spot_check",
    description:
      "Propose setting a spot check status. Use Fixed (resolved), Escalated, or Pending. Requires human confirmation.",
    input_schema: {
      type: "object",
      properties: {
        spot_check_id: { type: "string" },
        status: { type: "string", enum: ["Pending", "Fixed", "Escalated"] },
      },
      required: ["spot_check_id", "status"],
    },
  },
  {
    name: "set_application_pipeline_status",
    description:
      "Propose updating an application response status. Allowed: new, reviewed, shortlisted, rejected. NEVER hired. Requires human confirmation.",
    input_schema: {
      type: "object",
      properties: {
        response_id: { type: "string" },
        status: { type: "string", enum: ["new", "reviewed", "shortlisted", "rejected"] },
        internal_notes: { type: "string" },
      },
      required: ["response_id", "status"],
    },
  },
  {
    name: "toggle_notification_category",
    description:
      "Propose enabling/disabling a notification category for a user (defaults to current admin). Requires human confirmation.",
    input_schema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "Target user id; omit for current admin" },
        category: {
          type: "string",
          enum: [
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
          ],
        },
        enabled: { type: "boolean" },
      },
      required: ["category", "enabled"],
    },
  },
  {
    name: "adjust_winner_thresholds",
    description:
      "Propose updating Winner / Super Winner view thresholds for a model. Changes are not retroactive. Requires human confirmation.",
    input_schema: {
      type: "object",
      properties: {
        model_id: { type: "string" },
        winner_threshold_views: { type: "integer" },
        super_winner_threshold_views: { type: "integer" },
      },
      required: ["model_id", "winner_threshold_views", "super_winner_threshold_views"],
    },
  },
  {
    name: "create_weekly_program_shift",
    description:
      "Propose creating a chatter weekly program shift. Shift types include Morning, Afternoon, Night, LateNight, Custom. Conflict detection runs on execute. Requires human confirmation.",
    input_schema: {
      type: "object",
      properties: {
        chatter_id: { type: "string" },
        chatter_name: { type: "string" },
        model_ids: { type: "array", items: { type: "string" } },
        day: {
          type: "string",
          enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        },
        shift_type: {
          type: "string",
          enum: ["Morning", "Midday", "Afternoon", "Night", "LateNight", "Custom"],
        },
        week_start: { type: "string", description: "Monday YYYY-MM-DD" },
        notes: { type: "string" },
        custom_start_time: { type: "string", description: "HH:mm for Custom" },
        custom_end_time: { type: "string", description: "HH:mm for Custom" },
        model_id_to_name: {
          type: "object",
          additionalProperties: { type: "string" },
          description: "Optional map model id → display name for conflict messages",
        },
      },
      required: ["chatter_id", "chatter_name", "model_ids", "day", "shift_type", "week_start"],
    },
  },
];

export const GUNZO_AGENT_SYSTEM = `You are Gunzo Agent — an internal AI assistant for Gunzo agency admins.

${AI_GROUNDING_RULES}

## Capabilities
- You can CALL READ tools to fetch live analytics and lists. Use them when the user asks about performance, revenue, Instagram, VA stats, timers, spot checks, mistakes, applications, winner videos, or the weekly program.
- You can PROPOSE ACTION tools for curated writes. Every action requires the human to Confirm in the UI — you never execute writes yourself.
- After proposing an action, briefly explain what will happen and that they must confirm.

## Hard refusals (do NOT attempt via tools or advice that bypasses them)
- Password Library / credentials vault (view, reveal, copy, create, edit, delete)
- Roles & permissions management
- Deleting anything (users, models, records, accounts)
- Payouts / payment disbursements
- Other users' passwords or account credentials
- Setting application status to "hired" (hiring is a separate human flow)
- Any operation outside the provided tools

If asked for a prohibited operation, refuse clearly in one short sentence and suggest the correct admin screen if known.

## Style
- Concise, admin-friendly. Prefer short bullets for numbers. Use real markdown (headers, bullets, **bold**, --- dividers) — never leave raw asterisks unexplained.
- For multi-part answers, structure with these section headings when relevant:
  ## Analytics — numbers, trends, tool-backed facts
  ## Actions — proposed writes or next steps that need Confirm
  ## Restrictions — hard refusals / what you cannot do
- Cite tool-backed facts only. If a tool fails or permission is missing, say so.
- Date ranges: prefer presets (this_week, this_month) unless the user specifies dates.
- When proposing actions, include the exact IDs and parameters you will use.`;
