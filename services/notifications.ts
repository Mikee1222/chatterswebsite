"use server";

import {
  listRecords,
  listAllRecords,
  getRecord,
  createRecord,
  updateRecord,
  batchUpdateRecords,
  deleteRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import {
  NOTIFICATIONS_TABLE,
  NOTIFICATION_FIELDS,
  CATEGORY_TO_AIRTABLE,
  validateNotificationPayload,
  type NotificationCategoryAirtable,
  type NotificationEventTypeAirtable,
} from "@/lib/notifications-schema";
import type { AppNotification, NotificationCategory, NotificationEventType, NotificationPriority } from "@/types";
import type { NotificationMetadataItem } from "@/types";
import { devLog } from "@/lib/dev-log";

type Fields = Record<string, unknown>;

function parseMetadata(raw: unknown): NotificationMetadataItem[] | undefined {
  if (raw == null) return undefined;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return undefined;
    return parsed.filter(
      (x): x is NotificationMetadataItem =>
        x != null && typeof x === "object" && typeof (x as NotificationMetadataItem).label === "string" && typeof (x as NotificationMetadataItem).value === "string");
  } catch {
    return undefined;
  }
}

function mapRecord(rec: AirtableRecord<Fields>): AppNotification {
  const f = rec.fields as Record<string, unknown>;
  const metadata = parseMetadata(f[NOTIFICATION_FIELDS.metadata]);
  return {
    id: rec.id,
    notification_id: (f[NOTIFICATION_FIELDS.notification_id] as string) ?? "",
    user_id: (f[NOTIFICATION_FIELDS.user_id] as string) ?? "",
    category: ((f[NOTIFICATION_FIELDS.category] as NotificationCategory) ?? "system") as AppNotification["category"],
    event_type: ((f[NOTIFICATION_FIELDS.event_type] as NotificationEventType) ?? "system_alert") as AppNotification["event_type"],
    priority: ((f[NOTIFICATION_FIELDS.priority] as NotificationPriority) ?? "normal") as AppNotification["priority"],
    title: (f[NOTIFICATION_FIELDS.title] as string) ?? "",
    body: (f[NOTIFICATION_FIELDS.body] as string) ?? "",
    entity_type: (f[NOTIFICATION_FIELDS.entity_type] as string) ?? "",
    entity_id: (f[NOTIFICATION_FIELDS.entity_id] as string) ?? "",
    read_at: (f[NOTIFICATION_FIELDS.read_at] as string | null) ?? null,
    created_at: (f[NOTIFICATION_FIELDS.created_at] as string) ?? "",
    ...(metadata?.length ? { metadata } : {}),
  };
}

/**
 * Create a notification record. Uses schema constants and validation.
 * Returns null on validation failure or Airtable error (non-blocking; errors are logged).
 */
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
  console.log("[createNotification] called, user_id:", fields.user_id);
  console.log(
    "[createNotification] user_id:",
    fields.user_id,
    "category:",
    airtableCategory,
    "title:",
    fields.title
  );

  const validation = validateNotificationPayload({ ...fields, category: airtableCategory });
  if (!validation.valid) {
    devLog(NOTIF, "skip", JSON.stringify({
      reason: "invalid payload",
      code: validation.code,
      error: validation.error,
      recipient_user_id: fields.user_id,
      event_type: fields.event_type,
    }));
    return null;
  }

  const notificationId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  // Only include fields that exist in the Airtable notifications table. Do not send "metadata"// unless the table has a Long text column named "metadata" (Airtable returns Unknown field name otherwise).
  const payload: Record<string, unknown> = {
    [NOTIFICATION_FIELDS.notification_id]: notificationId,
    [NOTIFICATION_FIELDS.user_id]: fields.user_id,
    [NOTIFICATION_FIELDS.category]: airtableCategory,
    [NOTIFICATION_FIELDS.event_type]: fields.event_type,
    [NOTIFICATION_FIELDS.priority]: fields.priority,
    [NOTIFICATION_FIELDS.title]: fields.title,
    [NOTIFICATION_FIELDS.body]: fields.body,
    [NOTIFICATION_FIELDS.entity_type]: fields.entity_type,
    [NOTIFICATION_FIELDS.entity_id]: fields.entity_id,
  };
  // Omit metadata from Airtable create; in-app/realtime still get metadata from notification-service payload.
  // When the notifications table has a "metadata" column, you can add: if (fields.metadata?.length) payload[NOTIFICATION_FIELDS.metadata] = JSON.stringify(fields.metadata);

  // 6. Right before creating the airtable notification record
  devLog(NOTIF, "6 before_airtable_create", JSON.stringify({ table: NOTIFICATIONS_TABLE, payload }));

  try {
    console.log("[createNotification] about to write to Airtable...");
    const rec = await createRecord(NOTIFICATIONS_TABLE, payload as Record<string, string | number | boolean | null>);
    console.log("[createNotification] SUCCESS, record id:", rec.id);
    // 7. Right after successful airtable notification create
    devLog(NOTIF, "7 after_airtable_create", JSON.stringify({
      created_record_id: rec.id,
      recipient_user_id: fields.user_id,
      event_type: fields.event_type,
    }));
    return mapRecord(rec as AirtableRecord<Fields>);
  } catch (err) {
    // 8. If airtable notification create is skipped, log the exact reason
    devLog(NOTIF, "8 airtable_create_skipped", JSON.stringify({
      reason: "Airtable create failed",
      recipient_user_id: fields.user_id,
      error: err instanceof Error ? err.message : String(err),
    }));
    return null;
  }
}

