/**
 * Seed / upsert the published "New Chatters Apply Form" with exact bilingual content
 * and full pipeline (cognitive → eq → typing → application_form).
 *
 * Usage: npx tsx scripts/seed-new-chatters-apply-form.ts
 */

import "./_polyfill-websocket";
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import {
  createApplicationForm,
  createQuestion,
  getFormBySlugAnyStatus,
  getApplicationFormById,
  updateApplicationForm,
  deleteQuestion,
} from "@/services/application-forms";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import type { ApplicationQuestionType, PipelineStepConfig } from "@/lib/application-forms-types";

const SLUG = "new-chatters-apply-form";
const TITLE = "New Chatters Apply Form";

const DESCRIPTION_EN = `💬 Please fill out this form carefully. We're looking for motivated, disciplined, and creative people who can handle chats, upsells, and fan relationships for OnlyFans models. Accuracy, speed, and personality matter. If you're selected, you'll be contacted via Telegram or email for the next step.

🇬🇷 For Greek Applicants — If you are Greek, you can answer the questions in Greek or English — whichever you feel more comfortable with. Grammar or spelling don't matter as much as clarity and honesty.`;

const DESCRIPTION_EL = `💬 Συμπλήρωσε τη φόρμα με προσοχή. Ψάχνουμε για άτομα με κίνητρο, πειθαρχία και δημιουργικότητα που μπορούν να χειριστούν chats, upsells και σχέσεις με fans για OnlyFans μοντέλα. Η ακρίβεια, η ταχύτητα και η προσωπικότητα μετράνε. Αν επιλεγείς, θα επικοινωνήσουμε μέσω Telegram ή email για το επόμενο βήμα.

🇬🇷 Για Έλληνες υποψηφίους — Αν είσαι Έλληνας/Ελληνίδα, μπορείς να απαντήσεις στα ελληνικά ή στα αγγλικά — ό,τι σου είναι πιο άνετο. Η γραμματική ή η ορθογραφία δεν μετράνε τόσο όσο η σαφήνεια και η ειλικρίνεια.`;

const FOOTER_EN = "Do not submit passwords through this form.";
const FOOTER_EL = "Μην υποβάλλεις κωδικούς μέσω αυτής της φόρμας.";

const PIPELINE: PipelineStepConfig[] = [
  { step: "cognitive_screening", enabled: true, order: 0 },
  { step: "eq_screening", enabled: true, order: 1 },
  { step: "typing_speed_test", enabled: true, order: 2 },
  { step: "application_form", enabled: true, order: 3 },
];

type Q = {
  question_text: string;
  question_text_el: string;
  question_type: ApplicationQuestionType;
  options?: string[];
  options_el?: string[];
  is_required: boolean;
};

