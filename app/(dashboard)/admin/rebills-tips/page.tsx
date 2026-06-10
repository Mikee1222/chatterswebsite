import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { listAllRecords, type AirtableRecord } from "@/lib/airtable-server";
import {
  AdminRebillsTipsClient,
  type AdminRebillRow,
  type AdminTipRow,
} from "@/components/admin-rebills-tips-client";

type RebillFields = {
  rebill_id?: string;
  chatter_id?: string;
  chatter_name?: string;
  model_id?: string;
  model_name?: string;
  sub_username?: string;
  sub_type?: string;
  screenshot?: Array<{ id?: string; url?: string; filename?: string }>;
  status?: string;
  admin_notes?: string;
  created_at?: string;
};

type TipFields = {
  tip_id?: string;
  chatter_id?: string;
  chatter_name?: string;
  model_id?: string;
  model_name?: string;
  sub_username?: string;
  amount_usd?: number;
  screenshot?: Array<{ id?: string; url?: string; filename?: string }>;
  status?: string;
  admin_notes?: string;
  created_at?: string;
};

function mapRebill(rec: AirtableRecord<RebillFields>): AdminRebillRow {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    rebill_id: String(f.rebill_id ?? "").trim(),
    chatter_id: String(f.chatter_id ?? "").trim(),
    chatter_name: String(f.chatter_name ?? "").trim() || "—",
    model_id: String(f.model_id ?? "").trim(),
    model_name: String(f.model_name ?? "").trim() || "—",
    sub_username: String(f.sub_username ?? "").trim(),
    sub_type: (String(f.sub_type ?? "").trim() || "paid") as AdminRebillRow["sub_type"],
    screenshot: Array.isArray(f.screenshot)
      ? f.screenshot.map((s) => ({ id: s?.id, url: s?.url, filename: s?.filename }))
      : [],
    status: (String(f.status ?? "").trim() || "pending") as AdminRebillRow["status"],
    admin_notes: String(f.admin_notes ?? "").trim(),
    created_at: String(f.created_at ?? "").trim(),
  };
}

function mapTip(rec: AirtableRecord<TipFields>): AdminTipRow {
  const f = rec.fields ?? {};
  const amt = f.amount_usd;
  const amount_usd =
    typeof amt === "number" && Number.isFinite(amt) ? amt : Number.parseFloat(String(amt ?? "")) || 0;
  return {
    id: rec.id,
    tip_id: String(f.tip_id ?? "").trim(),
    chatter_id: String(f.chatter_id ?? "").trim(),
    chatter_name: String(f.chatter_name ?? "").trim() || "—",
    model_id: String(f.model_id ?? "").trim(),
    model_name: String(f.model_name ?? "").trim() || "—",
    sub_username: String(f.sub_username ?? "").trim(),
    amount_usd,
    screenshot: Array.isArray(f.screenshot)
      ? f.screenshot.map((s) => ({ id: s?.id, url: s?.url, filename: s?.filename }))
      : [],
    status: (String(f.status ?? "").trim() || "pending") as AdminTipRow["status"],
    admin_notes: String(f.admin_notes ?? "").trim(),
    created_at: String(f.created_at ?? "").trim(),
  };
}

export default async function AdminRebillsTipsPage() {
  const user = await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.BILLING_VIEW);

  const sort = [{ field: "created_at", direction: "desc" as const }];

  const [rebillRecs, tipRecs] = await Promise.all([
    listAllRecords<RebillFields>("rebills", { sort, _caller: "admin.rebills-tips.page" }).catch(() => []),
    listAllRecords<TipFields>("tips", { sort, _caller: "admin.rebills-tips.page" }).catch(() => []),
  ]);

  const initialRebills = rebillRecs
    .map((r) => mapRebill(r as AirtableRecord<RebillFields>))
    .filter((r) => r.sub_type === "paid");
  const initialTips = tipRecs.map((r) => mapTip(r as AirtableRecord<TipFields>));

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
      <AdminRebillsTipsClient initialRebills={initialRebills} initialTips={initialTips} />
    </div>
  );
}
