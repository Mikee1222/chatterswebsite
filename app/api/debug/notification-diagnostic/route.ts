import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { listRecords, getRecord } from "@/lib/airtable-server";
import { isNotificationTestingEnabled } from "@/lib/notification-test-presets";
import { NOTIFICATION_DIAGNOSTIC_TITLE } from "@/lib/notification-diagnostic-constants";
import { getPushTargetPath } from "@/lib/notification-routes";
import { NOTIFICATIONS_TABLE, NOTIFICATION_FIELDS } from "@/lib/notifications-schema";
import { sendWebPush } from "@/lib/web-push-server";
import { notify } from "@/services/notification-service";
import { getPreferencesByUserId } from "@/services/notification-preferences";
import { getActiveSubscriptionsForUser } from "@/services/push-subscriptions";
import { listAllUsers } from "@/services/users";
import type { NotificationPreference, UserRole } from "@/types";

async function assertAdminAndTestingEnabled(): Promise<
  { ok: true } | { ok: false; response: NextResponse }
> {
  if (!isNotificationTestingEnabled()) {
    return { ok: false, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  const session = await getSessionFromCookies();
  if (!session || session.role !== "admin") {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true };
}

function isInQuietHours(prefs: { quiet_hours_start: string; quiet_hours_end: string }): boolean {
  const start = prefs.quiet_hours_start?.trim();
  const end = prefs.quiet_hours_end?.trim();
  if (!start || !end) return false;
  const now = new Date();
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const startMins = startH * 60 + (startM || 0);
  let endMins = endH * 60 + (endM || 0);
  if (endMins <= startMins) endMins += 24 * 60;
  return nowMins >= startMins && nowMins < endMins;
}

/** Mirrors `shouldSendPush` for `system_alert` → system category → `system_alerts`, priority normal. */
function diagnosticSystemPushPrefsAllow(prefs: NotificationPreference): { pass: boolean; skip?: string } {
  if (prefs.mute_all) return { pass: false, skip: "mute_all is true" };
  if (!prefs.push_enabled) return { pass: false, skip: "push_enabled is false" };
  if (!prefs.system_alerts) return { pass: false, skip: "system_alerts is false" };
  if (prefs.critical_only) return { pass: false, skip: "critical_only is true (system_alert is normal priority)" };
  return { pass: true };
}

type TableProbe = { exists: boolean; sample_count: number; fields: string[]; error?: string };

async function probeTable(table: string): Promise<TableProbe> {
  try {
    const { records } = await listRecords<Record<string, unknown>>(table, {
      pageSize: 1,
      _caller: "notification-diagnostic",
    });
    const fields = records[0]?.fields ? Object.keys(records[0].fields as object) : [];
    return { exists: true, sample_count: records.length, fields };
  } catch (err) {
    return {
      exists: false,
      sample_count: 0,
      fields: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET(req: Request) {
  const gate = await assertAdminAndTestingEnabled();
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get("user_id")?.trim() || null;

  const results: Record<string, unknown> = {};

  results.env = {
    VAPID_PUBLIC_KEY: !!process.env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: !!process.env.VAPID_PRIVATE_KEY,
    /** Web push server uses a fixed mailto in code; set if you customize the library later. */
    VAPID_SUBJECT: !!(process.env.VAPID_SUBJECT && process.env.VAPID_SUBJECT.trim()),
    AIRTABLE_TOKEN: !!process.env.AIRTABLE_TOKEN,
    AIRTABLE_BASE_ID: !!process.env.AIRTABLE_BASE_ID,
    /** Optional: admin-targeted operational notifies; not required for per-user diagnostics. */
    ADMIN_AIRTABLE_USER_IDS: !!process.env.ADMIN_AIRTABLE_USER_IDS,
  };

  const requiredTables = ["notifications", "notification_preferences", "push_subscriptions", "users"] as const;
  const airtable_tables: Record<string, TableProbe> = {};
  for (const table of requiredTables) {
    airtable_tables[table] = await probeTable(table);
  }
  results.airtable_tables = airtable_tables;

  let users = await listAllUsers().catch(() => []);
  if (targetUserId) {
    users = users.filter((u) => u.id === targetUserId);
  }

  const userRows: Record<string, unknown>[] = [];

  for (const user of users) {
    const userId = user.id;
    const role = user.role;
    const name = (user.full_name || user.email || "").trim() || "—";

    const userResult: Record<string, unknown> = {
      id: userId,
      name,
      role,
      checks: {} as Record<string, unknown>,
    };
    const checks = userResult.checks as Record<string, unknown>;

    // —— Check: preferences row ——
    try {
      const prefs = await getPreferencesByUserId(userId);
      checks.has_preferences = {
        pass: !!prefs,
        data: prefs
          ? {
              push_enabled: prefs.push_enabled,
              mute_all: prefs.mute_all,
              shift_alerts: prefs.shift_alerts,
              model_alerts: prefs.model_alerts,
              whale_alerts: prefs.whale_alerts,
              task_alerts: prefs.task_alerts,
              system_alerts: prefs.system_alerts,
              quiet_hours_start: prefs.quiet_hours_start,
              quiet_hours_end: prefs.quiet_hours_end,
              critical_only: prefs.critical_only,
              in_app_enabled: prefs.in_app_enabled,
            }
          : null,
        fix: !prefs
          ? "Create notification_preferences for this user (or run scripts/fix-notification-setup.ts)."
          : null,
      };
    } catch (err) {
      checks.has_preferences = {
        pass: false,
        error: err instanceof Error ? err.message : String(err),
        fix: "Fix Airtable/API error for notification_preferences.",
      };
    }

    // —— Check: push subscriptions ——
    try {
      const subs = await getActiveSubscriptionsForUser(userId);
      checks.has_push_subscriptions = {
        pass: subs.length > 0,
        count: subs.length,
        endpoints: subs.map((s) => (s.endpoint?.length ? `${s.endpoint.slice(0, 60)}…` : "")),
        fix:
          subs.length === 0
            ? "User must open the app on a device, grant notification permission, and enable push (Settings / prompt)."
            : null,
      };
    } catch (err) {
      checks.has_push_subscriptions = {
        pass: false,
        error: err instanceof Error ? err.message : String(err),
        fix: "Fix Airtable/API error for push_subscriptions.",
      };
    }

    // —— Check: prefs allow system_alert push (same gates as notify) ——
    try {
      const prefs = await getPreferencesByUserId(userId);
      const quiet = prefs ? isInQuietHours(prefs) : false;
      const gatePush = prefs ? diagnosticSystemPushPrefsAllow(prefs) : { pass: false, skip: "no preferences row" };
      checks.push_prefs_for_system_alert = {
        pass: gatePush.pass && !quiet,
        push_enabled: prefs?.push_enabled,
        mute_all: prefs?.mute_all,
        system_alerts: prefs?.system_alerts,
        critical_only: prefs?.critical_only,
        in_quiet_hours: quiet,
        skip_reason: !prefs ? "no_preferences" : quiet ? "quiet_hours" : gatePush.skip ?? null,
        fix: !prefs
          ? "Create notification_preferences for this user (or run scripts/fix-notification-setup.ts)."
          : quiet
            ? "Push is suppressed during quiet hours (server local clock). Retry outside that window or clear quiet hours for testing."
            : !gatePush.pass
              ? `Adjust notification_preferences: ${gatePush.skip ?? "prefs block push"}.`
              : null,
      };
    } catch (err) {
      checks.push_prefs_for_system_alert = {
        pass: false,
        error: err instanceof Error ? err.message : String(err),
        fix: "Could not evaluate preferences.",
      };
    }

    // —— Check: notify() creates in-app row + optional push ——
    let notifyNotificationId: string | null = null;
    let notifyPushSent = false;
    try {
      const body = `Diagnostic test for ${name} (${role}) — ${new Date().toISOString()}`;
      const result = await notify({
        user_id: userId,
        event_type: "system_alert",
        title: NOTIFICATION_DIAGNOSTIC_TITLE,
        body,
        entity_type: "system",
        entity_id: `diagnostic:${userId}:${Date.now()}`,
        _triggerSource: "api/debug/notification-diagnostic",
      });
      notifyNotificationId = result.notification?.id ?? null;
      notifyPushSent = result.pushSent;
      checks.notify_pipeline = {
        pass: !!result.notification,
        push_sent: result.pushSent,
        notification_id: notifyNotificationId,
        fix: !result.notification
          ? "notify() did not create a notifications row (validation or Airtable create failed). Check notifications table fields and NOTIFICATION_EVENT_TYPES / categories."
          : null,
      };
    } catch (err) {
      checks.notify_pipeline = {
        pass: false,
        push_sent: false,
        notification_id: null,
        error: err instanceof Error ? err.message : String(err),
        fix: "notify() threw — inspect server logs and Airtable schema.",
      };
    }

    // —— Check: Airtable row readable by id ——
    if (notifyNotificationId) {
      try {
        const rec = await getRecord(NOTIFICATIONS_TABLE, notifyNotificationId);
        const f = rec.fields as Record<string, unknown>;
        const title = f[NOTIFICATION_FIELDS.title];
        checks.notification_readable_in_airtable = {
          pass: title === NOTIFICATION_DIAGNOSTIC_TITLE,
          record_id: notifyNotificationId,
          title_match: title === NOTIFICATION_DIAGNOSTIC_TITLE,
          fix:
            title === NOTIFICATION_DIAGNOSTIC_TITLE
              ? null
              : "Record exists but title mismatch — unexpected schema or race.",
        };
      } catch (err) {
        checks.notification_readable_in_airtable = {
          pass: false,
          record_id: notifyNotificationId,
          error: err instanceof Error ? err.message : String(err),
          fix: "Could not read notification record by id after create.",
        };
      }
    } else {
      checks.notification_readable_in_airtable = {
        pass: false,
        fix: "Skipped — no notification id from notify_pipeline.",
      };
    }

    // —— Check: notify() push path outcome (expected false if no subs / prefs / quiet hours) ——
    checks.notify_push_sent = {
      pass: notifyPushSent,
      fix: notifyPushSent
        ? null
        : "Push was not sent via notify() for this run. Fix has_push_subscriptions, push_prefs_for_system_alert, VAPID keys, or quiet hours.",
    };

    // —— Check: direct Web Push per subscription ——
    try {
      const subs = await getActiveSubscriptionsForUser(userId);
      const path = getPushTargetPath("system", role as UserRole);
      const delivery: Array<{ endpoint: string; pass: boolean; error?: string }> = [];
      for (const sub of subs) {
        try {
          const ok = await sendWebPush(sub, {
            title: "🧪 Push delivery test",
            body: `Direct push test for ${name}`,
            url: path,
            tag: "diagnostic",
          });
          delivery.push({
            endpoint: sub.endpoint?.length ? `${sub.endpoint.slice(0, 60)}…` : "",
            pass: ok,
            ...(ok ? {} : { error: "sendWebPush returned false (see logs / VAPID / subscription)" }),
          });
        } catch (err) {
          delivery.push({
            endpoint: sub.endpoint?.length ? `${sub.endpoint.slice(0, 60)}…` : "",
            pass: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      if (subs.length === 0) {
        checks.push_delivery_direct = {
          pass: false,
          results: [{ pass: false, error: "No subscriptions to test direct push" }],
          fix: (checks.has_push_subscriptions as { fix?: string | null })?.fix ?? null,
        };
      } else {
        const allOk = delivery.every((d) => d.pass);
        checks.push_delivery_direct = {
          pass: allOk,
          results: delivery,
          fix: allOk ? null : "At least one subscription failed direct sendWebPush (expired subscription, 410, or VAPID/network).",
        };
      }
    } catch (err) {
      checks.push_delivery_direct = {
        pass: false,
        results: [{ pass: false, error: err instanceof Error ? err.message : String(err) }],
        fix: "Could not load subscriptions for direct push test.",
      };
    }

    function checkPasses(v: unknown): boolean {
      if (v == null) return true;
      if (Array.isArray(v)) return v.every((x) => checkPasses(x));
      if (typeof v === "object" && "pass" in (v as object)) return Boolean((v as { pass: boolean }).pass);
      return true;
    }

    const allPassed = Object.values(checks).every((c) => checkPasses(c));
    userResult.overall = allPassed ? "✅ ALL CHECKS PASSED" : "❌ ISSUES FOUND";

    userRows.push(userResult);
  }

  results.users = userRows;

  const envObj = results.env as Record<string, boolean>;
  const envRequiredKeys = [
    "VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
    "AIRTABLE_TOKEN",
    "AIRTABLE_BASE_ID",
  ] as const;
  const envAllPass = envRequiredKeys.every((k) => envObj[k] === true);

  const tablesAllPass = requiredTables.every((t) => airtable_tables[t]?.exists);

  results.summary = {
    env_all_required: envAllPass,
    airtable_tables_ok: tablesAllPass,
    total_users: userRows.length,
    fully_working: userRows.filter((u) => String(u.overall).startsWith("✅")).length,
    has_issues: userRows.filter((u) => String(u.overall).startsWith("❌")).length,
    issues_by_user: userRows
      .filter((u) => String(u.overall).startsWith("❌"))
      .map((u) => {
        const c = u.checks as Record<string, { pass?: boolean; fix?: string | null; results?: { pass: boolean }[] }>;
        const failedEntries = Object.entries(c).filter(([, v]) => {
          if (v == null) return false;
          if (Array.isArray(v)) return v.some((x) => !x.pass);
          if ("results" in v && Array.isArray(v.results)) return v.results.some((x) => !x.pass);
          return v.pass === false;
        });
        const failed_checks = failedEntries.map(([k]) => k);
        const fixes = failedEntries.flatMap(([, v]) =>
          v && typeof v === "object" && !Array.isArray(v) && typeof v.fix === "string" && v.fix ? [v.fix] : []
        );
        return { name: u.name, role: u.role, failed_checks, fixes };
      }),
  };

  return NextResponse.json(results, { status: 200 });
}