const QUESTIONS: Q[] = [
  {
    question_text: "Full Name",
    question_text_el: "Ονοματεπώνυμο",
    question_type: "short_text",
    is_required: true,
  },
  {
    question_text: "Discord username (e.g. @jahd)",
    question_text_el: "Discord username (π.χ. @jahd)",
    question_type: "short_text",
    is_required: true,
  },
  {
    question_text: "Country / City",
    question_text_el: "Χώρα / Πόλη",
    question_type: "short_text",
    is_required: true,
  },
  {
    question_text: "Date of birth",
    question_text_el: "Ημερομηνία γέννησης",
    question_type: "date",
    is_required: false,
  },
  {
    question_text: "Instagram",
    question_text_el: "Instagram",
    question_type: "short_text",
    is_required: false,
  },
  {
    question_text: "Phone Number",
    question_text_el: "Τηλέφωνο",
    question_type: "short_text",
    is_required: true,
  },
  {
    question_text: "English Knowledge",
    question_text_el: "Επίπεδο Αγγλικών",
    question_type: "dropdown",
    options: ["Beginner", "Intermediate", "Advanced", "Native"],
    options_el: ["Αρχάριος", "Μεσαίος", "Προχωρημένος", "Μητρική"],
    is_required: true,
  },
  {
    question_text: "You can work:",
    question_text_el: "Μπορείς να δουλέψεις:",
    question_type: "checkboxes",
    options: ["Morning", "Midday", "Afternoon", "Evening", "Late Night", "Flexible"],
    options_el: ["Πρωί", "Μεσημέρι", "Απόγευμα", "Βράδυ", "Αργά το βράδυ", "Ευέλικτα"],
    is_required: true,
  },
  {
    question_text: "How many hours you can work per day",
    question_text_el: "Πόσες ώρες μπορείς να δουλεύεις τη μέρα",
    question_type: "short_text",
    is_required: true,
  },
  {
    question_text: "You are able to work",
    question_text_el: "Μπορείς να δουλέψεις",
    question_type: "dropdown",
    options: ["Full-time", "Part-time"],
    options_el: ["Πλήρης απασχόληση", "Μερική απασχόληση"],
    is_required: true,
  },
  {
    question_text: "Do you have experience with OnlyFans or chatting? If yes for how long?",
    question_text_el: "Έχεις εμπειρία με OnlyFans ή chatting; Αν ναι, για πόσο καιρό;",
    question_type: "long_text",
    is_required: true,
  },
  {
    question_text: "What are your monthly income goals?",
    question_text_el: "Ποιοι είναι οι μηνιαίοι στόχοι εισοδήματός σου;",
    question_type: "short_text",
    is_required: true,
  },
  {
    question_text: "What do you think a fan is really looking for on OnlyFans?",
    question_text_el: "Τι πιστεύεις ότι ψάχνει πραγματικά ένας fan στο OnlyFans;",
    question_type: "long_text",
    is_required: true,
  },
  {
    question_text: "Why do you want to work as a chatter?",
    question_text_el: "Γιατί θέλεις να δουλέψεις ως chatter;",
    question_type: "long_text",
    is_required: true,
  },
  {
    question_text: "Do you have a stable internet connection and a computer?",
    question_text_el: "Έχεις σταθερό internet και υπολογιστή;",
    question_type: "yes_no",
    is_required: true,
  },
];

async function main() {
  const existing = await getFormBySlugAnyStatus(SLUG);
  let formId: string;

  if (existing) {
    console.log(`Updating existing form ${existing.id} (${existing.slug})`);
    const updated = await updateApplicationForm(existing.id, {
      title: TITLE,
      description: DESCRIPTION_EN,
      description_el: DESCRIPTION_EL,
      footer_text: FOOTER_EN,
      footer_text_el: FOOTER_EL,
      status: "published",
      pipeline_config: PIPELINE,
    });
    formId = updated.id;

    const full = await getApplicationFormById(formId);
    if (full) {
      for (const q of full.questions) {
        await deleteQuestion(q.id);
      }
    }
  } else {
    console.log("Creating new form…");
    const created = await createApplicationForm({
      title: TITLE,
      description: DESCRIPTION_EN,
      description_el: DESCRIPTION_EL,
      footer_text: FOOTER_EN,
      footer_text_el: FOOTER_EL,
      slug: SLUG,
      status: "published",
      pipeline_config: PIPELINE,
    });
    formId = created.id;
    await updateApplicationForm(formId, {
      status: "published",
      pipeline_config: PIPELINE,
      description_el: DESCRIPTION_EL,
      footer_text: FOOTER_EN,
      footer_text_el: FOOTER_EL,
    });
  }

  // Ensure slug exact
  const sb = getSupabaseServiceClient();
  await sb.from("application_forms").update({ slug: SLUG }).eq("id", formId);

  for (const q of QUESTIONS) {
    await createQuestion(formId, {
      question_text: q.question_text,
      question_text_el: q.question_text_el,
      question_type: q.question_type,
      options: q.options,
      options_el: q.options_el,
      is_required: q.is_required,
    });
  }

  const final = await getApplicationFormById(formId);
  console.log(
    JSON.stringify(
      {
        id: formId,
        slug: final?.slug,
        status: final?.status,
        question_count: final?.questions.length,
        pipeline_config: final?.pipeline_config,
        public_path: `/apply/${SLUG}`,
        sample_greek_label: final?.questions.find((x) => x.question_text === "Full Name")
          ?.question_text_el,
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