const NOTIFY_UI_DEBUG = "[notify-ui-debug]";

/** Unread: Airtable date/datetime cells are usually BLANK when empty, not "" — match both. */
function unreadReadAtFormula(): string {
  return `OR(BLANK({${NOTIFICATION_FIELDS.read_at}}), {${NOTIFICATION_FIELDS.read_at}} = "")`;
}

export async function listNotificationsForUser(
  userId: string,
  params: { pageSize?: number; offset?: string; unreadOnly?: boolean; since?: string } = {}
) {
  const escaped = userId.replace(/"/g, '""');
  let formula = `{${NOTIFICATION_FIELDS.user_id}} = "${escaped}"`;
  if (params.unreadOnly) {
    formula = `AND(${formula}, ${unreadReadAtFormula()})`;
  }
  if (params.since) {
    formula = `AND(${formula}, IS_AFTER({${NOTIFICATION_FIELDS.created_at}}, "${params.since}"))`;
  }
  devLog(NOTIFY_UI_DEBUG, "listNotificationsForUser", JSON.stringify({ recipient_user_id: userId, unreadOnly: params.unreadOnly ?? false, since: params.since ?? null }));
  const { records, offset } = await listRecords<Fields>(NOTIFICATIONS_TABLE, {
    filterByFormula: formula,
    sort: [{ field: NOTIFICATION_FIELDS.created_at, direction: "desc" }],
    pageSize: params.pageSize ?? 50,
    offset: params.offset,
  });
  const notifications = records.map(mapRecord);
  devLog(NOTIFY_UI_DEBUG, "listNotificationsForUser_result", JSON.stringify({ recipient_user_id: userId, notifications_returned: notifications.length }));
  return { notifications, offset };
}

export async function getUnreadCount(userId: string): Promise<number> {
  const escaped = userId.replace(/"/g, '""');
  const formula = `AND({${NOTIFICATION_FIELDS.user_id}} = "${escaped}", ${unreadReadAtFormula()})`;
  devLog(NOTIFY_UI_DEBUG, "getUnreadCount", JSON.stringify({ airtable_filter: formula, recipient_user_id: userId }));
  const records = await listAllRecords<Fields>(NOTIFICATIONS_TABLE, {
    filterByFormula: formula,
    fields: [NOTIFICATION_FIELDS.notification_id],
  });
  devLog(NOTIFY_UI_DEBUG, "getUnreadCount_result", JSON.stringify({ recipient_user_id: userId, unread_count: records.length }));
  return records.length;
}

export async function markAsRead(recordId: string, userId: string) {
  const existing = await getRecord<Fields>(NOTIFICATIONS_TABLE, recordId);
  const ownerId = String((existing.fields as Fields)[NOTIFICATION_FIELDS.user_id] ?? "");
  if (ownerId !== userId) {
    throw new Error("Forbidden");
  }
  const readAtValue = new Date().toISOString();
  const rec = await updateRecord<Fields>(NOTIFICATIONS_TABLE, recordId, {
    [NOTIFICATION_FIELDS.read_at]: readAtValue,
  });
  devLog(NOTIFY_UI_DEBUG, "mark_single_read", JSON.stringify({ recordId, userId }));
  return mapRecord(rec);
}

/** Deletes one notification only if it belongs to the given user (Airtable user id). */
export async function deleteNotificationForUser(recordId: string, expectedUserId: string): Promise<void> {
  const rec = await getRecord<Fields>(NOTIFICATIONS_TABLE, recordId);
  const uid = String((rec.fields as Fields)[NOTIFICATION_FIELDS.user_id] ?? "");
  if (uid !== expectedUserId) {
    throw new Error("Notification not found or access denied");
  }
  await deleteRecord(NOTIFICATIONS_TABLE, recordId);
  devLog(NOTIFY_UI_DEBUG, "delete_notification", JSON.stringify({ recordId }));
}

/** Mark every unread notification for this user as read (no page limit). */
export async function markAllAsRead(userId: string) {
  const readAtValue = new Date().toISOString();
  const escaped = userId.replace(/"/g, '""');
  const formula = `AND({${NOTIFICATION_FIELDS.user_id}} = "${escaped}", ${unreadReadAtFormula()})`;
  const allUnread = await listAllRecords<Fields>(NOTIFICATIONS_TABLE, {
    filterByFormula: formula,
    sort: [{ field: NOTIFICATION_FIELDS.created_at, direction: "desc" }],
    fields: [NOTIFICATION_FIELDS.user_id],
  });
  const ownedUnread = allUnread.filter((rec) => {
    const ownerId = String((rec.fields as Fields)[NOTIFICATION_FIELDS.user_id] ?? "");
    return ownerId === userId;
  });
  if (ownedUnread.length === 0) {
    devLog(NOTIFY_UI_DEBUG, "mark_all_read", JSON.stringify({ userId, found: 0, patched: 0 }));
    return 0;
  }
  try {
    await batchUpdateRecords(
      NOTIFICATIONS_TABLE,
      ownedUnread.map((rec) => ({
        id: rec.id,
        fields: { [NOTIFICATION_FIELDS.read_at]: readAtValue },
      }))
    );
  } catch (err) {
    console.error(
      NOTIFY_UI_DEBUG,
      "mark_all_read_batch_failed",
      JSON.stringify({
        userId,
        count: ownedUnread.length,
        error: err instanceof Error ? err.message : String(err),
      })
    );
    throw err;
  }
  devLog(
    NOTIFY_UI_DEBUG,
    "mark_all_read",
    JSON.stringify({ userId, found: ownedUnread.length, patched: ownedUnread.length })
  );
  return ownedUnread.length;
}

export async function getNotificationById(recordId: string): Promise<AppNotification | null> {
  try {
    const rec = await getRecord<Fields>(NOTIFICATIONS_TABLE, recordId);
    return mapRecord(rec);
  } catch {
    return null;
  }
}

/**
 * Check if a notification already exists for this user + entity_type + entity_id + event_type (for duplicate prevention).
 * Used by notifyAdminsOnce to avoid duplicate late/no-show alerts.
 */
export async function findExistingNotification(
  userId: string,
  entityType: string,
  entityId: string,
  eventType: string
): Promise<boolean> {
  const escapedUser = userId.replace(/"/g, '""');
  const escapedEntityType = entityType.replace(/"/g, '""');
  const escapedEntityId = entityId.replace(/"/g, '""');
  const escapedEvent = eventType.replace(/"/g, '""');
  const formula = `AND(
    {${NOTIFICATION_FIELDS.user_id}} = "${escapedUser}",
    {${NOTIFICATION_FIELDS.entity_type}} = "${escapedEntityType}",
    {${NOTIFICATION_FIELDS.entity_id}} = "${escapedEntityId}",
    {${NOTIFICATION_FIELDS.event_type}} = "${escapedEvent}")`;
  const { records } = await listRecords<Fields>(NOTIFICATIONS_TABLE, {
    filterByFormula: formula,
    pageSize: 1,
  });
  return records.length > 0;
}
