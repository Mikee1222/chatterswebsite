/**
 * Gunzo Agent — Anthropic tool definitions + system prompt.
 * READ tools execute immediately; ACTION tools require human confirmation.
 */

import type { AnthropicToolDef } from "@/lib/ai-assistant";
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
  "get_link_analytics",
  "get_va_stats",
  "get_task_timer_data",
  "get_spot_check_history",
  "search_mistakes",
  "get_application_pipeline_stats",
  "get_application_pipeline_detail",
  "get_winner_videos",
  "get_weekly_program",
  "get_password_library_metadata",
  "get_marketing_control_room",
  "get_bunch_pipeline",
  "get_sop_completion_status",
  "get_client_partnership",
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
    description:
      "Instagram weekly progress for a calendar month (defaults to this Athens month)",
  },
  get_link_analytics: {
    name: "get_link_analytics",
    kind: "read",
    requiredPermission: PERMISSIONS.INSTAGRAM_INSIGHTS_VIEW,
    description:
      "GetMySocial link-in-bio analytics (bio clicks, UV, CTR, Link A/B, IG→OF funnel) for a model + date range",
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
    description: "Task category timer aggregates (by category, VA, longest/shortest items)",
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
  get_application_pipeline_detail: {
    name: "get_application_pipeline_detail",
    kind: "read",
    requiredPermission: PERMISSIONS.APPLICATIONS_VIEW,
    description: "Application candidates with scores and auto-flags (no hire credentials)",
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
    description: "Full weekly chatter program schedule + model coverage for a week_start",
  },
  get_password_library_metadata: {
    name: "get_password_library_metadata",
    kind: "read",
    requiredPermission: PERMISSIONS.CREDENTIALS_VIEW,
    description:
      "Password Library metadata only — which credentials exist, categories, coverage (NEVER secret values)",
  },
  get_marketing_control_room: {
    name: "get_marketing_control_room",
    kind: "read",
    requiredPermission: PERMISSIONS.MARKETING_VIEW,
    description: "Marketing Control Room: social accounts, phones, shadowban reports (no passwords)",
  },
  get_bunch_pipeline: {
    name: "get_bunch_pipeline",
    kind: "read",
    requiredPermission: PERMISSIONS.WINNER_SOURCING_MANAGE,
    description: "Bunch / Winner Hub pipeline: filming, editing, iCloud progress + material runway",
  },
  get_sop_completion_status: {
    name: "get_sop_completion_status",
    kind: "read",
    requiredPermission: PERMISSIONS.SOPS_VIEW,
    description: "SOP Academy completion / sign-off overview by role",
  },
  get_client_partnership: {
    name: "get_client_partnership",
    kind: "read",
    requiredPermission: PERMISSIONS.CLIENTS_VIEW,
    description: "Client Gunzo Partnership list or Infloww stats for one client",
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
    description:
      "Instagram weekly progress report for a calendar month (same Athens month resolution as Instagram Insights UI). Defaults to this_month (Athens) when year/month/preset omitted. Prefer preset=this_month for 'this month' questions — do not invent a past month. Note: account-level daily views may be 0 for dates before ~2026-08-07 even when reach is real; that is a historical metric gap, not a blackout.",
    input_schema: {
      type: "object",
      properties: {
        preset: {
          type: "string",
          enum: ["this_month", "last_month"],
          description: "Athens calendar month preset; defaults to this_month when year/month omitted",
        },
        year: { type: "integer", description: "Calendar year (optional if preset used)" },
        month: { type: "integer", description: "1-12 (optional if preset used)" },
        model_record_id: { type: "string" },
      },
      required: [],
    },
  },
  {
    name: "get_link_analytics",
    description:
      "GetMySocial link-in-bio analytics for one model: Link A/B pageviews & button clicks, UV, CTR, shield/bot blocked %, device mix, hour-of-day visitor sample, DoD/WoW click trends, A/B winners (today/week/period), rule-based talking points, and IG reach → bio clicks → OF new subs/revenue funnel (alignment, not hard attribution). Requires model_id. Date range via preset (this_week/this_month/…) or start_ymd+end_ymd. Use with get_instagram_insights_summary and get_model_revenue for cross-system funnel synthesis (high reach / low bio clicks, etc.).",
    input_schema: {
      type: "object",
      properties: {
        model_id: {
          type: "string",
          description: "Model Airtable/record id (required)",
        },
        preset: {
          type: "string",
          enum: [...presetEnum],
          description: "Date range preset; defaults to this_month when dates omitted",
        },
        start_ymd: { type: "string", description: "YYYY-MM-DD start (with end_ymd, or preset=custom)" },
        end_ymd: { type: "string", description: "YYYY-MM-DD end (with start_ymd, or preset=custom)" },
      },
      required: ["model_id"],
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
    description:
      "Task category timer aggregates: totals by category and VA, plus longest/shortest items and per-task instance breakdown.",
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
    name: "get_application_pipeline_detail",
    description:
      "List application candidates for a form with cognitive/EQ/typing scores and auto_flags. Omit form_id to list forms first. Never returns hire passwords.",
    input_schema: {
      type: "object",
      properties: {
        form_id: { type: "string", description: "Application form id; omit to list forms" },
        status: {
          type: "string",
          enum: ["new", "reviewed", "shortlisted", "rejected", "hired", "all"],
        },
        flag: { type: "string", description: "Optional auto-flag id filter" },
        sort: {
          type: "string",
          enum: [
            "newest",
            "oldest",
            "cognitive_desc",
            "cognitive_asc",
            "eq_desc",
            "eq_asc",
            "typing_desc",
            "typing_asc",
          ],
        },
        limit: { type: "integer", description: "Max candidates (default 40)" },
      },
    },
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
    description:
      "Full chatter weekly program for week_start (Monday YYYY-MM-DD): all shifts plus model coverage by day.",
    input_schema: {
      type: "object",
      properties: {
        week_start: { type: "string", description: "Monday YYYY-MM-DD" },
      },
      required: ["week_start"],
    },
  },
  {
    name: "get_password_library_metadata",
    description:
      "Password Library METADATA ONLY: which credentials exist (label, category, model, which secret fields are filled). NEVER returns passwords, emails-as-secrets, notes, backup codes, or any decrypted values. Use mode=insights for coverage/attention summary.",
    input_schema: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["list", "insights"],
          description: "list = entry metadata; insights = coverage/attention aggregates",
        },
        model_id: { type: "string", description: "Optional filter for list mode" },
        category: { type: "string", description: "Optional category filter for list mode" },
      },
    },
  },
  {
    name: "get_marketing_control_room",
    description:
      "Marketing Control Room snapshot: social accounts, phones (device metadata only), and/or shadowban reports. Passwords and iCloud credentials are NEVER included.",
    input_schema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          enum: ["all", "accounts", "phones", "shadowban"],
          description: "Which slice to load (default all)",
        },
        model_id: { type: "string", description: "Optional model filter for accounts" },
        shadowban_pending_only: {
          type: "boolean",
          description: "When loading shadowban, only pending reports (default true)",
        },
      },
    },
  },
  {
    name: "get_bunch_pipeline",
    description:
      "Winner Hub / Bunch pipeline progress: bunches with filming/editing/iCloud status counts, optional material runway alerts.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["open", "closed", "all"],
          description: "Bunch status filter (default open)",
        },
        model_id: { type: "string" },
        include_runways: {
          type: "boolean",
          description: "Include model material runway / next shoot (default true)",
        },
      },
    },
  },
  {
    name: "get_sop_completion_status",
    description: "SOP Academy overview: completion and sign-off rates by role, plus members behind.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_client_partnership",
    description:
      "Gunzo Partnership: omit client_id to list clients; with client_id return Infloww partnership revenue/fans/marketing for a date preset.",
    input_schema: {
      type: "object",
      properties: {
        client_id: { type: "string", description: "Client record id; omit to list clients" },
        preset: { type: "string", enum: [...presetEnum] },
        start_ymd: { type: "string" },
        end_ymd: { type: "string" },
        active_only: { type: "boolean", description: "When listing clients (default true)" },
      },
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

export const GUNZO_AGENT_SYSTEM = `You are Gunzo — a sharp, trusted strategic partner for Gunzo agency admins. Warm, direct, informal when it fits. Think with them, not at them.

## Grounding (non-negotiable)
- Use ONLY facts from tool results and the user. Do NOT invent numbers, names, trends, causes, patterns, or recommendations.
- If data is missing or sparse, say so briefly — never speculate to fill gaps.
- When you surface an observation or idea, cite the tool-backed facts that support it (e.g. "from get_instagram_insights_summary + get_model_revenue").
- Opinions are fine only as data-grounded suggestions ("given X and Y, I'd look at Z"). Never present guesses as facts.

## Capabilities
- CALL READ tools for live analytics and ops lists across systems: chatter/model revenue, Instagram, GetMySocial link-in-bio (get_link_analytics), VA stats, task timers, spot checks, mistakes, applications (funnel + candidate scores/flags), winner videos, weekly program, Password Library metadata (existence/coverage only), Marketing Control Room (accounts/phones/shadowban — no secrets), Bunch pipeline (filming/editing/iCloud), SOP completion, Client Gunzo Partnership.
- PROPOSE ACTION tools for curated writes. Every action needs the human to Confirm in the UI — you never execute writes yourself.
- After proposing an action, briefly explain what will happen and that they must confirm.

## Cross-system synthesis
- Prefer answering in one coherent take when the question spans systems. Call multiple READ tools in the same turn when useful (e.g. IG reach + get_link_analytics bio clicks + OF new subs/revenue; shadowban + account status + model revenue; schedule gaps + VA timers).
- When link performance is relevant (bio clicks, Link A vs B, funnel leaks), call get_link_analytics with the model_id. Pair with get_instagram_insights_summary and/or get_model_revenue for grounded funnel reads (high reach / low clicks, winning link, CTR).
- Proactively surface link insights when tool data shows clear patterns (e.g. high IG reach with soft bio CTR, Link A crushing B, shield/bot blocking inflating noise) — cite the tools. Never invent link numbers.
- Do NOT call the same READ tool twice with the same arguments in one conversation turn — reuse prior tool results already in the thread.
- Weave results into one narrative — don't dump disconnected tool summaries.
- For open-ended strategy questions ("what should we focus on?", "anything off?"), pull a few relevant READ tools, then offer grounded observations and optional next checks. Skip the capability menu unless they ask what you can do.

## Hard refusals (do NOT attempt via tools or advice that bypasses them)
- Password Library / credentials vault VALUES or secrets (reveal, copy, create, edit, delete). Metadata via get_password_library_metadata is allowed; never ask for or invent secret contents.
- Marketing account passwords, phone iCloud passwords, recovery emails/phones, or any other credential values (tools strip these — do not reconstruct them)
- Roles & permissions management
- Deleting anything (users, models, records, accounts)
- Payouts / payment disbursements
- Other users' passwords or account credentials
- Setting application status to "hired" (hiring is a separate human flow)
- Any operation outside the provided tools

If asked for a prohibited operation, refuse clearly in one short sentence and suggest the correct admin screen if known.

## Style
- Conversational partner energy: clear, concise, human. Informal OK. No corporate waffle.
- Prefer short bullets for numbers. Use real markdown (headers, bullets, **bold**, --- dividers) when it helps — never leave raw asterisks unexplained.
- For multi-part answers, structure with these section headings when relevant:
  ## Analytics — numbers, trends, tool-backed facts
  ## Actions — proposed writes or next steps that need Confirm
  ## Restrictions — hard refusals / what you cannot do
- Proactive suggestions: when patterns in the data are clear, surface 1–3 grounded observations or ideas with citations. Never invent patterns.
- Date ranges: prefer presets (this_week, this_month) unless the user specifies dates. For Instagram, omit year/month or use preset=this_month — current Athens month; do not assume July/prior months unless asked. Reach with views=0 before ~2026-08-07 is a historical views gap, not a blackout.
- When proposing actions, include the exact IDs and parameters you will use.
- Do not re-list your full capability menu every turn — only on first orientation or when asked.`;
