import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { listWhalesPaginated, getWhaleStatusCounts, type WhalesListFilters } from "@/services/whales";
import { listAllWhaleTransactions } from "@/services/whale-transactions";
import { listAllUsers } from "@/services/users";
import { listAllModelss } from "@/services/modelss";
import { AdminWhalesClient } from "@/components/admin-whales-client";
import type { Whale } from "@/types";

const PAGE_SIZE = 50;

function aggregateRevenueByModel(transactions: { model_name?: string; amount?: number }[]) {
  const byModel: Record<string, number> = {};
  for (const t of transactions) {
    const key = (t.model_name ?? "").trim() || "—";
    byModel[key] = (byModel[key] ?? 0) + (t.amount ?? 0);
  }
  return Object.entries(byModel).sort((a, b) => b[1] - a[1]);
}

function aggregateRevenueByChatter(transactions: { chatter_name?: string; amount?: number }[]) {
  const byChatter: Record<string, number> = {};
  for (const t of transactions) {
    const key = (t.chatter_name ?? "").trim() || "—";
    byChatter[key] = (byChatter[key] ?? 0) + (t.amount ?? 0);
  }
  return Object.entries(byChatter).sort((a, b) => b[1] - a[1]);
}

type SearchParams = { [key: string]: string | string[] | undefined };

function filtersFromSearchParams(sp: SearchParams): WhalesListFilters {
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  return {
    chatterId: get("chatter")?.trim() || undefined,
    modelId: get("model")?.trim() || undefined,
    relationshipStatus: get("relationship")?.trim() || undefined,
    status: get("status")?.trim() || undefined,
    usernameSearch: get("q")?.trim() || undefined,
  };
}

export default async function AdminWhalesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams> | SearchParams;
}) {
  const user = await getSessionFromCookies();
  if (!user || (user.role !== "admin" && user.role !== "manager")) redirect(ROUTES.dashboard);

  const params = await (searchParams instanceof Promise ? searchParams : Promise.resolve(searchParams));
  const filters = filtersFromSearchParams(params);
  const offset = (typeof params.offset === "string" ? params.offset : Array.isArray(params.offset) ? params.offset[0] : undefined) ?? undefined;

  const [paginated, statusCounts, transactions, users, modelss] = await Promise.all([
    listWhalesPaginated(filters, PAGE_SIZE, offset),
    getWhaleStatusCounts().catch(() => ({ total: 0, active: 0, inactive: 0, dead: 0, deleted: 0 })),
    listAllWhaleTransactions().catch(() => []),
    listAllUsers().catch(() => []),
    listAllModelss().catch(() => []),
  ]);

  let whales = paginated.whales as Whale[];
  if (filters.chatterId || filters.modelId) {
    if (filters.chatterId) whales = whales.filter((w) => w.assigned_chatter_id === filters.chatterId);
    if (filters.modelId) whales = whales.filter((w) => w.assigned_model_id === filters.modelId);
  }

  const chatters = users.filter((u) => u.role === "chatter");
  const byModel = aggregateRevenueByModel(transactions);
  const byChatter = aggregateRevenueByChatter(transactions);
  const modelOptions = modelss.map((m) => ({ id: m.id, name: m.model_name ?? "" }));

  return (
    <AdminWhalesClient
      whales={whales}
      nextOffset={paginated.nextOffset}
      pageSize={PAGE_SIZE}
      statusCounts={statusCounts}
      chatters={chatters.map((u) => ({ id: u.id, full_name: u.full_name ?? "" }))}
      modelOptions={modelOptions}
      revenueByModel={byModel}
      revenueByChatter={byChatter}
      initialFilters={{
        chatter: typeof params.chatter === "string" ? params.chatter : params.chatter?.[0],
        model: typeof params.model === "string" ? params.model : params.model?.[0],
        relationship: typeof params.relationship === "string" ? params.relationship : params.relationship?.[0],
        status: typeof params.status === "string" ? params.status : params.status?.[0],
        q: typeof params.q === "string" ? params.q : params.q?.[0],
      }}
    />
  );
}
