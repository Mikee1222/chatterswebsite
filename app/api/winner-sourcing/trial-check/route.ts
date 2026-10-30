import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getAssignedModelIdsForUser } from "@/services/posting-briefs";
import { listTrialCheckAccounts, saveTrialViews } from "@/services/trial-check";

/**
 * Trial check (Content Flow v1.1). Instagram has no trial-reels API, so views are
 * typed by the Account Supervisor. Access: winner_sourcing:manage / posting_briefs:manage,
 * or posting_briefs:view for assigned models.
 */
async function access() {
  const session = await getSessionFromCookies();
  if (!session) return { ok: false as const, status: 401, error: "Unauthorized" };
  const canAll =
    (await hasPermission(session, PERMISSIONS.WINNER_SOURCING_MANAGE)) ||
    (await hasPermission(session, PERMISSIONS.POSTING_BRIEFS_MANAGE));
  const canView = canAll || (await hasPermission(session, PERMISSIONS.POSTING_BRIEFS_VIEW));
  if (!canView) return { ok: false as const, status: 403, error: "Forbidden" };
  const actorUserId = session.airtableUserId ?? session.id;
  let modelIds: Set<string> | null = null;
  if (!canAll) {
    const a = await getAssignedModelIdsForUser(actorUserId);
    const b = actorUserId !== session.id ? await getAssignedModelIdsForUser(session.id) : [];
    modelIds = new Set([...a, ...b]);
  }
  return { ok: true as const, actorUserId, actorName: session.fullName || session.email || undefined, modelIds };
}

export async function GET(req: Request) {
  const a = await access();
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const modelId = new URL(req.url).searchParams.get("model_id")?.trim() || undefined;
  try {
    let accounts = await listTrialCheckAccounts({ modelId });
    if (a.modelIds) accounts = accounts.filter((x) => a.modelIds!.has(x.model_id));
    return NextResponse.json({ accounts });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}

export async function POST(req: Request) {
  const a = await access();
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const body = (await req.json().catch(() => ({}))) as {
    entries?: Array<{ post_id?: string; views?: number }>;
  };
  const entries = (body.entries ?? [])
    .filter((e) => typeof e?.post_id === "string" && Number.isFinite(Number(e.views)))
    .map((e) => ({ post_id: String(e.post_id), views: Number(e.views) }));
  if (!entries.length) return NextResponse.json({ error: "entries required" }, { status: 400 });
  try {
    if (a.modelIds) {
      const allowed = await listTrialCheckAccounts({});
      const ok = new Set(
        allowed.filter((x) => a.modelIds!.has(x.model_id)).flatMap((x) => x.posts.map((p) => p.post_id)),
      );
      if (entries.some((e) => !ok.has(e.post_id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    const result = await saveTrialViews({ entries, actorUserId: a.actorUserId, actorName: a.actorName });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
