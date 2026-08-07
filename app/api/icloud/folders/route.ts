import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { addIcloudFolderEntry } from "@/services/icloud";

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canView = await hasPermission(session, PERMISSIONS.ICLOUD_MANAGEMENT_VIEW);
  const canManage = await hasPermission(session, PERMISSIONS.ICLOUD_MANAGEMENT_MANAGE);
  if (!canView && !canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  try {
    const entry = await addIcloudFolderEntry({
      bunch_id: String(body.bunch_id ?? ""),
      folder_label: String(body.folder_label ?? ""),
      folder_link: String(body.folder_link ?? ""),
      material_until_date: body.material_until_date == null ? null : String(body.material_until_date),
      created_by_id: session.airtableUserId ?? session.id,
      created_by_name: (session.fullName || session.email || "").trim(),
    });
    return NextResponse.json({ entry });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}
