import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { CONTENT_TYPE_VALUES, FLOW_VALUES } from "@/lib/brief-drafts-schema";
import { draftBriefsFromBreakdown, listDraftSets } from "@/services/brief-drafts";
import type { PostingBriefRegion } from "@/services/posting-briefs";

export const maxDuration = 180;

type Ctx = { params: Promise<{ id: string }> };

/** GET → draft sets already generated from this breakdown. */
export async function GET(_req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CREATIVE_STUDIO_USE))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  try {
    return Response.json({ sets: await listDraftSets(id) });
  } catch {
    return Response.json({ error: "Could not load draft sets" }, { status: 500 });
  }
}

/**
 * POST { modelId, contentType: "editable"|"creation", flow: "batch"|"urgent"|"trend",
 *        variationCount?, accountHandle?, region? }
 * Creates DRAFT briefs in the Recording / Editing / Posting modules. Never publishes.
 */
export async function POST(req: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CREATIVE_STUDIO_USE))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    modelId?: string;
    contentType?: string;
    flow?: string;
    variationCount?: number;
    accountHandle?: string;
    region?: string;
    contentSource?: string;
  };

  const modelId = body.modelId?.trim();
  if (!modelId) return Response.json({ error: "modelId required" }, { status: 400 });
  const contentType = CONTENT_TYPE_VALUES.find((v) => v === body.contentType);
  if (!contentType) {
    return Response.json({ error: "contentType must be editable or creation" }, { status: 400 });
  }
  const flow = FLOW_VALUES.find((v) => v === body.flow) ?? "batch";
  const region: PostingBriefRegion =
    body.region === "USA" || body.region === "Global" ? body.region : "Greece";

  const canEditing = await hasPermission(session, PERMISSIONS.EDITING_BRIEFS_MANAGE);
  const canRecording = await hasPermission(session, PERMISSIONS.RECORDING_BRIEFS_MANAGE);
  const canPosting = await hasPermission(session, PERMISSIONS.POSTING_BRIEFS_MANAGE);
  if (!canEditing) {
    return Response.json({ error: "You need editing_briefs:manage to draft briefs" }, { status: 403 });
  }
  if (contentType === "creation" && !canRecording) {
    return Response.json(
      { error: "You need recording_briefs:manage to draft a recording brief" },
      { status: 403 },
    );
  }

  try {
    const result = await draftBriefsFromBreakdown({
      breakdownId: id,
      modelId,
      contentType,
      flow,
      variationCount: typeof body.variationCount === "number" ? body.variationCount : undefined,
      accountHandle: body.accountHandle,
      region,
      userId: session.airtableUserId ?? session.id,
      skipPosting: !canPosting,
      contentSource:
        body.contentSource === "proven" ||
        body.contentSource === "experimental" ||
        body.contentSource === "recreation"
          ? body.contentSource
          : "",
    });
    return Response.json({ set: result.set, warnings: result.warnings });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not draft briefs";
    const status = msg.includes("Rate limit") ? 429 : msg.includes("not found") ? 404 : 400;
    return Response.json({ error: msg }, { status });
  }
}
