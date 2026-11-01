/**
 * Smoke: Daily Review flag message templates + informed scope/tamper.
 * Run: npx tsx scripts/_smoke-daily-review-flag-messages.ts
 */
import "./_polyfill-websocket";
import { config } from "dotenv";
config({ path: ".env.vercel.local" });
config({ path: ".env.local" });
process.env.DATA_BACKEND = "supabase";

async function main() {
  const {
    buildFlagMessage,
    buildFlagMessageParts,
    collectFlaggedItemsForVa,
    FLAG_MESSAGE_SOFT_LIMIT,
    firstNameFromFullName,
  } = await import("../lib/daily-review-flag-message");
  const {
    parseDailyReviewFilters,
    filterDailyReviewVas,
    scopeFromVas,
  } = await import("../lib/daily-review-filters");
  const { getTodayYmdAthens, addDaysAthensYmd } = await import("../lib/airtable-datetime");
  const { getDailyReviewChecklistForDate } = await import("../services/daily-review-checklist");

  const items = [
    {
      title: "Post Reel",
      note: "Missing screenshot\nline2 🔥",
      model_name: "Model A",
      phase_title: "Phase 1",
      platform: "Instagram",
    },
    {
      title: "Story poll",
      note: null,
      model_name: "Model A",
      phase_title: "Phase 1",
      platform: "Instagram",
    },
    {
      title: "TikTok draft",
      note: "Wrong caption",
      model_name: "Model B",
      phase_title: "Phase 2",
      platform: "TikTok",
    },
  ];

  const el = buildFlagMessage({
    language: "el",
    recipientFullName: "Μαρία Παπαδοπούλου",
    senderFullName: "Nikos Manager",
    reviewDate: "2026-11-01",
    items,
  });
  const en = buildFlagMessage({
    language: "en",
    recipientFullName: "Maria Papadopoulou",
    senderFullName: "Nikos Manager",
    reviewDate: "2026-11-01",
    items,
  });

  const assertions: Record<string, boolean> = {};
  assertions.el_greeting = el.startsWith("Γεια σου Μαρία,");
  assertions.el_count = el.includes("βρέθηκαν 3 σημεία");
  assertions.el_closing = el.includes("Ευχαριστώ, Nikos");
  assertions.el_note_preserved = el.includes("Missing screenshot\nline2 🔥");
  assertions.el_no_note_clean = el.includes("- Story poll\n") || el.includes("- Story poll\n\n") || /^- Story poll$/m.test(el);
  assertions.el_no_colon_empty = !el.includes("Story poll:");
  assertions.en_greeting = en.startsWith("Hi Maria,");
  assertions.en_count = en.includes("3 items need fixing");
  assertions.en_closing = en.includes("Thanks, Nikos");
  assertions.en_models = en.includes("Model A") && en.includes("Model B");
  assertions.first_name = firstNameFromFullName("Ada Lovelace") === "Ada";
  assertions.no_markdown = !el.includes("**") && !el.includes("<p>") && !en.includes("```");

  // Long split
  const longItems = Array.from({ length: 80 }, (_, i) => ({
    title: `Checklist item number ${i + 1} with a reasonably long title for padding`,
    note: `Note for item ${i + 1} — please fix the missing deliverable and re-upload evidence.`,
    model_name: i % 2 === 0 ? "Model Alpha" : "Model Beta",
    phase_title: `Phase ${(i % 4) + 1}`,
    platform: i % 2 === 0 ? "Instagram" : "TikTok",
  }));
  const parts = buildFlagMessageParts({
    language: "en",
    recipientFullName: "Alex Tester",
    senderFullName: "Sam Lead",
    reviewDate: "2026-11-01",
    items: longItems,
  });
  assertions.splits = parts.length >= 2;
  assertions.part_headers = parts.every((p) => p.text.startsWith(`Part ${p.index}/${p.total}`));
  assertions.parts_under_softish = parts.every((p) => p.text.length < FLAG_MESSAGE_SOFT_LIMIT + 800);

  // collectFlaggedItemsForVa
  const fakeVa = {
    tasks: [
      {
        items: [
          {
            title: "A",
            model_name: "M1",
            phase_title: "P1",
            phase_number: 1,
            platform: "Instagram",
            verification: { verified_status: "flagged_not_done" as const, note: "n1" },
          },
          {
            title: "B",
            model_name: "M1",
            phase_title: "P1",
            phase_number: 1,
            platform: null,
            verification: { verified_status: "verified" as const, note: null },
          },
          {
            title: "C",
            model_name: "M2",
            phase_title: "P2",
            phase_number: 2,
            platform: "TikTok",
            verifications: [{ verified_status: "flagged_not_done" as const, note: null }],
          },
        ],
      },
    ],
  };
  const collected = collectFlaggedItemsForVa(fakeVa);
  assertions.collect_two = collected.length === 2;
  assertions.collect_notes = collected[0]?.note === "n1" && collected[1]?.note == null;

  // Live scope + informed filter (best-effort against real data)
  const today = getTodayYmdAthens();
  let date = today;
  let base = await getDailyReviewChecklistForDate({ date });
  for (let i = 0; i < 14 && base.summary.total_items === 0; i++) {
    date = addDaysAthensYmd(today, -i);
    base = await getDailyReviewChecklistForDate({ date });
  }

  const tamperFilters = parseDailyReviewFilters(
    new URLSearchParams("people=evil-not-in-scope-zzzz&informed=not_informed"),
  );
  const scope = scopeFromVas(base.vas);
  const tampered = filterDailyReviewVas(base.vas, tamperFilters, scope);
  assertions.tamper_informed_empty = tampered.length === 0;

  const notInformedFilters = parseDailyReviewFilters(
    new URLSearchParams("preset=not_informed"),
  );
  const notInformed = filterDailyReviewVas(base.vas, notInformedFilters, scope);
  assertions.not_informed_only_flagged = notInformed.every((v) => v.stats.flagged > 0 && !v.informed);

  // Informed map shape present
  assertions.informed_field_present = base.vas.every((v) => "informed" in v);

  console.log(
    JSON.stringify(
      {
        date,
        el_sample: el.slice(0, 220),
        en_sample: en.slice(0, 220),
        parts: parts.length,
        part_lens: parts.map((p) => p.text.length),
        collected,
        not_informed_count: notInformed.length,
        assertions,
        pass: Object.values(assertions).every(Boolean),
      },
      null,
      2,
    ),
  );

  if (!Object.values(assertions).every(Boolean)) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
