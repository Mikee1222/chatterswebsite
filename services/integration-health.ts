/**
 * Integration health dashboard — status for Infloww, ClarioSuite, Anthropic, Supabase.
 */

import {
  NOTIFICATION_ENTITY,
  NOTIFICATION_EVENT,
  NOTIFICATION_PRIORITY,
} from "@/lib/notification-types";
import { EVENT_TYPE_TO_AIRTABLE } from "@/lib/notifications-schema";
import { notifyAdminsOnce } from "@/services/notification-service";
import { findExistingNotification } from "@/services/notifications";
import { getDataBackend } from "@/lib/data-backend";
import { isClarioSuiteConfigured } from "@/lib/clariosuite-api";
import { isGetMySocialConfigured } from "@/lib/getmysocial-api";
import { inflowwReportTodayYmd } from "@/lib/infloww-api";
import { addDaysAthensYmd } from "@/lib/airtable-datetime";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

export type IntegrationId =
  | "infloww"
  | "clariosuite"
  | "getmysocial"
  | "anthropic"
  | "supabase";

export type IntegrationHealthStatus = "green" | "amber" | "red";

export type IntegrationHealthCard = {
  id: IntegrationId;
  name: string;
  description: string;
  status: IntegrationHealthStatus;
  lastSyncedAt: string | null;
  rowCount: number | null;
  message: string;
  alerts: string[];
  canTest: boolean;
  canSync: boolean;
};

export type IntegrationHealthSnapshot = {
  generatedAt: string;
  cards: IntegrationHealthCard[];
};

function hoursSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60);
}

function statusFromAge(
  hours: number | null,
  opts: { amberAfter: number; redAfter: number; missingIsRed?: boolean },
): IntegrationHealthStatus {
  if (hours == null) return opts.missingIsRed === false ? "amber" : "red";
  if (hours >= opts.redAfter) return "red";
  if (hours >= opts.amberAfter) return "amber";
  return "green";
}

