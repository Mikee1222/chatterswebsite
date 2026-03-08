"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode, Dispatch, SetStateAction } from "react";
import type { AppNotification } from "@/types";

type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";

type RealtimeContextValue = {
  connectionStatus: ConnectionStatus;
  unreadCount: number;
  notifications: AppNotification[];
  setUnreadCount: (n: number | ((prev: number) => number)) => void;
  setNotifications: Dispatch<SetStateAction<AppNotification[]>>;
  addNotification: (n: AppNotification) => void;
  refreshUnreadCount: () => Promise<void>;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

const WS_URL = process.env.NEXT_PUBLIC_REALTIME_WS_URL || "";
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

export function RealtimeProvider({
  children,
  initialUnreadCount = 0,
  addToast,
}: {
  children: ReactNode;
  initialUnreadCount?: number;
  addToast?: (n: AppNotification) => void;
}) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [unreadCount, setUnreadCountState] = useState(initialUnreadCount);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const addToastRef = useRef(addToast);
  addToastRef.current = addToast;

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
    if (!WS_URL) {
      setConnectionStatus("idle");
      return;
    }
    setConnectionStatus("connecting");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
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
          return;
        }
        if (data.type === "error") {
          setConnectionStatus("error");
          ws.close();
          return;
        }
        if (data.type === "notification" && data.notification) {
          setUnreadCountState((c) => (typeof data.unreadCount === "number" ? data.unreadCount : c + 1));
          addNotification(data.notification);
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      setConnectionStatus("disconnected");
      if (!WS_URL) return;
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
  }, [addNotification]);

  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  // When WebSocket is not configured, poll unread count at a stable interval (no storm on failure)
  const POLL_INTERVAL_MS = 30000;
  useEffect(() => {
    if (WS_URL) return;
    const t = setInterval(() => {
      refreshUnreadCount().then(() => {});
    }, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [WS_URL, refreshUnreadCount]);

  useEffect(() => {
    if (!WS_URL) return;
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const value: RealtimeContextValue = {
    connectionStatus,
    unreadCount,
    notifications,
    setUnreadCount,
    setNotifications,
    addNotification,
    refreshUnreadCount,
  };

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
