import { NextResponse } from "next/server";
import { createRecord, listRecords, updateRecord, type AirtableRecord } from "@/lib/airtable-server";
import { OF_SUBSCRIBERS_TABLE } from "@/lib/airtable-schema";
import { listAllModelss } from "@/services/modelss";
import { categorizeSubscriber, type OFSubscriber } from "@/services/of-subscribers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TABLE = OF_SUBSCRIBERS_TABLE;

type OnlyApiWebhookEvent =
  | "new_tip"
  | "new_purchase"
  | "renewed_subscriber"
  | "expired_subscriber"
  | "balance_increased"
  | "new_message"
  | "payout_completed";

type WebhookBody = {
  event?: string;
  of_user_id?: string;
  fan_user_id?: string;
  amount?: number;
  data?: Record<string, unknown>;
};

type SubscriberFields = {
  of_user_id?: number;
  of_account_id?: string;
  model_name?: string;
  display_name?: string;
  username?: string;
  subscribed_at?: string;
  expires_at?: string;
  total_spent?: number;
  category?: string;
  last_synced_at?: string;
};

function escapeFormulaString(s: string): string {
  return s.replace(/"/g, '""');
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function verifyWebhookSecret(request: Request): boolean {
  const secret = process.env.ONLYAPI_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret) {
    console.warn("[webhook/onlyapi] ONLYAPI_WEBHOOK_SECRET is not set — accepting webhook without verification.");
    return true;
  }
  const h1 = request.headers.get("x-webhook-secret")?.trim();
  const h2 = request.headers.get("x-signature")?.trim();
  return h1 === secret || h2 === secret;
}

async function findSubscriber(
  modelOfUserId: string,
  fanUserId: number
): Promise<AirtableRecord<SubscriberFields> | null> {
  const esc = escapeFormulaString(modelOfUserId.trim());
  const { records } = await listRecords<SubscriberFields>(TABLE, {
    filterByFormula: `AND({of_account_id}="${esc}", {of_user_id}=${fanUserId})`,
    pageSize: 1,
    _caller: "onlyapi-webhook",
  });
  return records[0] ?? null;
}

async function resolveModelName(modelOfUserId: string): Promise<string> {
  const esc = escapeFormulaString(modelOfUserId.trim());
  try {
    const rows = await listAllModelss(`{of_user_id}="${esc}"`);
    const name = rows[0]?.model_name?.trim();
    if (name) return name;
  } catch {
    /* ignore */
  }
  return modelOfUserId.trim();
}

function parseAmount(body: WebhookBody): number {
  if (typeof body.amount === "number" && Number.isFinite(body.amount)) return body.amount;
  const d = body.data;
  if (d && typeof d.amount === "number" && Number.isFinite(d.amount)) return d.amount;
  if (d && typeof d.amount === "string") {
    const n = Number(d.amount);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function parseExpiresAt(data: Record<string, unknown> | undefined): string | undefined {
  if (!data) return undefined;
  const v =
    (typeof data.expires_at === "string" && data.expires_at) ||
    (typeof data.expires === "string" && data.expires) ||
    (typeof data.expiresAt === "string" && data.expiresAt);
  return v || undefined;
}

export async function POST(request: Request) {
  try {
    if (!verifyWebhookSecret(request)) {
      console.warn("[webhook/onlyapi] rejected: invalid x-webhook-secret / x-signature");
      return NextResponse.json({ received: true });
    }

    let body: WebhookBody;
    try {
      body = (await request.json()) as WebhookBody;
    } catch {
      console.warn("[webhook/onlyapi] invalid JSON body");
      return NextResponse.json({ received: true });
    }

    const event = body.event as OnlyApiWebhookEvent | undefined;
    const modelOfUserId = String(body.of_user_id ?? "").trim();
    const fanRaw = String(body.fan_user_id ?? "").trim();
    const fanNum = Number(fanRaw);
    const data = body.data ?? {};

    if (!event || !modelOfUserId || !fanRaw || !Number.isFinite(fanNum)) {
      console.warn("[webhook/onlyapi] missing event, of_user_id, or fan_user_id", { event, modelOfUserId, fanRaw });
      return NextResponse.json({ received: true });
    }

    switch (event) {
      case "new_tip":
      case "new_purchase":
      case "balance_increased": {
        const amount = roundMoney(parseAmount(body));
        const existing = await findSubscriber(modelOfUserId, fanNum);
        const nowIso = new Date().toISOString();

        if (existing) {
          const prev = Number(existing.fields.total_spent ?? 0);
          const total_spent = roundMoney(prev + amount);
          const sub: OFSubscriber = {
            of_user_id: fanNum,
            username: String(existing.fields.username ?? ""),
            display_name: String(existing.fields.display_name ?? ""),
            subscribed_at: String(existing.fields.subscribed_at ?? nowIso),
            expires_at: String(existing.fields.expires_at ?? ""),
            total_spent,
          };
          const category = categorizeSubscriber(sub);
          await updateRecord<SubscriberFields>(TABLE, existing.id, {
            total_spent,
            category,
            last_synced_at: nowIso,
          });
          console.log(
            `[webhook] tip/purchase: fan_user_id=${fanRaw}, amount=${amount}, model of_user_id=${modelOfUserId} (${event})`
          );
        } else if (amount >= 500) {
          const model_name = await resolveModelName(modelOfUserId);
          const nowIso = new Date().toISOString();
          const sub: OFSubscriber = {
            of_user_id: fanNum,
            username: String(data.username ?? ""),
            display_name: String(data.display_name ?? data.username ?? ""),
            subscribed_at: String(data.subscribed_at ?? nowIso),
            expires_at: String(data.expires_at ?? ""),
            total_spent: amount,
          };
          await createRecord(TABLE, {
            of_user_id: fanNum,
            of_account_id: modelOfUserId,
            model_name,
            display_name: sub.display_name,
            username: sub.username,
            subscribed_at: sub.subscribed_at,
            expires_at: sub.expires_at || undefined,
            last_synced_at: nowIso,
            total_spent: amount,
            category: categorizeSubscriber(sub),
          });
          console.log(
            `[webhook] tip/purchase: fan_user_id=${fanRaw}, amount=${amount}, model of_user_id=${modelOfUserId} (created row, ${event})`
          );
        } else {
          console.log(
            `[webhook] tip/purchase: fan_user_id=${fanRaw}, amount=${amount}, model of_user_id=${modelOfUserId} (no row, below create threshold)`
          );
        }
        break;
      }
      case "renewed_subscriber":
      case "expired_subscriber": {
        const existing = await findSubscriber(modelOfUserId, fanNum);
        const expiresAt = parseExpiresAt(data);
        if (existing && expiresAt) {
          await updateRecord<SubscriberFields>(TABLE, existing.id, {
            expires_at: expiresAt,
            last_synced_at: new Date().toISOString(),
          });
        }
        console.log(`[webhook] ${event}: fan_user_id=${fanRaw}, model of_user_id=${modelOfUserId}`, {
          expires_at: expiresAt,
          found: Boolean(existing),
        });
        break;
      }
      case "new_message": {
        console.log(`[webhook] new_message: fan_user_id=${fanRaw}, model of_user_id=${modelOfUserId}`, data);
        break;
      }
      case "payout_completed":
      default: {
        console.log(`[webhook] ${String(event)}: fan_user_id=${fanRaw}, model of_user_id=${modelOfUserId}`, data);
        break;
      }
    }
  } catch (e) {
    console.error("[webhook/onlyapi] handler error", e);
  }

  return NextResponse.json({ received: true });
}
