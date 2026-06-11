import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { listLinkPages } from "@/services/link-pages";
import { listAllModelss } from "@/services/modelss";
import { AdminLinkPagesClient } from "@/components/admin-link-pages-client";
import type { LinkPageRecord } from "@/types";

export default async function AdminLinkPagesPage() {
  await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.LINK_PAGES_VIEW);

  const [pages, models] = await Promise.all([
    listLinkPages().catch(() => [] as LinkPageRecord[]),
    listAllModelss().catch(() => []),
  ]);

  const modelById: Record<string, string> = Object.fromEntries(
    models.map((m) => [m.id, (m.model_name ?? "").trim() || "Model"])
  );

  return <AdminLinkPagesClient initialPages={pages} modelById={modelById} models={models} />;
}
