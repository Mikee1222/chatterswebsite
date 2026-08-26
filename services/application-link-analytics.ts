/**
 * Application link funnel analytics — insert events + aggregate for admin dashboard.
 * Service-role only (RLS on, no anon policies).
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import {
  APPLICATION_FUNNEL_STAGE_LABELS,
  type ApplicationAnalyticsInsightRecord,
  type ApplicationFunnelStage,
  type ApplicationFunnelStageKey,
  type ApplicationFunnelStepName,
  type ApplicationLinkAnalyticsSummary,
  type ApplicationLinkDeviceType,
  type ApplicationLinkEventType,
} from "@/lib/application-link-analytics-types";
import { getEnabledPipelineSteps } from "@/lib/application-forms-types";

const T_EVENTS = "application_link_analytics";
const T_INSIGHTS = "application_form_analytics_insights";

const DEVICE_TYPES = new Set<ApplicationLinkDeviceType>([
  "desktop",
  "mobile",
  "tablet",
  "unknown",
]);

function normalizeDevice(v: unknown): ApplicationLinkDeviceType {
  if (typeof v === "string" && DEVICE_TYPES.has(v as ApplicationLinkDeviceType)) {
    return v as ApplicationLinkDeviceType;
  }
  return "unknown";
}

function sanitizeReferrer(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim().slice(0, 500);
  try {
    const u = new URL(trimmed);
    // Host + path only — strip query/hash that may contain tokens
    return `${u.origin}${u.pathname}`.slice(0, 500);
  } catch {
    return trimmed.slice(0, 200);
  }
}

export async function recordApplicationLinkEvent(input: {
  formId: string;
  sessionId: string;
  eventType: ApplicationLinkEventType;
  stepName?: string | null;
  deviceType?: ApplicationLinkDeviceType | null;
  referrer?: string | null;
}): Promise<void> {
  const sessionId = input.sessionId.trim().slice(0, 128);
  if (!sessionId) return;

  const sb = getSupabaseServiceClient();
  const row = {
    form_id: input.formId,
    session_id: sessionId,
    event_type: input.eventType,
    step_name: input.stepName?.trim().slice(0, 64) || null,
    device_type: normalizeDevice(input.deviceType),
    referrer: sanitizeReferrer(input.referrer),
  };

  const { error } = await sb.from(T_EVENTS).insert(row);
  if (error) {
    console.error("[application-link-analytics] insert failed", error.message);
    throw new Error(error.message);
  }
}

type RawEvent = {
  session_id: string;
  event_type: ApplicationLinkEventType;
  step_name: string | null;
  device_type: ApplicationLinkDeviceType;
  created_at: string;
};

function rangeStart(preset: ApplicationLinkAnalyticsSummary["range"]["preset"]): Date | null {
  if (preset === "all") return null;
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function uniqueSessions(
  events: RawEvent[],
  predicate: (e: RawEvent) => boolean,
): Set<string> {
  const set = new Set<string>();
  for (const e of events) {
    if (predicate(e)) set.add(e.session_id);
  }
  return set;
}

function buildFunnel(
  events: RawEvent[],
  enabledSteps?: {
    cognitive: boolean;
    eq: boolean;
    typing: boolean;
  },
): {
  stages: ApplicationFunnelStage[];
  mostLossy: ApplicationLinkAnalyticsSummary["most_lossy_step"];
} {
  const views = uniqueSessions(events, (e) => e.event_type === "page_view");
  const started = uniqueSessions(events, (e) => e.event_type === "started");
  const cognitive = uniqueSessions(
    events,
    (e) =>
      e.event_type === "step_complete" && e.step_name === "cognitive_screening",
  );
  const eq = uniqueSessions(
    events,
    (e) => e.event_type === "step_complete" && e.step_name === "eq_screening",
  );
  const typing = uniqueSessions(
    events,
    (e) =>
      e.event_type === "step_complete" && e.step_name === "typing_speed_test",
  );
  const submitted = uniqueSessions(events, (e) => e.event_type === "submitted");

  const en = enabledSteps ?? { cognitive: true, eq: true, typing: true };

  const counts: Record<ApplicationFunnelStageKey, number> = {
    view: views.size,
    started: started.size,
    cognitive: en.cognitive ? cognitive.size : started.size,
    eq: 0,
    typing: 0,
    submitted: submitted.size,
  };
  // Passthrough disabled steps so the funnel stays monotonic.
  counts.eq = en.eq ? eq.size : counts.cognitive;
  counts.typing = en.typing ? typing.size : counts.eq;

  const order = Object.keys(APPLICATION_FUNNEL_STAGE_LABELS) as ApplicationFunnelStageKey[];
  const stages: ApplicationFunnelStage[] = order.map((key, i) => {
    const count = counts[key];
    const prev = i > 0 ? counts[order[i - 1]!] : null;
    let drop_off_pct: number | null = null;
    let conversion_from_prev_pct: number | null = null;
    if (prev != null && prev > 0) {
      conversion_from_prev_pct = Math.round((count / prev) * 1000) / 10;
      drop_off_pct = Math.round(((prev - count) / prev) * 1000) / 10;
    }
    return {
      key,
      label: APPLICATION_FUNNEL_STAGE_LABELS[key],
      count,
      drop_off_pct,
      conversion_from_prev_pct,
    };
  });

  let mostLossy: ApplicationLinkAnalyticsSummary["most_lossy_step"] = null;
  for (let i = 1; i < stages.length; i++) {
    const from = stages[i - 1]!;
    const to = stages[i]!;
    // Skip "fake" drop-offs on disabled passthrough stages (0 loss).
    const lost = Math.max(0, from.count - to.count);
    if (from.count <= 0 || lost <= 0) continue;
    const drop_off_pct = Math.round((lost / from.count) * 1000) / 10;
    if (!mostLossy || lost > mostLossy.lost) {
      mostLossy = { from: from.key, to: to.key, lost, drop_off_pct };
    }
  }

  return { stages, mostLossy };
}

function avgCompleteSeconds(events: RawEvent[]): number | null {
  const bySession = new Map<string, { started?: number; submitted?: number }>();
  for (const e of events) {
    if (e.event_type !== "started" && e.event_type !== "submitted") continue;
    const cur = bySession.get(e.session_id) ?? {};
    const t = new Date(e.created_at).getTime();
    if (e.event_type === "started") {
      if (cur.started == null || t < cur.started) cur.started = t;
    } else {
      if (cur.submitted == null || t < cur.submitted) cur.submitted = t;
    }
    bySession.set(e.session_id, cur);
  }
  const durations: number[] = [];
  for (const cur of bySession.values()) {
    if (cur.started == null || cur.submitted == null) continue;
    const d = (cur.submitted - cur.started) / 1000;
    if (d >= 30 && d <= 6 * 60 * 60) durations.push(d);
  }
  if (!durations.length) return null;
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  return Math.round(avg);
}

function buildTimeSeries(
  events: RawEvent[],
  granularity: "day" | "week",
): ApplicationLinkAnalyticsSummary["time_series"] {
  const bucket = new Map<string, { views: Set<string>; apps: Set<string> }>();

  const keyFor = (iso: string): string => {
    const d = new Date(iso);
    if (granularity === "day") {
      return d.toISOString().slice(0, 10);
    }
    // ISO week: Monday start
    const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dow = day.getUTCDay() || 7;
    day.setUTCDate(day.getUTCDate() - dow + 1);
    return day.toISOString().slice(0, 10);
  };

  for (const e of events) {
    if (e.event_type !== "page_view" && e.event_type !== "submitted") continue;
    const k = keyFor(e.created_at);
    let entry = bucket.get(k);
    if (!entry) {
      entry = { views: new Set(), apps: new Set() };
      bucket.set(k, entry);
    }
    if (e.event_type === "page_view") entry.views.add(e.session_id);
    else entry.apps.add(e.session_id);
  }

  const points = [...bucket.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      views: v.views.size,
      applications: v.apps.size,
    }));

  return { granularity, points };
}

function buildDevices(
  events: RawEvent[],
): ApplicationLinkAnalyticsSummary["devices"] {
  // Prefer first page_view device per session; fall back to any event
  const perSession = new Map<string, ApplicationLinkDeviceType>();
  const ordered = [...events].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  for (const e of ordered) {
    if (perSession.has(e.session_id)) continue;
    if (e.event_type === "page_view" || e.event_type === "started") {
      perSession.set(e.session_id, normalizeDevice(e.device_type));
    }
  }
  for (const e of ordered) {
    if (!perSession.has(e.session_id)) {
      perSession.set(e.session_id, normalizeDevice(e.device_type));
    }
  }

  const counts: Record<ApplicationLinkDeviceType, number> = {
    desktop: 0,
    mobile: 0,
    tablet: 0,
    unknown: 0,
  };
  for (const d of perSession.values()) counts[d] += 1;
  const total = Math.max(1, perSession.size);
  return (Object.keys(counts) as ApplicationLinkDeviceType[])
    .filter((d) => counts[d] > 0)
    .map((device) => ({
      device,
      count: counts[device],
      pct: Math.round((counts[device] / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);
}

function insightIsStale(generatedAt: string | null): boolean {
  if (!generatedAt) return true;
  const ageMs = Date.now() - new Date(generatedAt).getTime();
  return ageMs > 24 * 60 * 60 * 1000;
}

export async function getApplicationAnalyticsInsight(
  formId: string,
): Promise<ApplicationAnalyticsInsightRecord | null> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(T_INSIGHTS)
    .select("*")
    .eq("form_id", formId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    form_id: data.form_id,
    insight_text: data.insight_text,
    funnel_snapshot: (data.funnel_snapshot ?? {}) as Record<string, unknown>,
    model: data.model ?? null,
    generated_at: data.generated_at,
    updated_at: data.updated_at,
  };
}

export async function upsertApplicationAnalyticsInsight(input: {
  formId: string;
  insightText: string;
  funnelSnapshot: Record<string, unknown>;
  model: string | null;
}): Promise<ApplicationAnalyticsInsightRecord> {
  const sb = getSupabaseServiceClient();
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from(T_INSIGHTS)
    .upsert(
      {
        form_id: input.formId,
        insight_text: input.insightText,
        funnel_snapshot: input.funnelSnapshot,
        model: input.model,
        generated_at: now,
        updated_at: now,
      },
      { onConflict: "form_id" },
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return {
    form_id: data.form_id,
    insight_text: data.insight_text,
    funnel_snapshot: (data.funnel_snapshot ?? {}) as Record<string, unknown>,
    model: data.model ?? null,
    generated_at: data.generated_at,
    updated_at: data.updated_at,
  };
}

export async function getApplicationLinkAnalyticsSummary(input: {
  formId: string;
  preset?: ApplicationLinkAnalyticsSummary["range"]["preset"];
  granularity?: "day" | "week";
  pipelineConfig?: { step: string; enabled: boolean }[] | null;
}): Promise<ApplicationLinkAnalyticsSummary> {
  const preset = input.preset ?? "30d";
  const granularity = input.granularity ?? (preset === "7d" ? "day" : "day");
  const from = rangeStart(preset);

  const sb = getSupabaseServiceClient();
  let q = sb
    .from(T_EVENTS)
    .select("session_id, event_type, step_name, device_type, created_at")
    .eq("form_id", input.formId)
    .order("created_at", { ascending: true })
    .limit(50000);

  if (from) {
    q = q.gte("created_at", from.toISOString());
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const events = (data ?? []) as RawEvent[];

  let enabledSteps = { cognitive: true, eq: true, typing: true };
  if (input.pipelineConfig) {
    const enabled = new Set(
      getEnabledPipelineSteps(
        input.pipelineConfig as Parameters<typeof getEnabledPipelineSteps>[0],
      ).map((s) => s.step),
    );
    enabledSteps = {
      cognitive: enabled.has("cognitive_screening"),
      eq: enabled.has("eq_screening"),
      typing: enabled.has("typing_speed_test"),
    };
  }

  const { stages, mostLossy } = buildFunnel(events, enabledSteps);
  const views = stages.find((s) => s.key === "view")?.count ?? 0;
  const started = stages.find((s) => s.key === "started")?.count ?? 0;
  const completed = stages.find((s) => s.key === "submitted")?.count ?? 0;
  const completion_rate_pct =
    started > 0 ? Math.round((completed / started) * 1000) / 10 : null;

  const insight = await getApplicationAnalyticsInsight(input.formId);

  return {
    form_id: input.formId,
    range: {
      from: from?.toISOString() ?? null,
      to: new Date().toISOString(),
      preset,
    },
    totals: {
      views,
      started,
      completed,
      completion_rate_pct,
      avg_time_to_complete_seconds: avgCompleteSeconds(events),
    },
    funnel: stages,
    most_lossy_step: mostLossy,
    time_series: buildTimeSeries(events, granularity === "week" ? "week" : "day"),
    devices: buildDevices(events),
    insight: {
      text: insight?.insight_text ?? null,
      generated_at: insight?.generated_at ?? null,
      model: insight?.model ?? null,
      stale: insightIsStale(insight?.generated_at ?? null),
    },
  };
}

/** Snapshot payload for AI — numbers only, no PII. */
export function buildAnalyticsInsightSnapshot(
  summary: ApplicationLinkAnalyticsSummary,
): Record<string, unknown> {
  return {
    range: summary.range,
    totals: summary.totals,
    funnel: summary.funnel.map((s) => ({
      key: s.key,
      label: s.label,
      count: s.count,
      drop_off_pct: s.drop_off_pct,
      conversion_from_prev_pct: s.conversion_from_prev_pct,
    })),
    most_lossy_step: summary.most_lossy_step,
    devices: summary.devices,
    time_series_points: summary.time_series.points.length,
    sample_note:
      summary.totals.views < 30
        ? "small_sample"
        : summary.totals.views < 100
          ? "moderate_sample"
          : "adequate_sample",
  };
}

export type { ApplicationFunnelStepName };
