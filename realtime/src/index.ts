/**
 * Realtime Worker: routes WebSocket upgrade and broadcast POST to the NotificationHub Durable Object.
 */

import { NotificationHub } from "./NotificationHub";

export { NotificationHub };

export interface Env {
  NOTIFICATION_HUB: DurableObjectNamespace;
  REALTIME_JWT_SECRET: string;
  REALTIME_BROADCAST_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/realtime")) {
      return new Response("Not Found", { status: 404 });
    }
    const id = env.NOTIFICATION_HUB.idFromName("default");
    const stub = env.NOTIFICATION_HUB.get(id);
    return stub.fetch(request);
  },
};
