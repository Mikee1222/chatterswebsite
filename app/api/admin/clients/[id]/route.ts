import { NextResponse } from "next/server";
import { z } from "zod";
import { listAllRecords } from "@/lib/airtable-server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getCycleAmountDue } from "@/lib/client-portal-utils";
import {
  feeFromRevenue,
  getBillingCycleRevenuesForCycles,
} from "@/services/client-billing";
import {
  getAdminClientById,
  getClientBillingCycles,
  updateAdminClient,
} from "@/services/client-portal";
import type { BillingCycleRevenueStatus } from "@/types/client-portal";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "clients:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;

  const [client, clientModelsRecords, billingCyclesRaw] = await Promise.all([
    getAdminClientById(id),
    listAllRecords<Record<string, unknown>>("client_models", {
      _caller: "admin/clients/[id]:GET:client_models",
    }).then(records => records.filter(r => {
      const clients = Array.isArray(r.fields.client) ? r.fields.client : [];
      return clients.includes(id);
    })),
    getClientBillingCycles(id),
  ]);

  const billingCycles = [...billingCyclesRaw]
    .sort((a, b) => b.period_start.localeCompare(a.period_start))
    .slice(0, 5);

  const cycleRevenues = await getBillingCycleRevenuesForCycles(
    billingCycles.map((c) => c.id)
  );

  const cyclesWithStatus = billingCycles.map((cycle) => {
    const clientRevenues = cycleRevenues.filter(
      (r) => r.billing_cycle.includes(cycle.id) && r.client.includes(id)
    );

    const correct_amount_due =
      clientRevenues.length > 0
        ? clientRevenues.reduce((sum, r) => sum + feeFromRevenue(r), 0)
        : getCycleAmountDue(cycle);

    if (cycle.kind === "chatting_weekly" && clientRevenues.length > 0) {
      const statuses = clientRevenues.map((r) => r.status ?? "draft");
      const statusPriority: BillingCycleRevenueStatus[] = [
        "confirmed_paid",
        "pending_review",
        "announced",
        "overdue",
        "draft",
      ];
      const resolvedStatus = statusPriority.find((s) => statuses.includes(s)) ?? "draft";
      return { ...cycle, status: resolvedStatus as typeof cycle.status, correct_amount_due };
    }

    return { ...cycle, correct_amount_due };
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

  return NextResponse.json({ client, models, billingCycles: cyclesWithStatus });
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
    telegram_group_link: z.string().url().optional().or(z.literal("")),
    telegram_group_name: z.string().max(200).optional(),
  })
  .refine(
    (data) =>
      data.portal_access !== undefined ||
      data.company_name !== undefined ||
      data.display_name !== undefined ||
      data.email !== undefined ||
      data.client_percentage !== undefined ||
      data.status !== undefined ||
      data.password !== undefined ||
      data.telegram_group_link !== undefined ||
      data.telegram_group_name !== undefined,
    { message: "At least one field is required." }
  );

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "clients:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
