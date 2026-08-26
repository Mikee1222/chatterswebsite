import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { executeGunzoTool } from "@/services/gunzo-agent-exec";
import {
  getAgentActionLogById,
  updateAgentActionLog,
} from "@/services/gunzo-agent-log";

const bodySchema = z.object({
  log_id: z.string().uuid(),
  confirm: z.boolean(),
});

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.AI_AGENT_USE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminId = (session.airtableUserId ?? session.id)?.trim();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { log_id, confirm } = parsed.data;

  try {
    const log = await getAgentActionLogById(log_id);
    if (!log) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (log.executed_by !== adminId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (log.status !== "proposed") {
      return NextResponse.json(
        { error: `Log is already ${log.status}`, log },
        { status: 409 },
      );
    }

    if (!confirm) {
      const cancelled = await updateAgentActionLog(log_id, {
        status: "cancelled",
        confirmed_at: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, cancelled: true, log: cancelled });
    }

    const result = await executeGunzoTool(log.tool_name, log.parameters, {
      user: session,
      confirmed: true,
    });

    if (!result.ok) {
      const failed = await updateAgentActionLog(log_id, {
        status: "failed",
        confirmed_at: new Date().toISOString(),
        result: { summary: result.summary, data: result.data ?? null },
        error_message: result.error ?? result.summary,
      });
      return NextResponse.json(
        { success: false, error: result.error ?? result.summary, log: failed },
        { status: 400 },
      );
    }

    const executed = await updateAgentActionLog(log_id, {
      status: "executed",
      confirmed_at: new Date().toISOString(),
      result: { summary: result.summary, data: result.data ?? null },
      error_message: null,
    });

    return NextResponse.json({ success: true, log: executed, result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    try {
      await updateAgentActionLog(log_id, {
        status: "failed",
        confirmed_at: new Date().toISOString(),
        error_message: msg,
      });
    } catch {
      /* ignore secondary failure */
    }
    return NextResponse.json({ error: msg || "Confirm failed" }, { status: 500 });
  }
}
