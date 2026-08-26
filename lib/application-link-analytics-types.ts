/** Funnel / traffic analytics for public application form links. */

export const APPLICATION_LINK_EVENT_TYPES = [
  "page_view",
  "started",
  "step_complete",
  "submitted",
  "abandoned",
] as const;

export type ApplicationLinkEventType = (typeof APPLICATION_LINK_EVENT_TYPES)[number];

export const APPLICATION_FUNNEL_STEP_NAMES = [
  "cognitive_screening",
  "eq_screening",
  "typing_speed_test",
  "application_form",
] as const;

export type ApplicationFunnelStepName = (typeof APPLICATION_FUNNEL_STEP_NAMES)[number];

export const APPLICATION_FUNNEL_STAGE_KEYS = [
  "view",
  "started",
  "cognitive",
  "eq",
  "typing",
  "submitted",
] as const;

export type ApplicationFunnelStageKey = (typeof APPLICATION_FUNNEL_STAGE_KEYS)[number];

export const APPLICATION_FUNNEL_STAGE_LABELS: Record<ApplicationFunnelStageKey, string> = {
  view: "View",
  started: "Started",
  cognitive: "Cognitive",
  eq: "EQ",
  typing: "Typing",
  submitted: "Form Submitted",
};

export type ApplicationLinkDeviceType = "desktop" | "mobile" | "tablet" | "unknown";

export type ApplicationLinkAnalyticsRow = {
  id: string;
  form_id: string;
  session_id: string;
  event_type: ApplicationLinkEventType;
  step_name: string | null;
  device_type: ApplicationLinkDeviceType;
  referrer: string | null;
  created_at: string;
};

export type ApplicationFunnelStage = {
  key: ApplicationFunnelStageKey;
  label: string;
  count: number;
  /** Drop-off % from previous stage (null for first). */
  drop_off_pct: number | null;
  /** Conversion % from previous stage. */
  conversion_from_prev_pct: number | null;
};

export type ApplicationLinkAnalyticsSummary = {
  form_id: string;
  range: { from: string | null; to: string | null; preset: "7d" | "30d" | "90d" | "all" };
  totals: {
    views: number;
    started: number;
    completed: number;
    completion_rate_pct: number | null;
    avg_time_to_complete_seconds: number | null;
  };
  funnel: ApplicationFunnelStage[];
  /** Step with largest absolute session loss between consecutive stages. */
  most_lossy_step: {
    from: ApplicationFunnelStageKey;
    to: ApplicationFunnelStageKey;
    lost: number;
    drop_off_pct: number;
  } | null;
  time_series: {
    granularity: "day" | "week";
    points: { date: string; views: number; applications: number }[];
  };
  devices: { device: ApplicationLinkDeviceType; count: number; pct: number }[];
  insight: {
    text: string | null;
    generated_at: string | null;
    model: string | null;
    stale: boolean;
  };
};

export type ApplicationAnalyticsInsightRecord = {
  form_id: string;
  insight_text: string;
  funnel_snapshot: Record<string, unknown>;
  model: string | null;
  generated_at: string;
  updated_at: string;
};

export function isApplicationLinkEventType(v: unknown): v is ApplicationLinkEventType {
  return (
    typeof v === "string" &&
    (APPLICATION_LINK_EVENT_TYPES as readonly string[]).includes(v)
  );
}

export function isApplicationFunnelStepName(v: unknown): v is ApplicationFunnelStepName {
  return (
    typeof v === "string" &&
    (APPLICATION_FUNNEL_STEP_NAMES as readonly string[]).includes(v)
  );
}
