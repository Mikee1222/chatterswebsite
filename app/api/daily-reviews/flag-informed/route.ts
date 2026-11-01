import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  spotCheckManagerId,
  spotCheckManagerName,
  toReviewDateKey,
  todayReviewIso,
} from "@/lib/marketing-reviews-helpers";
import { getDailyReviewChecklistForDate } from "@/services/daily-review-checklist";
import {
  clearFlagInformed,
  listFlagInformedForDate,
  upsertFlagInformed,
} from "@/services/daily-review-flag-informed";
import { getDailyReviewByDate } from "@/services/marketing-reviews";

async function canAccessDailyReview(session: Parameters<typeof hasPermission>[0]) {
  const manage = await hasPermission(session, PERMISSIONS.DAILY_REVIEW_MANAGE);
  if (manage) return { manage: true as const, submit: true as const };
  const submit = await hasPermission(session, PERMISSIONS.DAILY_REVIEW_SUBMIT);
  return { manage: false as const, submit };
}

/**
 * Supervisor scope: person must appear in the day's checklist AND have ≥1 flag
 * on this supervisor's review. Admins (manage) may mark anyone on the day who
 * has flags in the shared tree — still cannot invent va_ids outside the day.
 */
async function assertVaInScope(params: {
  date: string;
  vaId: string;
  manage: boolean;
  session: { fullName?: string | null; email?: string | null; airtableUserId?: string | null; id: string };
}): Promise<{ ok: true; va_name: string } | { ok: false; status: number; error: string }> {
  const checklist = await getDailyReviewChecklistForDate({
    date: params.date,
    reviewId: null,
  });
  const va = checklist.vas.find((v) => v.va_id === params.vaId);
  if (!va) {
    return { ok: false, status: 403, error: "Person not in scope for this date" };
  }

  if (params.manage) {
    // Admin path: require at least one flag somewhere that day (loaded via overlay below).
    // We re-check with the caller's review or accept flagged on shared by reloading with reviews.
    return { ok: true, va_name: va.va_name };
  }

  const review = await getDailyReviewByDate(
    params.date,
    spotCheckManagerName(params.session),
    spotCheckManagerId(params.session),
  );
  if (!review) {
    return { ok: false, status: 403, error: "No review for this date — flag items first" };
  }
  const scoped = await getDailyReviewChecklistForDate({
    date: params.date,
    reviewId: review.id,
  });
  const scopedVa = scoped.vas.find((v) => v.va_id === params.vaId);
  if (!scopedVa || scopedVa.stats.flagged < 1) {
    return { ok: false, status: 403, error: "No flagged items for this person in your review" };
  }
  return { ok: true, va_name: scopedVa.va_name };
}

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = await canAccessDailyReview(session);
  if (!access.submit && !access.manage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const date = toReviewDateKey(url.searchParams.get("date")) || todayReviewIso();
  const rows = await listFlagInformedForDate(date);

  if (access.manage) {
    return NextResponse.json({ date, informed: rows });
  }

  // Supervisor: only return informed rows for people in their day's scope with their flags.
  const review = await getDailyReviewByDate(
    date,
    spotCheckManagerName(session),
    spotCheckManagerId(session),
  );
  if (!review) {
    return NextResponse.json({ date, informed: [] });
  }
  const scoped = await getDailyReviewChecklistForDate({ date, reviewId: review.id });
  const allowed = new Set(
    scoped.vas.filter((v) => v.stats.flagged > 0).map((v) => v.va_id),
  );
  return NextResponse.json({
    date,
    informed: rows.filter((r) => allowed.has(r.va_id)),
  });
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = await canAccessDailyReview(session);
  if (!access.submit && !access.manage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    date?: string;
    va_id?: string;
    va_name?: string;
  };
  const date = toReviewDateKey(body.date) || todayReviewIso();
  const vaId = String(body.va_id ?? "").trim();
  if (!vaId) {
    return NextResponse.json({ error: "va_id is required" }, { status: 400 });
  }

  const scope = await assertVaInScope({
    date,
    vaId,
    manage: access.manage,
    session,
  });
  if (!scope.ok) {
    return NextResponse.json({ error: scope.error }, { status: scope.status });
  }

  // Admin: also require the person has ≥1 flag that day across supervisors.
  if (access.manage) {
    const { getAdminDailyReviewChecklistForDate } = await import(
      "@/services/daily-review-checklist"
    );
    const admin = await getAdminDailyReviewChecklistForDate({ date });
    const shared = admin.shared_vas.find((v) => v.va_id === vaId);
    if (!shared || shared.stats.flagged < 1) {
      return NextResponse.json(
        { error: "No flagged items for this person on this date" },
        { status: 403 },
      );
    }
  }

  const row = await upsertFlagInformed({
    review_date: date,
    va_id: vaId,
    va_name: body.va_name?.trim() || scope.va_name,
    informed_by: spotCheckManagerId(session),
    informed_by_name: spotCheckManagerName(session),
  });

  return NextResponse.json({ informed: row });
}

export async function DELETE(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = await canAccessDailyReview(session);
  if (!access.submit && !access.manage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    date?: string;
    va_id?: string;
  };
  const date = toReviewDateKey(body.date) || todayReviewIso();
  const vaId = String(body.va_id ?? "").trim();
  if (!vaId) {
    return NextResponse.json({ error: "va_id is required" }, { status: 400 });
  }

  const scope = await assertVaInScope({
    date,
    vaId,
    manage: access.manage,
    session,
  });
  if (!scope.ok) {
    return NextResponse.json({ error: scope.error }, { status: scope.status });
  }

  await clearFlagInformed(date, vaId);
  return NextResponse.json({ ok: true });
}
