/**
 * withAgentAudit — wrap allowlisted mutating API handlers for Hermes agent tokens.
 * Logs to agent_action_log AFTER the response status is known.
 * Never logs token/hash/body/headers/files. Logging failures never break the request.
 *
 * agent_action_log CHECK allows action_type read|action and status
 * proposed|confirmed|executed|failed|cancelled. We store action_type "action",
 * status executed|failed from HTTP outcome, and put http_status + kind "agent_http"
 * in parameters (table reused as-is — no schema change).
 */

import type { AuthUser } from "@/lib/auth-config";
import { matchAgentAllowlist } from "@/lib/agent-allowlist";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

type AgentSession = AuthUser & { via?: "cookie" | "agent_token"; agentTokenId?: string };

function isAgentTokenSession(session: AuthUser | null | undefined): session is AgentSession {
  return Boolean(session && (session as AgentSession).via === "agent_token");
}

async function insertAgentHttpLog(input: {
  session: AgentSession;
  method: string;
  pathname: string;
  status: number;
  ip: string | null;
  userAgent: string | null;
  errorMessage?: string | null;
}): Promise<void> {
  const rule = matchAgentAllowlist(input.method, input.pathname);
  const tool_name = rule?.pattern ?? `${input.method} ${input.pathname}`;
  const httpOk = input.status >= 200 && input.status < 400;
  const sb = getSupabaseServiceClient();
  await sb.from("agent_action_log").insert({
    action_type: "action",
    tool_name,
    parameters: {
      kind: "agent_http",
      http_status: String(input.status),
      route: input.pathname,
      agent_token_id: input.session.agentTokenId ?? null,
      ip: input.ip,
      user_agent: input.userAgent,
    },
    executed_by: input.session.airtableUserId ?? input.session.id,
    executed_by_name: input.session.fullName?.trim() || input.session.email || null,
    status: httpOk ? "executed" : "failed",
    confirmed_at: new Date().toISOString(),
    error_message: input.errorMessage ?? (httpOk ? null : `HTTP ${input.status}`),
    result: { http_status: input.status },
  });
}

function clientMeta(req: Request): {
  method: string;
  pathname: string;
  ip: string | null;
  userAgent: string | null;
} {
  const url = new URL(req.url);
  const forwarded = req.headers.get("x-forwarded-for");
  return {
    method: req.method.toUpperCase(),
    pathname: url.pathname,
    ip: forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim() || null,
    userAgent: req.headers.get("user-agent")?.trim() || null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRouteHandler = (req: Request, ...rest: any[]) => Promise<Response>;

/**
 * Wrap a POST (or other mutating) route handler. Only inserts audit rows when
 * the authenticated session used via === "agent_token".
 */
export function withAgentAudit<T extends AnyRouteHandler>(handler: T): T {
  const wrapped = (async (req: Request, ...rest: unknown[]) => {
    const meta = clientMeta(req);

    let response: Response;
    try {
      response = await handler(req, ...rest);
    } catch (err) {
      try {
        const { getSessionFromCookies } = await import("@/lib/auth");
        const session = await getSessionFromCookies();
        if (isAgentTokenSession(session)) {
          await insertAgentHttpLog({
            session,
            method: meta.method,
            pathname: meta.pathname,
            status: 500,
            ip: meta.ip,
            userAgent: meta.userAgent,
            errorMessage: err instanceof Error ? err.message : "handler threw",
          });
        }
      } catch {
        /* never break */
      }
      throw err;
    }

    try {
      const { getSessionFromCookies } = await import("@/lib/auth");
      const session = await getSessionFromCookies();
      if (isAgentTokenSession(session)) {
        await insertAgentHttpLog({
          session,
          method: meta.method,
          pathname: meta.pathname,
          status: response.status,
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
      }
    } catch {
      /* never break the request */
    }

    return response;
  }) as T;
  return wrapped;
}
