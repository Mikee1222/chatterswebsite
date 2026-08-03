import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { listAllRebills } from "@/services/rebills";
import { listAllTips } from "@/services/tips";
import {
  AdminRebillsTipsClient,
  type AdminRebillRow,
  type AdminTipRow,
} from "@/components/admin-rebills-tips-client";

function mapRebill(r: Awaited<ReturnType<typeof listAllRebills>>[number]): AdminRebillRow {
  const subTypeRaw = (r.sub_type || "paid").trim();
  const sub_type =
    subTypeRaw === "free" || subTypeRaw === "free_trial" || subTypeRaw === "paid"
      ? subTypeRaw
      : "paid";
  const statusRaw = (r.status || "pending").trim();
  const status =
    statusRaw === "verified" || statusRaw === "rejected" || statusRaw === "pending"
      ? statusRaw
      : "pending";
  return {
    id: r.id,
    rebill_id: r.rebill_id.trim(),
    chatter_id: r.chatter_id.trim(),
    chatter_name: r.chatter_name.trim() || "—",
    model_id: r.model_id.trim(),
    model_name: r.model_name.trim() || "—",
    sub_username: r.sub_username.trim(),
    sub_type,
    screenshot: r.screenshot.map((url) => ({ url })),
    status,
    admin_notes: (r.admin_notes || "").trim(),
    created_at: r.created_at?.trim() ?? "",
  };
}

function mapTip(r: Awaited<ReturnType<typeof listAllTips>>[number]): AdminTipRow {
  const statusRaw = (r.status || "pending").trim();
  const status =
    statusRaw === "verified" || statusRaw === "rejected" || statusRaw === "pending"
      ? statusRaw
      : "pending";
  return {
    id: r.id,
    tip_id: r.tip_id.trim(),
    chatter_id: r.chatter_id.trim(),
    chatter_name: r.chatter_name.trim() || "—",
    model_id: r.model_id.trim(),
    model_name: r.model_name.trim() || "—",
    sub_username: r.sub_username.trim(),
    amount_usd: Number.isFinite(r.amount_usd) ? r.amount_usd : 0,
    screenshot: r.screenshot.map((url) => ({ url })),
    status,
    admin_notes: (r.admin_notes || "").trim(),
    created_at: r.created_at?.trim() ?? "",
  };
}

function byCreatedDesc(a: { created_at: string }, b: { created_at: string }) {
  return (b.created_at || "").localeCompare(a.created_at || "");
}

export default async function AdminRebillsTipsPage() {
  await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.BILLING_VIEW);

  const [rebillRecs, tipRecs] = await Promise.all([
    listAllRebills().catch(() => []),
    listAllTips().catch(() => []),
  ]);

  const initialRebills = rebillRecs
    .map(mapRebill)
    .filter((r) => r.sub_type === "paid")
    .sort(byCreatedDesc);
  const initialTips = tipRecs.map(mapTip).sort(byCreatedDesc);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
      <AdminRebillsTipsClient initialRebills={initialRebills} initialTips={initialTips} />
    </div>
  );
}
