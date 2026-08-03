/**
 * Supabase backend for services/notifications.ts (DATA_BACKEND=supabase).
 *
 * event_type design: permissive `text` column + app-layer validation via
 * validateNotificationPayload / NOTIFICATION_EVENT_TYPES. No Postgres ENUM /
 * CHECK constraint — Airtable typecast is NOT required on this path.
 */

import {
  CATEGORY_TO_AIRTABLE,
  NOTIFICATION_FIELDS,
  validateNotificationPayload,
  type NotificationCategoryAirtable,
  type NotificationEventTypeAirtable,
} from "@/lib/notifications-schema";
import {
  publicId,
  sbDeleteByPublicId,
  sbInsert,
  sbSelectByPublicId,
  sbUpdateByPublicId,
  type SbRow,
} from "@/lib/supabase-data";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { urlsToAttachments } from "@/lib/supabase-signed-url";
import { devLog } from "@/lib/dev-log";
import type {
  AppNotification,
  NotificationCategory,
  NotificationEventType,
  NotificationMetadataItem,
  NotificationPriority,
} from "@/types";

const TABLE = "notifications";

type Row = SbRow & {
  notification_id?: string | null;
  user_id?: string | null;
  title?: string | null;
  body?: string | null;
  type?: string | null;
  category?: string | null;
  priority?: string | null;
  attachments?: string[] | null;
  entity_type?: string | null;
  entity_id?: string | null;
  is_read?: boolean | null;
  read_at?: string | null;
  delivery_status?: string | null;
  created_at?: string | null;
  event_type?: string | null;
  metadata?: string | null;
};

function parseMetadata(raw: unknown): NotificationMetadataItem[] | undefined {
  if (raw == null) return undefined;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return undefined;
    return parsed.filter(
      (x): x is NotificationMetadataItem =>
        x != null &&
        typeof x === "object" &&
        typeof (x as NotificationMetadataItem).label === "string" &&
        typeof (x as NotificationMetadataItem).value === "string"
    );
  } catch {
    return undefined;
  }
}

function mapRow(row: Row): AppNotification {
  const metadata = parseMetadata(row.metadata);
  return {
    id: publicId(row),
    notification_id: row.notification_id ?? "",
    user_id: row.user_id ?? "",
    category: ((row.category as NotificationCategory) ?? "system") as AppNotification["category"],
    event_type: ((row.event_type as NotificationEventType) ?? "system_alert") as AppNotification["event_type"],
    priority: ((row.priority as NotificationPriority) ?? "normal") as AppNotification["priority"],
    title: row.title ?? "",
    body: row.body ?? "",
    entity_type: row.entity_type ?? "",
    entity_id: row.entity_id ?? "",
    read_at: row.read_at ?? null,
    created_at: row.created_at ?? "",
    ...(metadata?.length ? { metadata } : {}),
  };
}

const NOTIFY_UI_DEBUG = "[notify-ui-debug]";

export async function createNotification(fields: {
  user_id: string;
  category: NotificationCategoryAirtable;
  event_type: NotificationEventTypeAirtable;
  priority: NotificationPriority;
  title: string;
  body: string;
  entity_type: string;
  entity_id: string;
  metadata?: NotificationMetadataItem[];
}): Promise<AppNotification | null> {
  const NOTIF = "[NOTIF]";
  const airtableCategory = CATEGORY_TO_AIRTABLE[fields.category] ?? fields.category;
  const validation = validateNotificationPayload({ ...fields, category: airtableCategory });
  if (!validation.valid) {
    devLog(
      NOTIF,
      "skip",
      JSON.stringify({
        reason: "invalid payload",
        code: validation.code,
        error: validation.error,
        recipient_user_id: fields.user_id,
        event_type: fields.event_type,
      })
    );
    return null;
  }

  const notificationId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const row: Record<string, unknown> = {
    notification_id: notificationId,
    user_id: fields.user_id,
    category: airtableCategory,
    // Permissive text — validated above; no DB enum / typecast workaround
    event_type: fields.event_type,
    priority: fields.priority,
    title: fields.title,
    body: fields.body,
    entity_type: fields.entity_type,
    entity_id: fields.entity_id,
    created_at: new Date().toISOString(),
    is_read: false,
    read_at: null,
  };
  if (fields.metadata?.length) {
    row.metadata = JSON.stringify(fields.metadata);
  }

  try {
    const inserted = await sbInsert<Row>(TABLE, row);
    return mapRow(inserted);
  } catch (err) {
    devLog(
      NOTIF,
      "8 supabase_create_skipped",
      JSON.stringify({
        reason: "Supabase create failed",
        recipient_user_id: fields.user_id,
        error: err instanceof Error ? err.message : String(err),
      })
    );
    return null;
  }
}

