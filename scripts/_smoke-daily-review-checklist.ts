import "./_polyfill-websocket";
import { config } from "dotenv";
config({ path: ".env.local" });
process.env.DATA_BACKEND = "supabase";

async function main() {
  const { getTodayYmdAthens, addDaysAthensYmd } = await import("../lib/airtable-datetime");
  const { getDailyReviewChecklistForDate, getAdminDailyReviewChecklistForDate } = await import(
    "../services/daily-review-checklist"
  );
  const { createDailyReview, deleteDailyReview } = await import("../services/marketing-reviews");
  const {
    upsertItemVerification,
    listVerificationsForReview,
    clearItemVerification,
  } = await import("../services/daily-review-verifications");

  const today = getTodayYmdAthens();
  let date = today;
  let checklist = await getDailyReviewChecklistForDate({ date });
  for (let i = 0; i < 14 && checklist.summary.total_items === 0; i++) {
    date = addDaysAthensYmd(today, -i);
    checklist = await getDailyReviewChecklistForDate({ date });
  }
  console.log(
    JSON.stringify(
      {
        date,
        summary: checklist.summary,
        vas: checklist.vas.map((v) => ({
          name: v.va_name,
          items: v.stats.total_items,
          tasks: v.tasks.length,
        })),
      },
      null,
      2,
    ),
  );

  if (checklist.summary.total_items === 0) {
    console.log("NO_ITEMS");
    return;
  }

  const firstVa = checklist.vas[0]!;
  const firstItem = firstVa.tasks[0]!.items[0]!;
  const review = await createDailyReview({
    manager_name: "QA Smoke Supervisor",
    manager_id: "smoke-daily-review-supervisor",
    review_date: date,
  });
  const v = await upsertItemVerification({
    review_id: review.id,
    task_phase_item_id: firstItem.item_id,
    verified_status: "flagged_not_done",
    verified_by: "smoke-daily-review-supervisor",
    verified_by_name: "QA Smoke Supervisor",
    va_id: firstVa.va_id,
    va_name: firstVa.va_name,
    task_id: firstItem.task_id,
    phase_id: firstItem.phase_id,
    item_title: firstItem.title,
  });
  const listed = await listVerificationsForReview(review.id);
  const admin = await getAdminDailyReviewChecklistForDate({ date });
  await clearItemVerification(review.id, firstItem.item_id);
  await deleteDailyReview(review.id);
  console.log(
    JSON.stringify(
      {
        review_id: review.id,
        verification_id: v.id,
        status: v.verified_status,
        listed_count: listed.length,
        admin_supervisors: admin.team_summary.supervisors,
        admin_items: admin.team_summary.total_items,
        admin_flagged_seen: admin.team_summary.flagged,
        cleared: true,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