async function countTable(table: string): Promise<number | null> {
  try {
    const sb = getSupabaseServiceClient();
    const { count, error } = await sb.from(table).select("id", { count: "exact", head: true });
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

async function latestSyncedAt(table: string, column = "synced_at"): Promise<string | null> {
  try {
    const sb = getSupabaseServiceClient();
    const { data, error } = await sb
      .from(table)
      .select(column)
      .not(column, "is", null)
      .order(column, { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const v = (data as unknown as Record<string, unknown>)[column];
    return typeof v === "string" && v.trim() ? v : null;
  } catch {
    return null;
  }
}

export async function getIntegrationHealthSnapshot(): Promise<IntegrationHealthSnapshot> {
  const hasInflowwKey = Boolean(
    process.env["INFLOWW_API_KEY"]?.trim() && process.env["INFLOWW_AGENCY_OID"]?.trim(),
  );
  const hasClario = isClarioSuiteConfigured();
  const hasGetMySocial = isGetMySocialConfigured();
  const hasAnthropic = Boolean(process.env["ANTHROPIC_API_KEY"]?.trim());
  const hasSupabase = Boolean(
    process.env["SUPABASE_URL"]?.trim() || process.env["NEXT_PUBLIC_SUPABASE_URL"]?.trim(),
  );
  const backend = getDataBackend();

  const [
    inflowwStatsCount,
    inflowwEarningsCount,
    inflowwLastStats,
    inflowwLastEarnings,
    clarioDailyCount,
    clarioLast,
    gmsDailyCount,
    gmsLast,
    aiCacheCount,
    aiLast,
  ] = await Promise.all([
    countTable("infloww_daily_stats"),
    countTable("infloww_creator_daily_earnings"),
    latestSyncedAt("infloww_daily_stats"),
    latestSyncedAt("infloww_creator_daily_earnings"),
    countTable("clariosuite_daily_insights"),
    latestSyncedAt("clariosuite_daily_insights"),
    countTable("getmysocial_daily_analytics"),
    latestSyncedAt("getmysocial_daily_analytics"),
    countTable("ai_feature_cache"),
    latestSyncedAt("ai_feature_cache", "generated_at"),
  ]);

  const inflowwLast =
    [inflowwLastStats, inflowwLastEarnings]
      .filter(Boolean)
      .sort()
      .reverse()[0] ?? null;
  const inflowwHours = hoursSince(inflowwLast);
  const inflowwAlerts: string[] = [];
  if (!hasInflowwKey) inflowwAlerts.push("INFLOWW_API_KEY or INFLOWW_AGENCY_OID is missing.");
  if (hasInflowwKey && inflowwHours != null && inflowwHours > 36) {
    inflowwAlerts.push("No successful Infloww sync in over 36 hours.");
  }
  if (hasInflowwKey && (inflowwStatsCount ?? 0) === 0) {
    inflowwAlerts.push("Infloww daily stats table is empty — trigger a sync.");
  }
  let inflowwStatus: IntegrationHealthStatus = "green";
  if (!hasInflowwKey) inflowwStatus = "red";
  else inflowwStatus = statusFromAge(inflowwHours, { amberAfter: 18, redAfter: 48, missingIsRed: true });

  const clarioHours = hoursSince(clarioLast);
  const clarioAlerts: string[] = [];
  if (!hasClario) clarioAlerts.push("CLARIOSUITE_API_KEY is missing.");
  if (hasClario && clarioHours != null && clarioHours > 48) {
    clarioAlerts.push("ClarioSuite insights look stale (>48h since last sync).");
  }
  if (hasClario && (clarioDailyCount ?? 0) === 0) {
    clarioAlerts.push("No ClarioSuite daily insights rows yet — run a sync.");
  }
  let clarioStatus: IntegrationHealthStatus = "green";
  if (!hasClario) clarioStatus = "red";
  else clarioStatus = statusFromAge(clarioHours, { amberAfter: 30, redAfter: 72, missingIsRed: false });

  const gmsHours = hoursSince(gmsLast);
  const gmsAlerts: string[] = [];
  if (!hasGetMySocial) gmsAlerts.push("GETMYSOCIAL_API_KEY is missing.");
  if (hasGetMySocial && gmsHours != null && gmsHours > 48) {
    gmsAlerts.push("GetMySocial analytics look stale (>48h since last sync).");
  }
  if (hasGetMySocial && (gmsDailyCount ?? 0) === 0) {
    gmsAlerts.push("No GetMySocial daily analytics rows yet — link models and run a sync.");
  }
  let gmsStatus: IntegrationHealthStatus = "green";
  if (!hasGetMySocial) gmsStatus = "red";
  else gmsStatus = statusFromAge(gmsHours, { amberAfter: 30, redAfter: 72, missingIsRed: false });

  const anthropicAlerts: string[] = [];
  if (!hasAnthropic) anthropicAlerts.push("ANTHROPIC_API_KEY is missing — AI features will fail.");
  const anthropicStatus: IntegrationHealthStatus = !hasAnthropic
    ? "red"
    : (aiCacheCount ?? 0) > 0
      ? "green"
      : "amber";

  const supabaseAlerts: string[] = [];
  if (!hasSupabase) supabaseAlerts.push("Supabase URL env vars are not configured.");
  if (backend !== "supabase") {
    supabaseAlerts.push(`DATA_BACKEND is currently "${backend}" (not supabase).`);
  }
  let supabaseStatus: IntegrationHealthStatus = "green";
  if (!hasSupabase) supabaseStatus = "red";
  else if (backend !== "supabase") supabaseStatus = "amber";

  // Light connectivity probe
  if (hasSupabase) {
    try {
      const sb = getSupabaseServiceClient();
      const { error } = await sb.from("modelss").select("id", { count: "exact", head: true }).limit(1);
      if (error) {
        supabaseStatus = "red";
        supabaseAlerts.push(`Supabase query failed: ${error.message}`);
      }
    } catch (e) {
      supabaseStatus = "red";
      supabaseAlerts.push(e instanceof Error ? e.message : "Supabase connection failed");
    }
  }

  const cards: IntegrationHealthCard[] = [
    {
      id: "infloww",
      name: "Infloww",
      description: "Creator earnings, chatter daily stats, status log",
      status: inflowwStatus,
      lastSyncedAt: inflowwLast,
      rowCount: (inflowwStatsCount ?? 0) + (inflowwEarningsCount ?? 0),
      message: hasInflowwKey
        ? inflowwLast
          ? `Last sync ${inflowwLast}`
          : "Configured — awaiting first sync"
        : "API credentials missing",
      alerts: inflowwAlerts,
      canTest: true,
      canSync: true,
    },
    {
      id: "clariosuite",
      name: "ClarioSuite",
      description: "Instagram insights, audience, top posts",
      status: clarioStatus,
      lastSyncedAt: clarioLast,
      rowCount: clarioDailyCount,
      message: hasClario
        ? clarioLast
          ? `Last sync ${clarioLast}`
          : "Configured — awaiting first sync"
        : "API key missing",
      alerts: clarioAlerts,
      canTest: true,
      canSync: true,
    },
    {
      id: "getmysocial",
      name: "GetMySocial",
      description: "Link-in-bio analytics, Link A/B, referrers",
      status: gmsStatus,
      lastSyncedAt: gmsLast,
      rowCount: gmsDailyCount,
      message: hasGetMySocial
        ? gmsLast
          ? `Last sync ${gmsLast}`
          : "Configured — awaiting first sync"
        : "API key missing",
      alerts: gmsAlerts,
      canTest: true,
      canSync: true,
    },
    {
      id: "anthropic",
      name: "Anthropic",
      description: "AI narratives, Gunzo Agent, monthly reports",
      status: anthropicStatus,
      lastSyncedAt: aiLast,
      rowCount: aiCacheCount,
      message: hasAnthropic
        ? "API key present"
        : "ANTHROPIC_API_KEY missing",
      alerts: anthropicAlerts,
      canTest: true,
      canSync: false,
    },
    {
      id: "supabase",
      name: "Supabase",
      description: `Primary data store (backend: ${backend})`,
      status: supabaseStatus,
      lastSyncedAt: null,
      rowCount: null,
      message: hasSupabase ? `Connected · DATA_BACKEND=${backend}` : "Not configured",
      alerts: supabaseAlerts,
      canTest: true,
      canSync: false,
    },
  ];

  return { generatedAt: new Date().toISOString(), cards };
}

export async function testIntegrationConnection(
  id: IntegrationId,
): Promise<{ ok: boolean; message: string }> {
  if (id === "infloww") {
    if (!process.env["INFLOWW_API_KEY"]?.trim()) {
      return { ok: false, message: "INFLOWW_API_KEY missing" };
    }
    try {
      const { getInflowwModels } = await import("@/lib/infloww-api");
      const creators = await getInflowwModels();
      return { ok: true, message: `OK — ${creators.length} creators reachable` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Infloww test failed" };
    }
  }
  if (id === "clariosuite") {
    if (!isClarioSuiteConfigured()) {
      return { ok: false, message: "CLARIOSUITE_API_KEY missing" };
    }
    try {
      const { getClarioSuiteMe } = await import("@/lib/clariosuite-api");
      const me = await getClarioSuiteMe();
      return { ok: true, message: `OK — ClarioSuite key ${me?.name ?? me?.keyId ?? "reachable"}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "ClarioSuite test failed" };
    }
  }
  if (id === "getmysocial") {
    if (!isGetMySocialConfigured()) {
      return { ok: false, message: "GETMYSOCIAL_API_KEY missing" };
    }
    try {
      const { getGetMySocialPing } = await import("@/lib/getmysocial-api");
      const ping = await getGetMySocialPing();
      return {
        ok: ping.ok === true,
        message: ping.ok
          ? `OK — GetMySocial user ${ping.user_id}`
          : "GetMySocial ping failed",
      };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "GetMySocial test failed" };
    }
  }
  if (id === "anthropic") {
    if (!process.env["ANTHROPIC_API_KEY"]?.trim()) {
      return { ok: false, message: "ANTHROPIC_API_KEY missing" };
    }
    try {
      const { callAnthropic } = await import("@/lib/ai-assistant");
      const result = await callAnthropic({
        messages: [{ role: "user", content: "Reply with exactly: ok" }],
        maxTokens: 8,
        temperature: 0,
        logLabel: "integration-health-test",
      });
      if (!result) return { ok: false, message: "Anthropic returned empty response" };
      return { ok: true, message: `OK — model ${result.model}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Anthropic test failed" };
    }
  }
  if (id === "supabase") {
    try {
      const sb = getSupabaseServiceClient();
      const { error } = await sb.from("modelss").select("id", { head: true, count: "exact" }).limit(1);
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: `OK — backend=${getDataBackend()}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Supabase test failed" };
    }
  }
  return { ok: false, message: "Unknown integration" };
}

export async function triggerIntegrationSync(
  id: IntegrationId,
): Promise<{ ok: boolean; message: string }> {
  if (id === "infloww") {
    try {
      const { syncInflowwDailyStats } = await import("@/services/infloww-daily-stats");
      const end = inflowwReportTodayYmd();
      const start = addDaysAthensYmd(end, -1);
      const result = await syncInflowwDailyStats({ startYmd: start, endYmd: end });
      return {
        ok: true,
        message: `Infloww stats synced (${start} → ${end})${result ? "" : ""}`,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Infloww sync failed";
      await notifyIntegrationFailure("infloww", msg, "sync");
      return { ok: false, message: msg };
    }
  }
  if (id === "clariosuite") {
    try {
      const { syncClarioSuiteInsights } = await import("@/services/clariosuite-sync");
      const result = await syncClarioSuiteInsights({});
      if (result.skipped) {
        const msg = result.skipReason ?? "ClarioSuite sync skipped";
        await notifyIntegrationFailure("clariosuite", msg, "sync");
        return { ok: false, message: msg };
      }
      return { ok: true, message: "ClarioSuite insights sync completed" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ClarioSuite sync failed";
      await notifyIntegrationFailure("clariosuite", msg, "sync");
      return { ok: false, message: msg };
    }
  }
  if (id === "getmysocial") {
    try {
      const { syncGetMySocialAnalytics } = await import("@/services/getmysocial-sync");
      const result = await syncGetMySocialAnalytics();
      if (result.skipped) {
        const msg = result.skipReason ?? "GetMySocial sync skipped";
        await notifyIntegrationFailure("getmysocial", msg, "sync");
        return { ok: false, message: msg };
      }
      return {
        ok: result.errors.length === 0,
        message: `GetMySocial sync: ${result.linksTargeted} links, ${result.analyticsRowsUpserted} daily rows`,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "GetMySocial sync failed";
      await notifyIntegrationFailure("getmysocial", msg, "sync");
      return { ok: false, message: msg };
    }
  }
  return { ok: false, message: "This integration does not support manual sync" };
}

export async function notifyIntegrationFailure(
  id: IntegrationId,
  detail: string,
  kind: "sync" | "api_key",
): Promise<void> {
  const event =
    kind === "api_key"
      ? NOTIFICATION_EVENT.INTEGRATION_API_KEY_ISSUE
      : NOTIFICATION_EVENT.INTEGRATION_SYNC_FAILED;
  const title =
    kind === "api_key"
      ? `${id}: API key issue`
      : `${id}: sync failed`;
  const dedupeId = `integration-${kind}-${id}-${new Date().toISOString().slice(0, 10)}`;
  await notifyAdminsOnce(
    {
      event_type: event,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title,
      body: detail.slice(0, 400),
      entity_type: NOTIFICATION_ENTITY.INTEGRATION,
      entity_id: dedupeId,
      actor_name: "Integration Health",
    },
    (userId) =>
      findExistingNotification(
        userId,
        NOTIFICATION_ENTITY.INTEGRATION,
        dedupeId,
        EVENT_TYPE_TO_AIRTABLE[event] ?? event,
      ),
  ).catch((err) => console.error("[integration-health] notify failed", err));
}

/** Scan health and emit proactive alerts for known red issues (deduped daily). */
export async function emitIntegrationHealthAlerts(
  snapshot?: IntegrationHealthSnapshot,
): Promise<void> {
  const snap = snapshot ?? (await getIntegrationHealthSnapshot());
  for (const card of snap.cards) {
    if (card.status !== "red") continue;
    const apiKeyIssue = card.alerts.some((a) =>
      /missing|API key|credentials/i.test(a),
    );
    await notifyIntegrationFailure(
      card.id,
      card.alerts[0] ?? card.message,
      apiKeyIssue ? "api_key" : "sync",
    );
  }
}
