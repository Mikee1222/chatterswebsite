import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { notify } from "@/services/notification-service";
import { listAllUsers } from "@/services/users";
import { createFineBonus, listFinesBonuses, type CreateFineBonusInput } from "@/services/fines-bonuses";
import { NOTIFICATION_ENTITY, NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } from "@/lib/notification-types";

function isStaffAdmin(session: { role: string } | null): boolean {
  return session != null && (session.role === "admin" || session.role === "manager");
}

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!isStaffAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
  if (!isStaffAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
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
    const amt = record.amount.toFixed(2);
    const title = parsed.data.type === "bonus" ? " Bonus added!" : " Fine issued";
    const bodyText =
      parsed.data.type === "bonus"? `You received a €${amt} bonus: ${parsed.data.reason}`
        : `A €${amt} fine was applied: ${parsed.data.reason}`;

    await notify({
      user_id: parsed.data.user_id,
      event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
      priority: NOTIFICATION_PRIORITY.NORMAL,
      title,
      body: bodyText,
      entity_type: NOTIFICATION_ENTITY.FINE_BONUS,
      entity_id: id,
      actor_user_id: adminId,
      actor_name: adminName,
      _triggerSource: "admin_fines_bonuses_post",
    }).catch(() => {});

    return NextResponse.json({ success: true, id, entry: record });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg || "Create failed" }, { status: 500 });
  }
}
