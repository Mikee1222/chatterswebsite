import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  buildStoryCtaScheduleRows,
  getStoryCtaTodayYmd,
  type StoryCtaScheduleModel,
} from "@/lib/story-cta-schedule";
import { getAccountsByVA } from "@/services/marketing";
import { listModelStoryLinkConfigs } from "@/services/model-story-link-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/va/story-link-schedule
 * Assigned models (marketing accounts) + weekly Story CTA schedule rows.
 */
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.VA_TASKS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const vaUserId = (session.airtableUserId ?? session.id).trim();
  if (!vaUserId) return NextResponse.json({ models: [], todayYmd: getStoryCtaTodayYmd() });

  const accounts = await getAccountsByVA(vaUserId);
  const modelMap = new Map<string, string>();
  for (const acc of accounts) {
    if (acc.assigned_va_id !== vaUserId) continue;
    const modelId = acc.model_id?.trim();
    if (!modelId) continue;
    if (!modelMap.has(modelId)) {
      modelMap.set(modelId, acc.model_name?.trim() || "Creator");
    }
  }

  const modelIds = [...modelMap.keys()];
  const configs = await listModelStoryLinkConfigs(modelIds);
  const configByModel = new Map(configs.map((c) => [c.model_id, c]));
  const todayYmd = getStoryCtaTodayYmd();

  const models: StoryCtaScheduleModel[] = modelIds
    .sort((a, b) => (modelMap.get(a) ?? "").localeCompare(modelMap.get(b) ?? ""))
    .map((modelId) => {
      const cfg = configByModel.get(modelId);
      const links = {
        link_a_url: cfg?.link_a_url ?? null,
        link_b_url: cfg?.link_b_url ?? null,
      };
      return {
        model_id: modelId,
        model_name: modelMap.get(modelId) ?? "Creator",
        link_a_url: links.link_a_url,
        link_b_url: links.link_b_url,
        schedule: buildStoryCtaScheduleRows(links, todayYmd),
      };
    });

  return NextResponse.json({ models, todayYmd });
}
