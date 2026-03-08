/**
 * Durable Object: holds WebSocket connections and broadcasts events.
 * Sessions are keyed by WebSocket; first message must be { token: "jwt" } for auth.
 */

import { DurableObject } from "cloudflare:workers";

export type SessionInfo = {
  id: string;
  userId: string;
  airtableUserId: string;
  role: string;
  connectedAt: number;
};

export type BroadcastTarget = {
  target: "user" | "admins" | "role" | "all";
  userId?: string;
  role?: string;
};

export type RealtimeEventPayload = {
  type: "notification";
  notification: {
    id: string;
    notification_id: string;
    user_id: string;
    category: string;
    event_type: string;
    priority: string;
    title: string;
    body: string;
    entity_type: string;
    entity_id: string;
    read_at: string | null;
    created_at: string;
  };
  unreadCount?: number;
};

interface Env {
  NOTIFICATION_HUB: DurableObjectNamespace;
  REALTIME_JWT_SECRET: string;
  REALTIME_BROADCAST_SECRET: string;
}

export class NotificationHub extends DurableObject<Env> {
  private sessions: Map<WebSocket, SessionInfo> = new Map();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocketUpgrade(request);
    }

    if (url.pathname.endsWith("/broadcast") && request.method === "POST") {
      return this.handleBroadcast(request);
    }

    return new Response("OK", { status: 200 });
  }

  private handleWebSocketUpgrade(request: Request): Response {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    const id = crypto.randomUUID();
    this.sessions.set(server, {
      id,
      userId: "",
      airtableUserId: "",
      role: "",
      connectedAt: Date.now(),
    });

    server.addEventListener("message", (event: MessageEvent) => {
      this.handleMessage(server, event.data);
    });
    server.addEventListener("close", () => {
      this.sessions.delete(server);
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  private handleMessage(ws: WebSocket, data: string | ArrayBuffer): void {
    const session = this.sessions.get(ws);
    if (!session) return;

    if (session.userId) {
      return;
    }

    try {
      const raw = typeof data === "string" ? data : new TextDecoder().decode(data);
      const msg = JSON.parse(raw) as { token?: string };
      if (!msg.token) {
        ws.send(JSON.stringify({ type: "error", message: "Missing token" }));
        ws.close(1008, "Missing token");
        return;
      }
      const payload = verifyJwt(msg.token, this.env.REALTIME_JWT_SECRET);
      if (!payload) {
        ws.send(JSON.stringify({ type: "error", message: "Invalid token" }));
        ws.close(1008, "Invalid token");
        return;
      }
      session.userId = payload.userId ?? "";
      session.airtableUserId = payload.airtableUserId ?? payload.userId ?? "";
      session.role = payload.role ?? "chatter";
      this.sessions.set(ws, session);
      ws.send(JSON.stringify({ type: "authenticated", userId: session.userId }));
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid message" }));
      ws.close(1008, "Invalid message");
    }
  }

  private async handleBroadcast(request: Request): Promise<Response> {
    const auth = request.headers.get("Authorization");
    const secret = this.env.REALTIME_BROADCAST_SECRET as string | undefined;
    if (!secret || auth !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    let body: { target: BroadcastTarget["target"]; userId?: string; role?: string; payload: RealtimeEventPayload };
    try {
      body = await request.json();
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    const { target, userId, role, payload } = body;
    this.broadcast({ target, userId, role }, payload);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  private broadcast(options: BroadcastTarget, payload: RealtimeEventPayload): void {
    const message = JSON.stringify(payload);
    this.sessions.forEach((session, ws) => {
      if (ws.readyState !== 1) return;
      if (!session.userId) return;
      let send = false;
      switch (options.target) {
        case "user":
          send = options.userId && (session.userId === options.userId || session.airtableUserId === options.userId);
          break;
        case "admins":
          send = session.role === "admin";
          break;
        case "role":
          send = options.role ? session.role === options.role : false;
          break;
        case "all":
          send = true;
          break;
      }
      if (send) {
        try {
          ws.send(message);
        } catch {
          this.sessions.delete(ws);
        }
      }
    });
  }
}

function verifyJwt(token: string, secret: string): { userId?: string; airtableUserId?: string; role?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1])) as { sub?: string; userId?: string; airtableUserId?: string; role?: string; exp?: number };
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return {
      userId: payload.sub ?? payload.userId,
      airtableUserId: payload.airtableUserId ?? payload.sub ?? payload.userId,
      role: payload.role,
    };
  } catch {
    return null;
  }
}
