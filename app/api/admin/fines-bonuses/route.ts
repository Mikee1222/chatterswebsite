import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { bonusAwardedPersonal, fineIssuedPersonal } from "@/lib/notification-copy";
import { notifyByRoleConfig } from "@/services/notification-service";
import { listAllUsers } from "@/services/users";
import { createFineBonus, listFinesBonuses, type CreateFineBonusInput } from "@/services/fines-bonuses";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "fines:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  if (searchParams.get("pick_users") === "1") {
    try {
      const users = await listAllUsers();
      const pick = users
        .filter(
          (u) =>
            (u.role === "chatter" || u.role === "virtual_assistant") && (u.status ?? "").toLowerCase() === "active")
        .map((u) => ({
          id: u.id,
          name: (u.full_name ?? "").trim() || u.email || u.id,
          user_role: u.role === "virtual_assistant" ? ("va" as const) : ("chatter" as const),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return NextResponse.json({ users: pick });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  const user_id = searchParams.get("user_id") ?? undefined;
  const type = searchParams.get("type");
  const month = searchParams.get("month") ?? undefined;
  try {
    const entries = await listFinesBonuses({
      ...(user_id ? { user_id } : {}),
      ...(type === "bonus" || type === "fine" ? { type } : {}),
      ...(month ? { month } : {}),
    });
    return NextResponse.json({ entries });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

const postSchema = z.object({
  user_id: z.string().trim().min(1),
  user_name: z.string().trim().min(1),
  user_role: z.enum(["chatter", "va"]),
  type: z.enum(["bonus", "fine"]),
  amount: z.number().finite().min(0).max(1_000_000),
  reason: z.string().trim().min(1).max(500),
  notes: z.string().max(8000).optional().default(""),
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, "fines:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const adminId = (session!.airtableUserId ?? session!.id)?.trim();
  const adminName = (session!.fullName ?? session!.email ?? "Admin").trim() || "Admin";
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const input: CreateFineBonusInput = {
    ...parsed.data,
    admin_id: adminId,
    admin_name: adminName,
  };

  try {
    const { id, record } = await createFineBonus(input);
    const amt = record.amount;
    const isBonus = parsed.data.type === "bonus";
    const eventType = isBonus ? NOTIFICATION_EVENT.BONUS_AWARDED : NOTIFICATION_EVENT.FINE_ISSUED;
    const copy = isBonus
      ? bonusAwardedPersonal(amt, adminName, parsed.data.reason)
      : fineIssuedPersonal(amt, adminName, parsed.data.reason);

    await notifyByRoleConfig(eventType, {
      personal_user_id: parsed.data.user_id,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title: copy.title,
      body: copy.body,
      entity_type: NOTIFICATION_ENTITY.FINE_BONUS,
      entity_id: id,
      actor_user_id: adminId,
      actor_name: adminName,
      context: {
        amount: amt,
        reason: parsed.data.reason,
        adminName,
        chatterName: parsed.data.user_name,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, id, entry: record });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg || "Create failed" }, { status: 500 });
  }
}
