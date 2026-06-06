import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { listRecords } from "@/lib/airtable-server";
import { getPushTargetPath } from "@/lib/notification-routes";
import { sendWebPush } from "@/lib/web-push-server";
import { getPreferencesByUserId } from "@/services/notification-preferences";
import { notify } from "@/services/notification-service";
import { getActiveSubscriptionsForUser } from "@/services/push-subscriptions";
import { listAllUsers } from "@/services/users";
import type { UserRole } from "@/types";

type TableProbe = { exists: boolean; count?: number; error?: string };

async function probeTable(table: string): Promise<TableProbe> {
  try {
    const { records } = await listRecords<Record<string, unknown>>(table, {
      pageSize: 1,
      _caller: "notification-diagnostic",
    });
    return { exists: true, count: records.length };
  } catch (err) {
    return { exists: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function checkValuePassed(c: unknown): boolean {
  if (c == null) return true;
  if (Array.isArray(c)) {
    return c.every((x: { pass?: boolean }) => x.pass === true);
  }
  if (typeof c === "object" && "pass" in (c as object)) {
    return (c as { pass?: boolean }).pass === true;
  }
  return true;
}

/**
 * Full notification pipeline diagnostic. Admin session only (no ENABLE_NOTIFICATION_TESTING gate).
 */
export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get("user_id")?.trim() || null;

  const results: Record<string, unknown> = {};

  results.env = {
    /** Server push uses this (see /api/push/vapid-public). */
    VAPID_PUBLIC_KEY: !!process.env.VAPID_PUBLIC_KEY,
    /** Optional duplicate if you expose a public key to the client under this name. */
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: !!process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: !!(process.env.VAPID_SUBJECT && process.env.VAPID_SUBJECT.trim()),
    AIRTABLE_TOKEN: !!process.env.AIRTABLE_TOKEN,
    AIRTABLE_BASE_ID: !!process.env.AIRTABLE_BASE_ID,
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

  const userRows: Array<Record<string, unknown>> = [];

  for (const user of users) {
    const userId = user.id;
    const role = user.role;
    const name = ((user.full_name || user.email || "").trim() || "—") as string;

    const userResult: Record<string, unknown> = {
      id: userId,
      name,
      role,
      checks: {} as Record<string, unknown>,
    };
    const checks = userResult.checks as Record<string, unknown>;

    try {
      const prefs = await getPreferencesByUserId(userId);
      checks.has_preferences = {
        pass: !!prefs,
        data: prefs ? { push_enabled: prefs.push_enabled, mute_all: prefs.mute_all } : null,
        fix: !prefs ? "Run: npx tsx scripts/fix-notification-setup.ts" : null,
      };
    } catch (err) {
      checks.has_preferences = {
        pass: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    try {
      const prefs = await getPreferencesByUserId(userId);
      const pushOk = prefs?.push_enabled === true && prefs?.mute_all !== true;
      checks.push_enabled = {
        pass: pushOk,
        push_enabled: prefs?.push_enabled,
        mute_all: prefs?.mute_all,
        fix: !pushOk ? "Set push_enabled=true and mute_all=false in notification_preferences" : null,
      };
    } catch (err) {
      checks.push_enabled = {
        pass: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    try {
      const subs = await getActiveSubscriptionsForUser(userId);
      checks.has_push_subscriptions = {
        pass: subs.length > 0,
        count: subs.length,
        fix:
          subs.length === 0
            ? "User must open the app and allow notifications in the browser (push prompt / Settings).": null,
      };
    } catch (err) {
      checks.has_push_subscriptions = {
        pass: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    try {
      const notifyResult = await notify({
        user_id: userId,
        event_type: "system_alert",
        title: " Diagnostic test",
        body: `Pipeline test for ${name} — ${new Date().toISOString()}`,
        entity_type: "system",
        entity_id: `diagnostic:${userId}:${Date.now()}`,
        _triggerSource: "api/debug/notification-diagnostic",
      });
      checks.notify_pipeline = {
        pass: !!notifyResult.notification,
        push_sent: notifyResult.pushSent,
        fix: !notifyResult.notification
          ? "notify() did not create a notifications row (validation or Airtable error).": null,
      };
    } catch (err) {
      checks.notify_pipeline = {
        pass: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    try {
      const subs = await getActiveSubscriptionsForUser(userId);
      const path = getPushTargetPath("system", role as UserRole);
      if (subs.length === 0) {
        checks.push_delivery = [
          {
            pass: false,
            error: "No subscriptions — user must allow notifications in browser",
          },
        ];
      } else {
        const delivery: Array<{ pass: boolean; endpoint?: string; error?: string }> = [];
        for (const sub of subs) {
          try {
            const ok = await sendWebPush(sub, {
              title: " Push delivery test",
              body: `Direct push test for ${name}`,
              url: path,
              tag: "diagnostic",
            });
            delivery.push({
              pass: ok,
              endpoint: sub.endpoint?.length ? `${sub.endpoint.slice(0, 50)}…` : "",
            });
          } catch (err) {
            delivery.push({
              pass: false,
              endpoint: sub.endpoint?.length ? `${sub.endpoint.slice(0, 50)}…` : "",
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
        checks.push_delivery = delivery;
      }
    } catch (err) {
      checks.push_delivery = [
        { pass: false, error: err instanceof Error ? err.message : String(err) },
      ];
    }

    const allChecks = Object.values(checks);
    const allPassed = allChecks.every((c) => checkValuePassed(c));
    userResult.overall = allPassed ? " ALL PASSED" : " ISSUES FOUND";
    userRows.push(userResult);
  }

  results.users = userRows;
  results.summary = {
    total_users: userRows.length,
    fully_working: userRows.filter((u) => String(u.overall).startsWith("")).length,
    has_issues: userRows.filter((u) => String(u.overall).startsWith("")).length,
  };

  return NextResponse.json(results);
}
