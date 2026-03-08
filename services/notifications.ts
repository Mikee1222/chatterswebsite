"use server";

import {
  listRecords,
  listAllRecords,
  getRecord,
  createRecord,
  updateRecord,
  type AirtableRecord,
} from "@/lib/airtable-server";
import type { AppNotification, NotificationCategory, NotificationEventType, NotificationPriority } from "@/types";

const TABLE = "notifications";

type Fields = {
  notification_id?: string;
  user_id?: string;
  category?: string;
  event_type?: string;
  priority?: string;
  title?: string;
  body?: string;
  entity_type?: string;
  entity_id?: string;
  read_at?: string;
  created_at?: string;
};

function mapRecord(rec: AirtableRecord<Fields>): AppNotification {
  const f = rec.fields;
  return {
    id: rec.id,
    notification_id: f.notification_id ?? "",
    user_id: f.user_id ?? "",
    category: (f.category as NotificationCategory) ?? "system",
    event_type: (f.event_type as AppNotification["event_type"]) ?? "system_alert",
    priority: (f.priority as NotificationPriority) ?? "normal",
    title: f.title ?? "",
    body: f.body ?? "",
    entity_type: f.entity_type ?? "",
    entity_id: f.entity_id ?? "",
    read_at: f.read_at ?? null,
    created_at: f.created_at ?? "",
  };
}

export async function createNotification(fields: {
  user_id: string;
  category: NotificationCategory;
  event_type: NotificationEventType;
  priority: NotificationPriority;
  title: string;
  body: string;
  entity_type: string;
  entity_id: string;
}) {
  const notificationId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const rec = await createRecord(TABLE, {
    notification_id: notificationId,
    ...fields,
  });
  return mapRecord(rec as AirtableRecord<Fields>);
}

export async function listNotificationsForUser(
  userId: string,
  params: { pageSize?: number; offset?: string; unreadOnly?: boolean } = {}
) {
  const userPart = `{user_id} = "${userId.replace(/"/g, '""')}"`;
  const formula = params.unreadOnly
    ? `AND(${userPart}, {read_at} = "")`
    : userPart;
  const { records, offset } = await listRecords<Fields>(TABLE, {
    filterByFormula: formula,
    sort: [{ field: "created_at", direction: "desc" }],
    pageSize: params.pageSize ?? 50,
    offset: params.offset,
  });
  return { notifications: records.map(mapRecord), offset };
}

export async function getUnreadCount(userId: string): Promise<number> {
  const escaped = userId.replace(/"/g, '""');
  const formula = `AND({user_id} = "${escaped}", {read_at} = "")`;
  const all = await listAllRecords<Fields>(TABLE, {
    filterByFormula: formula,
  });
  return all.length;
}

export async function markAsRead(recordId: string) {
  const rec = await updateRecord<Fields>(TABLE, recordId, {
    read_at: new Date().toISOString(),
  });
  return mapRecord(rec);
}

export async function markAllAsRead(userId: string) {
  const { notifications } = await listNotificationsForUser(userId, { unreadOnly: true, pageSize: 500 });
  await Promise.all(notifications.map((n) => updateRecord<Fields>(TABLE, n.id, { read_at: new Date().toISOString() })));
  return notifications.length;
}

export async function getNotificationById(recordId: string): Promise<AppNotification | null> {
  try {
    const rec = await getRecord<Fields>(TABLE, recordId);
    return mapRecord(rec);
  } catch {
    return null;
  }
}
