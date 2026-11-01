import "./_polyfill-websocket";
import { config } from "dotenv";
config({ path: ".env.vercel.local" });
config({ path: ".env.local" });
process.env.DATA_BACKEND = "supabase";

async function main() {
  const { getTodayYmdAthens, addDaysAthensYmd } = await import("../lib/airtable-datetime");
  const {
    emptyDailyReviewFilters,
    parseDailyReviewFilters,
  } = await import("../lib/daily-review-filters");
  const {
    getDailyReviewChecklistForDate,
    getAdminDailyReviewChecklistForDate,
  } = await import("../services/daily-review-checklist");

  const today = getTodayYmdAthens();
  let date = today;
  let base = await getDailyReviewChecklistForDate({ date });
  for (let i = 0; i < 14 && base.summary.total_items === 0; i++) {
    date = addDaysAthensYmd(today, -i);
    base = await getDailyReviewChecklistForDate({ date });
  }

  const t0 = performance.now();
  base = await getDailyReviewChecklistForDate({ date });
  const baseMs = Math.round(performance.now() - t0);

  const person = base.facets.people[0];
  const role = base.facets.roles[0];
  const model = base.facets.models[0];

  const cases: Array<{ name: string; qs: string }> = [
    { name: "role", qs: role ? `roles=${encodeURIComponent(role.value)}` : "" },
    { name: "person", qs: person ? `people=${encodeURIComponent(person.value)}` : "" },
    { name: "model", qs: model ? `models=${encodeURIComponent(model.value)}` : "" },
    { name: "review_pending", qs: "review_status=pending" },
    { name: "review_flagged", qs: "review_status=flagged" },
    { name: "task_incomplete", qs: "task_state=in_progress,not_started" },
    { name: "evidence_missing", qs: "evidence=missing" },
    { name: "preset_needs_review", qs: "preset=needs_review" },
    { name: "search", qs: "q=post" },
    { name: "sort_flagged", qs: "sort=flagged" },
    {
      name: "combined",
      qs: [
        role ? `roles=${encodeURIComponent(role.value)}` : "",
        "review_status=pending",
        "sort=completion",
      ]
        .filter(Boolean)
        .join("&"),
    },
    // Scope tampering: fake person id must not expand / leak others
    { name: "tamper_person", qs: "people=not-a-real-person-id-zzzz" },
    {
      name: "tamper_mixed",
      qs: person
        ? `people=${encodeURIComponent(person.value)},evil-injected-id`
        : "people=evil-injected-id",
    },
  ];

  const results: Record<string, unknown>[] = [];
  for (const c of cases) {
    if (!c.qs && c.name !== "tamper_person") {
      results.push({ name: c.name, skipped: true });
      continue;
    }
    const filters = parseDailyReviewFilters(new URLSearchParams(c.qs));
    const t1 = performance.now();
    const filtered = await getDailyReviewChecklistForDate({ date, filters });
    const ms = Math.round(performance.now() - t1);
    const ids = new Set(filtered.vas.map((v) => v.va_id));
    results.push({
      name: c.name,
      ms,
      items: filtered.summary.total_items,
      vas: filtered.vas.length,
      verified: filtered.summary.verified,
      flagged: filtered.summary.flagged,
      pending: filtered.summary.unverified,
      overdue: filtered.summary.overdue,
      person_ids: [...ids],
      facets_people: filtered.facets.people.length,
      facets_roles: filtered.facets.roles.length,
    });
  }

  const tamper = results.find((r) => r.name === "tamper_person") as {
    items?: number;
    vas?: number;
  };
  const tamperMixed = results.find((r) => r.name === "tamper_mixed") as {
    person_ids?: string[];
    items?: number;
  };
  const personOnly = results.find((r) => r.name === "person") as {
    person_ids?: string[];
    items?: number;
  };

  const tAdmin0 = performance.now();
  const admin = await getAdminDailyReviewChecklistForDate({
    date,
    filters: person
      ? parseDailyReviewFilters(new URLSearchParams(`people=${person.value}`))
      : emptyDailyReviewFilters(),
  });
  const adminMs = Math.round(performance.now() - tAdmin0);

  const okTamper = (tamper?.items ?? -1) === 0 && (tamper?.vas ?? -1) === 0;
  const okMixed =
    !person ||
    ((tamperMixed?.person_ids?.length ?? 0) <= 1 &&
      (tamperMixed?.person_ids?.[0] === person.value || (tamperMixed?.items ?? 0) === 0));
  const deletedGone = base.vas.every((va) =>
    va.tasks.every((t) => !t.is_virtual && Boolean(t.task_id)),
  );

  console.log(
    JSON.stringify(
      {
        date,
        baseMs,
        baseItems: base.summary.total_items,
        baseVas: base.vas.length,
        facets: {
          roles: base.facets.roles.map((r) => r.label),
          people: base.facets.people.map((p) => p.label),
          models: base.facets.models.map((m) => m.label).slice(0, 8),
          platforms: base.facets.platforms.map((p) => p.value),
          item_types: base.facets.item_types.map((t) => t.value),
        },
        results,
        adminMs,
        adminItems: admin.team_summary.total_items,
        adminVas: admin.shared_vas.length,
        assertions: {
          tamper_empty: okTamper,
          tamper_mixed_scoped: okMixed,
          facets_unfiltered_on_tamper:
            (results.find((r) => r.name === "tamper_person") as { facets_people?: number })
              ?.facets_people === base.facets.people.length,
          deleted_tasks_absent: deletedGone,
          person_narrows:
            !person || (personOnly?.items ?? 0) <= base.summary.total_items,
        },
      },
      null,
      2,
    ),
  );

  if (!okTamper || !okMixed || !deletedGone) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
