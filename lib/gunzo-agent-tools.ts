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
  "get_model_subscriber_stats",
  "get_model_persona",
  "list_personas",
  "get_persona_live_updates",
  "list_saved_ideas",
  "get_video_analyses",
  "lookup_instagram_post",
  "get_top_performing_posts",
  "generate_captions",
  "generate_text_on_screen",
  "analyse_from_instagram_link",
  "captions_from_description",
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
  "create_persona",
  "update_persona_fields",
  "add_live_update",
  "update_live_update",
  "deactivate_live_update",
  "save_ideas",
  "rate_idea",
  "create_posting_brief_draft",
  "add_post_to_posting_brief_draft",
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
  get_model_subscriber_stats: {
    name: "get_model_subscriber_stats",
    kind: "read",
    requiredPermission: PERMISSIONS.EARNINGS_VIEW,
    description:
      "Daily creator subscriber/fan stats from synced Infloww creator report (new subs, renewals, active fans, conversion, chat volume)",
  },
  get_model_persona: {
    name: "get_model_persona",
    kind: "read",
    requiredPermission: PERMISSIONS.PERSONAS_VIEW,
    description:
      "Allowlisted Model Persona fields for chatting/creative context (never physique or intimate details)",
  },
  list_personas: {
    name: "list_personas",
    kind: "read",
    requiredPermission: PERMISSIONS.PERSONAS_VIEW,
    description: "Persona completeness, empty sections, last updated, live-update counts (no content)",
  },
  get_persona_live_updates: {
    name: "get_persona_live_updates",
    kind: "read",
    requiredPermission: PERMISSIONS.PERSONAS_VIEW,
    description: "List live updates for a model persona (active + inactive)",
  },
  list_saved_ideas: {
    name: "list_saved_ideas",
    kind: "read",
    requiredPermission: PERMISSIONS.CREATIVE_STUDIO_USE,
    description: "Saved Creative Studio ideas (captions/TOS) for a model",
  },
  get_video_analyses: {
    name: "get_video_analyses",
    kind: "read",
    requiredPermission: PERMISSIONS.CREATIVE_STUDIO_USE,
    description: "Prior video analyses graded fields only (never raw frames)",
  },
  lookup_instagram_post: {
    name: "lookup_instagram_post",
    kind: "read",
    requiredPermission: PERMISSIONS.INSTAGRAM_INSIGHTS_VIEW,
    description: "Lookup IG post by link (synced first; Phase A external API if available)",
  },
  get_top_performing_posts: {
    name: "get_top_performing_posts",
    kind: "read",
    requiredPermission: PERMISSIONS.INSTAGRAM_INSIGHTS_VIEW,
    description: "Top performing IG posts + winner list for a model",
  },
  generate_captions: {
    name: "generate_captions",
    kind: "read",
    requiredPermission: PERMISSIONS.CREATIVE_STUDIO_USE,
    description: "Generate platform-safe captions via Creative Studio (same guardrails)",
  },
  generate_text_on_screen: {
    name: "generate_text_on_screen",
    kind: "read",
    requiredPermission: PERMISSIONS.CREATIVE_STUDIO_USE,
    description: "Generate text-on-screen via Creative Studio (same guardrails)",
  },
  analyse_from_instagram_link: {
    name: "analyse_from_instagram_link",
    kind: "read",
    requiredPermission: PERMISSIONS.CREATIVE_STUDIO_USE,
    description: "Analyse synced IG post cover (graded attire/platform_risk)",
  },
  captions_from_description: {
    name: "captions_from_description",
    kind: "read",
    requiredPermission: PERMISSIONS.CREATIVE_STUDIO_USE,
    description: "Captions from a manual video/description (no file upload)",
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
  create_persona: {
    name: "create_persona",
    kind: "action",
    requiredPermission: PERMISSIONS.PERSONAS_MANAGE,
    description: "Create skeleton persona (non-sensitive basics)",
  },
  update_persona_fields: {
    name: "update_persona_fields",
    kind: "action",
    requiredPermission: PERMISSIONS.PERSONAS_MANAGE,
    description: "Update non-sensitive persona section fields (revision snapshot)",
  },
  add_live_update: {
    name: "add_live_update",
    kind: "action",
    requiredPermission: PERMISSIONS.PERSONAS_MANAGE,
    description: "Add persona live update (max 7 active)",
  },
  update_live_update: {
    name: "update_live_update",
    kind: "action",
    requiredPermission: PERMISSIONS.PERSONAS_MANAGE,
    description: "Update an existing live update",
  },
  deactivate_live_update: {
    name: "deactivate_live_update",
    kind: "action",
    requiredPermission: PERMISSIONS.PERSONAS_MANAGE,
    description: "Deactivate a live update (never delete)",
  },
  save_ideas: {
    name: "save_ideas",
    kind: "action",
    requiredPermission: PERMISSIONS.CREATIVE_STUDIO_USE,
    description: "Save caption/TOS ideas to Creative Studio library",
  },
  rate_idea: {
    name: "rate_idea",
    kind: "action",
    requiredPermission: PERMISSIONS.CREATIVE_STUDIO_USE,
    description: "Rate or favourite saved ideas (batch OK)",
  },
  create_posting_brief_draft: {
    name: "create_posting_brief_draft",
    kind: "action",
    requiredPermission: PERMISSIONS.POSTING_BRIEFS_MANAGE,
    description: "Create posting brief without notifying VAs (draft-like)",
  },
  add_post_to_posting_brief_draft: {
    name: "add_post_to_posting_brief_draft",
    kind: "action",
    requiredPermission: PERMISSIONS.POSTING_BRIEFS_MANAGE,
    description: "Add caption/TOS post row to an existing posting brief",
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
        public_user_id: {
          type: "string",
          description: "Optional chatter filter — full name (e.g. Giannis Katsikas) or record/public id",
        },
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
        model_record_id: {
          type: "string",
          description: "Optional filter to one model — model name (e.g. Lina, Diana) or record id",
        },
      },
      required: [],
    },
  },
  {
    name: "get_model_subscriber_stats",
    description:
      "Daily OnlyFans subscriber/fan stats for one model from synced infloww_creator_daily_stats (same source as Weekly Progress cross-platform OF subs). Defaults to today (Athens) when date_range omitted. Use for questions like how many new subs did [model] get today, renewals, active fans, profile visitors, message/PPV counts, auto-renew health.",
    input_schema: {
      type: "object",
      properties: {
        model_name_or_id: {
          type: "string",
          description: "Model name (e.g. Lina, Diana) or record id (required)",
        },
        date_range: {
          type: "string",
          enum: ["today", "this_week", "last_week", "this_month", "last_month", "custom"],
          description: "Date range preset; defaults to today (Athens) when omitted",
        },
        start_ymd: { type: "string", description: "YYYY-MM-DD start when date_range=custom" },
        end_ymd: { type: "string", description: "YYYY-MM-DD end when date_range=custom" },
      },
      required: ["model_name_or_id"],
    },
  },
  {
    name: "get_model_persona",
    description:
      "Allowlisted Model Persona compact summary (never physique/intimate). Optional sections filter. For creative direction + chatting voice.",
    input_schema: {
      type: "object",
      properties: {
        model_name: {
          type: "string",
          description: "Model name (e.g. Lina, Diana) or record id (required)",
        },
        sections: {
          type: "array",
          items: { type: "string" },
          description: "Optional section keys e.g. bio, chatting, content, lifestyle, socials, live_updates",
        },
      },
      required: ["model_name"],
    },
  },
  {
    name: "list_personas",
    description:
      "List all personas: completeness, empty sections, last updated, live-update count. No persona text content.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_persona_live_updates",
    description: "List live updates for a model's persona (active + inactive). Max 7 active.",
    input_schema: {
      type: "object",
      properties: {
        model_name: { type: "string", description: "Model name or record id" },
      },
      required: ["model_name"],
    },
  },
  {
    name: "list_saved_ideas",
    description: "Saved Creative Studio ideas for a model (captions / text-on-screen).",
    input_schema: {
      type: "object",
      properties: {
        model_name: { type: "string" },
        idea_type: { type: "string", enum: ["caption", "text_on_screen"] },
        favourite_only: { type: "boolean" },
        thumbs: { type: "integer", enum: [-1, 1] },
      },
      required: ["model_name"],
    },
  },
  {
    name: "get_video_analyses",
    description:
      "Prior video analyses for a model — graded attire/platform_risk/hooks only. Never frames. For video file uploads, deep-link to Creative Studio Video Analyzer instead.",
    input_schema: {
      type: "object",
      properties: {
        model_name: { type: "string" },
        limit: { type: "integer" },
      },
      required: ["model_name"],
    },
  },
  {
    name: "lookup_instagram_post",
    description:
      "Lookup an Instagram post by permalink. Uses synced ClarioSuite data first. If not synced and Phase A Graph API unavailable, say so and suggest manual description path.",
    input_schema: {
      type: "object",
      properties: {
        link: { type: "string", description: "Instagram post/reel URL" },
        model_name: { type: "string", description: "Optional model filter" },
      },
      required: ["link"],
    },
  },
  {
    name: "get_top_performing_posts",
    description: "Top performing IG posts + winner submissions for grounded creative direction.",
    input_schema: {
      type: "object",
      properties: {
        model_name: { type: "string" },
        limit: { type: "integer" },
      },
      required: ["model_name"],
    },
  },
  {
    name: "generate_captions",
    description:
      "Generate platform-safe captions via the same Creative Studio pipeline (persona allowlist, avoid-words, red lines, cache, rate limits). Requires creative_studio:use. Returns variations for UI copy cards.",
    input_schema: {
      type: "object",
      properties: {
        model_name: { type: "string" },
        platform: { type: "string", description: "Default Instagram" },
        format: { type: "string", description: "e.g. Reel, Story" },
        idea_context: { type: "string" },
        tone_tweak: { type: "string" },
        variations: { type: "integer" },
        hashtag_count: { type: "integer" },
        output_language: { type: "string" },
      },
      required: ["model_name"],
    },
  },
  {
    name: "generate_text_on_screen",
    description: "Generate text-on-screen via Creative Studio (same guardrails as Studio).",
    input_schema: {
      type: "object",
      properties: {
        model_name: { type: "string" },
        idea_context: { type: "string" },
        tone_tweak: { type: "string" },
        max_chars: { type: "integer" },
        variations: { type: "integer" },
        output_language: { type: "string" },
      },
      required: ["model_name"],
    },
  },
  {
    name: "analyse_from_instagram_link",
    description:
      "Analyse a synced Instagram post cover for graded attire/platform_risk (same refusal handling as Video Analyzer). No raw frames returned. Video files → deep-link Creative Studio.",
    input_schema: {
      type: "object",
      properties: {
        link: { type: "string" },
        model_name: { type: "string" },
      },
      required: ["link", "model_name"],
    },
  },
  {
    name: "captions_from_description",
    description:
      "Manual path: generate captions from a text description of the video (when no file/cover). Same Studio caption pipeline.",
    input_schema: {
      type: "object",
      properties: {
        model_name: { type: "string" },
        description: { type: "string", description: "Manual description of the video/content" },
        platform: { type: "string" },
        format: { type: "string" },
        tone_tweak: { type: "string" },
        variations: { type: "integer" },
        output_language: { type: "string" },
      },
      required: ["model_name", "description"],
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
        model_record_id: {
          type: "string",
          description: "Optional model filter — name (e.g. Lina, Diana) or record id",
        },
      },
      required: [],
    },
  },
  {
    name: "get_link_analytics",
    description:
      "GetMySocial link-in-bio analytics for one model: Link A/B pageviews & button clicks, UV, CTR, shield/bot blocked %, device mix, hour-of-day visitor sample, DoD/WoW click trends, A/B winners (today/week/period), rule-based talking points, and IG reach → bio clicks → OF new subs/revenue funnel (alignment, not hard attribution). Pass model name (e.g. Lina, Diana) or record id. Date range via preset (this_week/this_month/…) or start_ymd+end_ymd. Use with get_instagram_insights_summary and get_model_revenue for cross-system funnel synthesis (high reach / low bio clicks, etc.).",
    input_schema: {
      type: "object",
      properties: {
        model_id: {
          type: "string",
          description: "Model name (e.g. Lina, Diana) or record id (required)",
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
        va_id: { type: "string", description: "Optional VA filter — full name or record id" },
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
        exec_va_id: { type: "string", description: "Optional VA filter — full name or record id" },
        creator_id: { type: "string", description: "Optional model filter — name or record id" },
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
        chatter_id: { type: "string", description: "Chatter full name or record id" },
        model_id: { type: "string", description: "Model name or record id" },
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
        model_id: { type: "string", description: "Optional model filter — name or record id" },
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
        model_id: { type: "string", description: "Optional filter for list mode — model name or record id" },
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
        model_id: { type: "string", description: "Optional model filter for accounts — name or record id" },
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
        model_id: { type: "string", description: "Optional model filter — name or record id" },
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
        model_id: { type: "string", description: "Model name (e.g. Lina, Diana) or record id" },
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
        chatter_id: { type: "string", description: "Chatter full name or record id" },
        chatter_name: { type: "string" },
        model_ids: {
          type: "array",
          items: { type: "string", description: "Model name or record id" },
        },
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
  {
    name: "create_persona",
    description: "Propose creating a skeleton persona for a model (non-sensitive). Requires Confirm.",
    input_schema: {
      type: "object",
      properties: { model_name: { type: "string" } },
      required: ["model_name"],
    },
  },
  {
    name: "update_persona_fields",
    description:
      "Propose updating non-sensitive persona fields. NEVER physique or intimate_details. Requires Confirm.",
    input_schema: {
      type: "object",
      properties: {
        model_name: { type: "string" },
        section: {
          type: "string",
          enum: ["bio", "personal_info", "chatting", "lifestyle", "content", "socials"],
        },
        fields: { type: "object", additionalProperties: true },
      },
      required: ["model_name", "section", "fields"],
    },
  },
  {
    name: "add_live_update",
    description: "Propose adding a live update (max 7 active). Requires Confirm.",
    input_schema: {
      type: "object",
      properties: {
        model_name: { type: "string" },
        content: { type: "string" },
        status: { type: "string" },
        starts_at: { type: "string" },
        ends_at: { type: "string" },
      },
      required: ["model_name", "content", "starts_at", "ends_at"],
    },
  },
  {
    name: "update_live_update",
    description: "Propose updating a live update. Requires Confirm.",
    input_schema: {
      type: "object",
      properties: {
        live_update_id: { type: "string" },
        content: { type: "string" },
        status: { type: "string" },
        starts_at: { type: "string" },
        ends_at: { type: "string" },
      },
      required: ["live_update_id"],
    },
  },
  {
    name: "deactivate_live_update",
    description: "Propose deactivating a live update (never delete). Requires Confirm.",
    input_schema: {
      type: "object",
      properties: { live_update_id: { type: "string" } },
      required: ["live_update_id"],
    },
  },
  {
    name: "save_ideas",
    description: "Propose saving caption/TOS idea(s) to Creative Studio. Batch OK. Requires Confirm.",
    input_schema: {
      type: "object",
      properties: {
        model_name: { type: "string" },
        ideas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              content: { type: "string" },
              idea_type: { type: "string", enum: ["caption", "text_on_screen"] },
              platform: { type: "string" },
              title: { type: "string" },
            },
            required: ["content"],
          },
        },
      },
      required: ["model_name", "ideas"],
    },
  },
  {
    name: "rate_idea",
    description: "Propose thumbs/favourite on saved ideas (batch OK). Requires Confirm.",
    input_schema: {
      type: "object",
      properties: {
        idea_id: { type: "string" },
        idea_ids: { type: "array", items: { type: "string" } },
        thumbs: { type: "integer", enum: [-1, 0, 1] },
        is_favourite: { type: "boolean" },
      },
    },
  },
  {
    name: "create_posting_brief_draft",
    description:
      "Propose creating a posting brief without VA notification (draft-like). Requires Confirm.",
    input_schema: {
      type: "object",
      properties: {
        model_name: { type: "string" },
        title: { type: "string" },
        caption: { type: "string" },
        text_on_screen: { type: "string" },
        account_handle: { type: "string" },
        content_type: { type: "string" },
        instructions_notes: { type: "string" },
      },
      required: ["model_name", "title"],
    },
  },
  {
    name: "add_post_to_posting_brief_draft",
    description: "Propose adding a caption/TOS row to an existing posting brief. Requires Confirm.",
    input_schema: {
      type: "object",
      properties: {
        brief_id: { type: "string" },
        caption: { type: "string" },
        text_on_screen: { type: "string" },
        video_name: { type: "string" },
      },
      required: ["brief_id"],
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
- CALL READ tools for live analytics and ops: chatter/model revenue, subscriber stats, Instagram, GetMySocial links, VA stats, timers, spot checks, mistakes, applications, winners, weekly program, Password Library metadata, Marketing Control Room, Bunch pipeline, SOP completion, Client Partnership.
- Model Personas + AI Creative Studio (same services/guardrails as the product UI):
  - READ: list_personas, get_model_persona, get_persona_live_updates, list_saved_ideas, get_video_analyses, lookup_instagram_post, get_top_performing_posts
  - GENERATE (immediate, no stored writes): generate_captions, generate_text_on_screen, analyse_from_instagram_link, captions_from_description — require creative_studio:use
  - ACTION (Confirm): create_persona, update_persona_fields, add/update/deactivate_live_update, save_ideas, rate_idea, create_posting_brief_draft, add_post_to_posting_brief_draft
- Creative direction: combine allowlisted persona + top posts + winners + weekly IG insights + link funnel; cite tools used; stay platform-safe. Ask which model if ambiguous (Greek Lina vs Lina USA).
- Video FILES: do not accept uploads in chat — deep-link to Creative Studio Video Analyzer (\`/creative-studio?model=ID&tab=analyzer\`).
- PROPOSE ACTION tools for curated writes. Every action needs human Confirm — you never execute writes yourself.

## Names vs IDs
- Pass **model names** and **chatter/VA names** naturally — the system resolves them to record ids.
- Never ask for raw record ids unless resolution failed with no close match.
- If ambiguous_entity, ask a short clarifying question with real options (e.g. Greek **Lina** vs **Lina (USA)**). Never guess.
- If entity_not_found, say so and offer closest suggestions.

## Cross-system synthesis
- Call multiple READ tools in one turn when useful. Cite tools. Do not re-call the same READ with identical args in one turn.
- Weave into one narrative. For open-ended strategy, pull relevant READs then offer grounded observations.

## Hard refusals (do NOT attempt)
- Physique / Intimate Details — even for view_sensitive users (would pass through AI). Point to persona editor.
- Delete anything (personas, ideas, analyses, live updates: deactivate only)
- Identify a person from an image/face; raw video frames; explicit sexual output
- Generate without valid 18+ birth date; bypass avoid-words / red lines / platform-safe
- Password/credential VALUES; roles & permissions; payouts; hire status; ops outside tools

If asked for a prohibited operation, refuse in one short sentence and suggest the correct admin screen.

## Style
- Clear, concise, human. Prefer short bullets for numbers. Real markdown when helpful.
- Section headings when relevant: ## Analytics / ## Actions / ## Restrictions
- Date presets preferred. Do not re-list the full capability menu every turn.`;
