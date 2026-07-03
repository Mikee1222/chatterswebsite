import { getSessionFromCookies } from "@/lib/auth";
import { requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { PdfMakerClient } from "@/components/pdf-maker-client";

export default async function AdminPdfMakerPage() {
  await requireAdminRoute(await getSessionFromCookies(), PERMISSIONS.PDF_MAKER_MANAGE);
  return <PdfMakerClient />;
}
