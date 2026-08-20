import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission, requireAdminRoute } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getApplicationFormsOverview,
  listApplicationForms,
} from "@/services/application-forms";
import { emptyFunnel, type ApplicationFormsOverview } from "@/lib/application-forms-types";
import { AdminApplicationFormsClient } from "@/components/admin-application-forms-client";

const EMPTY_OVERVIEW: ApplicationFormsOverview = {
  total_candidates: 0,
  awaiting_review: 0,
  hired_this_month: 0,
  hired_this_quarter: 0,
  avg_cognitive_percentile: null,
  avg_eq_score: null,
  most_active_form: null,
  volume_by_day: [],
  recent_activity: [],
  published_count: 0,
  draft_count: 0,
  closed_count: 0,
};

export default async function AdminApplicationFormsPage() {
  const session = await requireAdminRoute(
    await getSessionFromCookies(),
    PERMISSIONS.APPLICATIONS_VIEW,
  );
  const [forms, overview, canManage] = await Promise.all([
    listApplicationForms().catch(() => []),
    getApplicationFormsOverview().catch(() => EMPTY_OVERVIEW),
    hasPermission(session, PERMISSIONS.APPLICATIONS_MANAGE),
  ]);

  const safeForms = forms.map((f) => ({
    ...f,
    funnel: f.funnel ?? emptyFunnel(),
    responses_last_7d: f.responses_last_7d ?? 0,
    responses_prev_7d: f.responses_prev_7d ?? 0,
  }));

  return (
    <AdminApplicationFormsClient
      initialForms={safeForms}
      initialOverview={overview}
      canManage={canManage}
    />
  );
}
