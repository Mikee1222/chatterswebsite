/**
 * Scripts-only: polyfill global WebSocket for Node < 22 before creating a Supabase client.
 * Import this before `lib/supabase-server` in any `scripts/*.ts` that uses Supabase.
 */
import ws from "ws";

if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as unknown as { WebSocket: typeof ws }).WebSocket = ws;
}
