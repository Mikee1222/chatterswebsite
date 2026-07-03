import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { PdfMakerClient } from "@/components/pdf-maker-client";

export default async function AdminPdfMakerPage() {
  const user = await getSessionFromCookies();
  if (!user || !(await hasPermission(user, PERMISSIONS.PDF_MAKER_MANAGE))) redirect(ROUTES.dashboard);
  return <PdfMakerClient />;
}
