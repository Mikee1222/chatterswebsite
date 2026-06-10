/**
 * Server-only: broadcast a realtime event to the WebSocket layer (Cloudflare DO).
 * Call after creating a notification in Airtable.
 */

import type { AppNotification } from "@/types";

export type BroadcastTarget = "user" | "admins" | "role" | "all";

export type RealtimeEventPayload = {
  type: "notification";
  notification: AppNotification;
  unreadCount?: number;
};

export async function broadcastRealtimeEvent(
  target: BroadcastTarget,
  payload: RealtimeEventPayload,
  options?: { userId?: string; role?: string }
): Promise<void> {
  const url = process.env.REALTIME_BROADCAST_URL;
  const secret = process.env.REALTIME_BROADCAST_SECRET;
  if (!url || !secret) return;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/realtime/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        target,
        userId: options?.userId,
        role: options?.role,
        payload,
      }),
    });
    if (!res.ok) {
      console.error("[realtime] broadcast failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("[realtime] broadcast error", err);
  }
}

/** Sync in-app badge across tabs/devices after mark-read without a new notification row. */
export async function broadcastUserUnreadCount(userId: string, unreadCount: number): Promise<void> {
  const url = process.env.REALTIME_BROADCAST_URL;
  const secret = process.env.REALTIME_BROADCAST_SECRET;
  if (!url || !secret) return;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/realtime/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        target: "user",
        userId,
        payload: { type: "unread_count", unreadCount },
      }),
    });
    if (!res.ok) {
      console.error("[realtime] unread_count broadcast failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("[realtime] unread_count broadcast error", err);
  }
}

/** Broadcast arbitrary realtime payload to all connected clients. */
export async function broadcastRealtimeToAll(payload: Record<string, unknown>): Promise<void> {
  const url = process.env.REALTIME_BROADCAST_URL;
  const secret = process.env.REALTIME_BROADCAST_SECRET;
  if (!url || !secret) return;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/realtime/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        target: "all",
        payload,
      }),
    });
    if (!res.ok) {
      console.error("[realtime] broadcast all failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("[realtime] broadcast all error", err);
  }
}