export async function listNotificationsForUser(
  userId: string,
  params: { pageSize?: number; offset?: string; unreadOnly?: boolean; since?: string } = {}
) {
  const sb = getSupabaseServiceClient();
  const pageSize = params.pageSize ?? 50;
  // offset is Airtable cursor on AT path; on SB we treat as numeric page offset string
  const offsetNum = params.offset ? Number.parseInt(params.offset, 10) || 0 : 0;

  let q = sb
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offsetNum, offsetNum + pageSize - 1);

  if (params.unreadOnly) {
    // read_at is a Postgres `date` — empty-string eq is invalid (22007).
    // Unread = NULL only (matches Airtable BLANK(read_at)).
    q = q.is("read_at", null);
  }
  if (params.since) {
    q = q.gt("created_at", params.since);
  }

  const { data, error } = await q;
  if (error) throw new Error(`listNotificationsForUser: ${error.message}`);
  const notifications = ((data as Row[]) ?? []).map(mapRow);
  const nextOffset =
    notifications.length === pageSize ? String(offsetNum + pageSize) : undefined;
  devLog(
    NOTIFY_UI_DEBUG,
    "listNotificationsForUser_result",
    JSON.stringify({ recipient_user_id: userId, notifications_returned: notifications.length })
  );
  return { notifications, offset: nextOffset };
}

export async function getUnreadCount(userId: string): Promise<number> {
  const sb = getSupabaseServiceClient();
  // read_at is `date` — do NOT use `read_at.eq.` / empty string (PostgREST 22007).
  const { count, error } = await sb
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) {
    const detail = [error.message, error.code, error.details, error.hint]
      .filter(Boolean)
      .join(" | ");
    console.error("[notifications-supabase] getUnreadCount failed", {
      userId,
      detail,
      error,
    });
    throw new Error(`getUnreadCount: ${detail || "unknown Supabase error"}`);
  }
  return count ?? 0;
}

export async function markAsRead(recordId: string, userId: string) {
  const existing = await sbSelectByPublicId<Row>(TABLE, recordId);
  if (!existing || (existing.user_id ?? "") !== userId) {
    throw new Error("Forbidden");
  }
  const readAtValue = new Date().toISOString();
  const updated = await sbUpdateByPublicId<Row>(TABLE, recordId, {
    read_at: readAtValue.slice(0, 10), // column is date in schema
    is_read: true,
  });
  // Prefer full ISO if column accepts timestamptz-as-text; re-check
  // Schema uses `date` for read_at — store YYYY-MM-DD; AppNotification allows string.
  return mapRow(updated);
}

export async function deleteNotificationForUser(recordId: string, expectedUserId: string): Promise<void> {
  const existing = await sbSelectByPublicId<Row>(TABLE, recordId);
  if (!existing || (existing.user_id ?? "") !== expectedUserId) {
    throw new Error("Notification not found or access denied");
  }
  await sbDeleteByPublicId(TABLE, recordId);
}

export async function markAllAsRead(userId: string) {
  const sb = getSupabaseServiceClient();
  const readAtValue = new Date().toISOString().slice(0, 10);
  // Fetch unread ids then update (PostgREST null filter)
  const { data, error } = await sb
    .from(TABLE)
    .select("id, airtable_id, user_id")
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw new Error(`markAllAsRead select: ${error.message}`);
  const rows = (data as Row[]) ?? [];
  if (!rows.length) return 0;
  let patched = 0;
  for (const row of rows) {
    const key = row.airtable_id || row.id;
    try {
      await sbUpdateByPublicId(TABLE, key, { read_at: readAtValue, is_read: true });
      patched += 1;
    } catch (err) {
      console.error(NOTIFY_UI_DEBUG, "mark_all_read_row_failed", err);
    }
  }
  return patched;
}

export async function getNotificationById(recordId: string): Promise<AppNotification | null> {
  const row = await sbSelectByPublicId<Row>(TABLE, recordId);
  if (!row) return null;
  return mapRow(row);
}

export async function findExistingNotification(
  userId: string,
  entityType: string,
  entityId: string,
  eventType: string
): Promise<boolean> {
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(TABLE)
    .select("id")
    .eq("user_id", userId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("event_type", eventType)
    .limit(1);
  if (error) throw new Error(`findExistingNotification: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/** Optional: resolve attachment tokens if a notification carries them. */
export async function resolveNotificationAttachments(urls: string[] | null | undefined) {
  return urlsToAttachments(urls);
}

// Silence unused field constant warning in dual-run (kept for parity with Airtable field map).
void NOTIFICATION_FIELDS;
