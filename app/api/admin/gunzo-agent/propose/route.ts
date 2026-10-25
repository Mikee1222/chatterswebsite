/**
 * Propose an ACTION tool from the UI (e.g. Save caption / Use in brief cards).
 * Creates an agent_action_log row for Confirm/Cancel — never executes writes.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  GUNZO_TOOL_META,
  isGunzoActionTool,
  isGunzoToolName,
} from "@/lib/gunzo-agent-tools";
import { sanitizeGunzoActionParameters } from "@/lib/gunzo-agent-action-sanitize";
import { insertProposedAction, updateAgentActionLog } from "@/services/gunzo-agent-log";

const bodySchema = z.object({
  tool_name: z.string().min(1),
  parameters: z.record(z.unknown()).default({}),
});

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.AI_AGENT_USE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  const { tool_name, parameters } = parsed.data;
  if (!isGunzoToolName(tool_name) || !isGunzoActionTool(tool_name)) {
    return NextResponse.json({ error: "Only ACTION tools can be proposed" }, { status: 400 });
  }

  const meta = GUNZO_TOOL_META[tool_name];
  if (meta.requiredPermission) {
    if (!(await hasPermission(session, meta.requiredPermission))) {
      return NextResponse.json(
        { error: `Missing permission: ${meta.requiredPermission}` },
        { status: 403 },
      );
    }
  }

  const executed_by = (session.airtableUserId ?? session.id)?.trim() || session.id;
  const executed_by_name = (session.fullName ?? session.email ?? "Admin").trim() || "Admin";

  try {
    const { logParameters, executionPayload } = sanitizeGunzoActionParameters(
      tool_name,
      parameters as Record<string, unknown>,
    );
    const log = await insertProposedAction({
      tool_name,
      parameters: logParameters,
      executed_by,
      executed_by_name,
      action_type: "action",
    });
    if (executionPayload) {
      await updateAgentActionLog(log.id, { result: { _exec: executionPayload } });
    }
    return NextResponse.json({
      pendingAction: {
        log_id: log.id,
        tool_name,
        parameters: logParameters,
        description: meta.description,
        proposed_at: log.proposed_at,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg || "Propose failed" }, { status: 500 });
  }
}
