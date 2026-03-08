# Realtime WebSocket layer (Cloudflare Worker + Durable Object)

In-app real-time notifications use WebSockets. This Worker holds a single Durable Object (`NotificationHub`) that manages all client connections and broadcasts events (e.g. new notification) to the right users.

## Deploy

1. From this directory: `npm install` (if needed), then `npx wrangler deploy`.
2. Set secrets:
   - `npx wrangler secret put REALTIME_JWT_SECRET`
   - `npx wrangler secret put REALTIME_BROADCAST_SECRET`
3. In your Next.js app env set:
   - `NEXT_PUBLIC_REALTIME_WS_URL=https://<your-worker>.<subdomain>.workers.dev/realtime` (use `wss://` for the client; the client will connect to this URL).
   - `REALTIME_BROADCAST_URL=https://<your-worker>.<subdomain>.workers.dev`
   - `REALTIME_BROADCAST_SECRET` (same as in Worker)
   - `REALTIME_JWT_SECRET` (same as in Worker)

## Local dev

1. Copy `.dev.vars.example` to `.dev.vars` and set the two secrets.
2. Run `npx wrangler dev`.
3. In the Next.js app set `NEXT_PUBLIC_REALTIME_WS_URL=ws://localhost:8787/realtime` and `REALTIME_BROADCAST_URL=http://localhost:8787` (and the same secrets) for local testing.

## Flow

- Client gets a JWT from Next.js `GET /api/realtime-token`, then connects to `wss://.../realtime` and sends `{ "token": "<jwt>" }`. The DO verifies the JWT and associates the WebSocket with that user/role.
- When a notification is created (e.g. in `notify()` in the app), the server calls `POST /realtime/broadcast` with `Authorization: Bearer <REALTIME_BROADCAST_SECRET>` and body `{ target, userId?, role?, payload }`. The DO broadcasts the payload to matching connections (user, admins, role, or all).
- Client receives `{ type: "notification", notification, unreadCount }`, updates UI and shows a toast.
