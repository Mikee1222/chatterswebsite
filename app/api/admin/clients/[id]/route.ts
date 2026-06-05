import { NextResponse } from "next/server";
import { z } from "zod";
import { listAllRecords } from "@/lib/airtable-server";
import { getSessionFromCookies } from "@/lib/auth";
import { getClientBillingCycles, updateAdminClient } from "@/services/client-portal";

function isAdminOrManager(session: Awaited<ReturnType<typeof getSessionFromCookies>>) {
  return session != null && (session.role === "admin" || session.role === "manager");
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!isAdminOrManager(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;

  const [clientModelsRecords, billingCycles, revenues] = await Promise.all([
    listAllRecords<Record<string, unknown>>("client_models", {
      _caller: "admin/clients/[id]:GET:client_models",
    }).then(records => records.filter(r => {
      const clients = Array.isArray(r.fields.client) ? r.fields.client : [];
      return clients.includes(id);
    })),
    getClientBillingCycles(id).then((cycles) =>
      [...cycles]
        .sort((a, b) => b.period_start.localeCompare(a.period_start))
        .slice(0, 5)
    ),
    listAllRecords<Record<string, unknown>>("billing_cycle_revenues", {
      _caller: "admin/clients/[id]:cycle_revenues",
    }),
  ]);

  const cyclesWithStatus = billingCycles.map((cycle) => {
    if (cycle.kind === "chatting_weekly") {
      const cycleRevenues = revenues.filter((r) => {
        const bc = Array.isArray(r.fields.billing_cycle) ? r.fields.billing_cycle : [];
        return bc.includes(cycle.id);
      });
      if (cycleRevenues.length > 0) {
        const statuses = cycleRevenues.map((r) => String(r.fields.status ?? "draft"));
        const statusPriority = ["confirmed_paid", "pending_review", "announced", "overdue", "draft"];
        const resolvedStatus = statusPriority.find((s) => statuses.includes(s)) ?? "draft";
        return { ...cycle, status: resolvedStatus as typeof cycle.status };
      }
    }
    return cycle;
  });

  const modelIds = clientModelsRecords.flatMap((r) =>
    Array.isArray(r.fields.model) ? r.fields.model as string[] : []
  );

  // Fetch all modelss in one call instead of N individual calls
  const allModelss = modelIds.length > 0
    ? await listAllRecords<Record<string, unknown>>("modelss", {
        _caller: "admin/clients/[id]:GET:modelss",
      })
    : [];

  const modelNameMap = Object.fromEntries(
    allModelss.map(r => [r.id, String(r.fields.model_name ?? "Unnamed")])
  );

  const models = clientModelsRecords.map((r) => ({
    id: r.id,
    client: Array.isArray(r.fields.client) ? r.fields.client : [],
    model: Array.isArray(r.fields.model) ? r.fields.model : [],
    model_name:
      modelNameMap[Array.isArray(r.fields.model) ? r.fields.model[0] : ""] ?? "Unnamed",
  }));

  return NextResponse.json({ models, billingCycles: cyclesWithStatus });
}

const patchSchema = z
  .object({
    portal_access: z.boolean().optional(),
    company_name: z.string().optional(),
    display_name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    client_percentage: z.number().min(0).max(1).optional(),
    status: z.enum(["active", "inactive", "suspended"]).optional(),
    password: z.string().min(8).optional(),
  })
  .refine(
    (data) =>
      data.portal_access !== undefined ||
      data.company_name !== undefined ||
      data.display_name !== undefined ||
      data.email !== undefined ||
      data.client_percentage !== undefined ||
      data.status !== undefined ||
      data.password !== undefined,
    { message: "At least one field is required." }
  );

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!isAdminOrManager(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 }
    );
  }

  const { password, ...rest } = parsed.data;
  let passwordHash: string | undefined;
  if (password) {
    const bcryptjs = await import("bcryptjs");
    passwordHash = await bcryptjs.hash(password, 10);
  }

  try {
    const client = await updateAdminClient(id, {
      ...rest,
      passwordHash,
    });
    return NextResponse.json({ client });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update client.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
