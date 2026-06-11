"use client";
import { devLog } from "@/lib/dev-log";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode, Dispatch, SetStateAction } from "react";
import type { AppNotification } from "@/types";

type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";

export type RealtimeEvent =
  | { type: "notification_created"; notification: AppNotification; unreadCount?: number }
  | { type: "shift_started"; chatter_id: string; shift_id: string }
  | { type: "shift_ended"; chatter_id: string; shift_id: string }
  | { type: "model_status_changed"; model_id: string; status: string }
  | { type: "model_live_started"; model_id: string; live_id: string; platform: string }
  | { type: "model_live_ended"; model_id: string; live_id: string }
  | { type: "whale_registered"; whale_id: string; username?: string }
  | { type: "custom_request_created"; [key: string]: unknown };

type RealtimeEventListener = (event: RealtimeEvent) => void;

type RealtimeContextValue = {
  connectionStatus: ConnectionStatus;
  unreadCount: number;
  notifications: AppNotification[];
  setUnreadCount: (n: number | ((prev: number) => number)) => void;
  setNotifications: Dispatch<SetStateAction<AppNotification[]>>;
  addNotification: (n: AppNotification) => void;
  refreshUnreadCount: () => Promise<void>;
  subscribe: (listener: RealtimeEventListener) => () => void;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

const REALTIME_DEBUG = "[realtime-debug]";

/**
 * WebSocket URL for the separate realtime Worker (`realtime/` + `NEXT_PUBLIC_REALTIME_WS_URL`).
 * We intentionally do **not** fall back to `/api/ws` on the app origin — that route does not exist
 * on the Next/OpenNext worker and causes console noise and failed upgrade requests in production.
 */
function useConfiguredRealtimeWsUrl(): string {
  return useMemo(() => {
    const raw = process.env.NEXT_PUBLIC_REALTIME_WS_URL;
    return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : "";
  }, []);
}

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

export function RealtimeProvider({
  children,
  initialUnreadCount = 0,
  addToast,
  onRealtimeEvent,
}: {
  children: ReactNode;
  initialUnreadCount?: number;
  addToast?: (n: AppNotification) => void;
  onRealtimeEvent?: (event: RealtimeEvent) => void;
}) {
  const onRealtimeEventRef = useRef(onRealtimeEvent);
  onRealtimeEventRef.current = onRealtimeEvent;
  const subscribersRef = useRef(new Set<RealtimeEventListener>());
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [unreadCount, setUnreadCountState] = useState(initialUnreadCount);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const addToastRef = useRef(addToast);
  addToastRef.current = addToast;
  const wsUrl = useConfiguredRealtimeWsUrl();
  const wsUrlRef = useRef(wsUrl);
  wsUrlRef.current = wsUrl;

  const setUnreadCount = useCallback((n: number | ((prev: number) => number)) => {
    setUnreadCountState(n);
  }, []);

  const addNotification = useCallback((notification: AppNotification) => {
    setNotifications((prev) => [notification, ...prev.filter((p) => p.id !== notification.id)].slice(0, 50));
    addToastRef.current?.(notification);
  }, []);

  const lastRefreshRef = useRef(0);
  const inFlightRef = useRef(false);
  const REFRESH_MIN_MS = 5000;

  const dispatchRealtimeEvent = useCallback((event: RealtimeEvent) => {
    onRealtimeEventRef.current?.(event);
    subscribersRef.current.forEach((listener) => listener(event));
  }, []);

  const subscribe = useCallback((listener: RealtimeEventListener) => {
    subscribersRef.current.add(listener);
    return () => {
      subscribersRef.current.delete(listener);
    };
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    const now = Date.now();
    if (inFlightRef.current) return;
    if (lastRefreshRef.current > 0 && now - lastRefreshRef.current < REFRESH_MIN_MS) return;
    inFlightRef.current = true;
    lastRefreshRef.current = now;
    try {
      const res = await fetch("/api/notifications/unread-count");
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.count === "number") setUnreadCountState(data.count);
    } catch {
      // ignore; do not retry in a loop
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  const connect = useCallback(() => {
    const url = wsUrlRef.current;
    if (!url) {
      setConnectionStatus("idle");
      return;
    }
    if (typeof window !== "undefined") devLog(REALTIME_DEBUG, "client connecting", url);
    setConnectionStatus("connecting");
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (typeof window !== "undefined") devLog(REALTIME_DEBUG, "client connected");
      reconnectAttemptRef.current = 0;
      fetch("/api/realtime-token")
        .then((r) => r.json())
        .then((data) => {
          if (data.token) wsRef.current?.send(JSON.stringify({ token: data.token }));
        })
        .catch(() => {});
    };

    ws.onmessage = async (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data.type === "authenticated") {
          setConnectionStatus("connected");
          if (typeof window !== "undefined") devLog(REALTIME_DEBUG, "client authenticated");
          return;
        }
        if (data.type === "error") {
          setConnectionStatus("error");
          ws.close();
          return;
        }
        if (data.type === "unread_count" && typeof data.unreadCount === "number") {
          setUnreadCountState(data.unreadCount);
          return;
        }
        if (data.type === "mark_all_read") {
          const ts = new Date().toISOString();
          setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || ts })));
          setUnreadCountState(0);
          return;
        }
        if ((data.type === "notification" || data.type === "notification_created") && data.notification) {
          setUnreadCountState((c) => (typeof data.unreadCount === "number" ? data.unreadCount : c + 1));
          addNotification(data.notification as AppNotification);
        }
        if (
          data.type === "shift_started" ||
          data.type === "shift_ended" ||
          data.type === "model_status_changed" ||
          data.type === "model_live_started" ||
          data.type === "model_live_ended" ||
          data.type === "whale_registered" ||
          data.type === "custom_request_created"
        ) {
          dispatchRealtimeEvent(data as RealtimeEvent);
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      if (typeof window !== "undefined") devLog(REALTIME_DEBUG, "client closed");
      wsRef.current = null;
      setConnectionStatus("disconnected");
      if (!wsUrlRef.current) return;
      const delay = Math.min(
        RECONNECT_BASE_MS * 2 ** reconnectAttemptRef.current,
        RECONNECT_MAX_MS
      );
      reconnectAttemptRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    };

    ws.onerror = () => {
      setConnectionStatus("error");
    };
  }, [addNotification, dispatchRealtimeEvent]);

  // When WebSocket is not configured, poll unread count at a stable interval (no storm on failure)
  const POLL_INTERVAL_MS = 30000;
  useEffect(() => {
    if (wsUrl) return;
    const t = setInterval(() => {
      refreshUnreadCount().then(() => {});
    }, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [wsUrl, refreshUnreadCount]);

  useEffect(() => {
    if (!wsUrl) return;
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, wsUrl]);

  const value: RealtimeContextValue = {
    connectionStatus,
    unreadCount,
    notifications,
    setUnreadCount,
    setNotifications,
    addNotification,
    refreshUnreadCount,
    subscribe,
  };

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
