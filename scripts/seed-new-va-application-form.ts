/**
 * Seed / upsert the published "New VA Application" form with bilingual content
 * and the same default pipeline as Chatters (cognitive → eq → typing → application_form).
 *
 * Usage: npx tsx scripts/seed-new-va-application-form.ts
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

const SLUG = "new-va-application";
const TITLE = "New VA Application";

const DESCRIPTION_EN = `💬 Please fill out this form carefully. We're looking for organized, reliable, and detail-oriented people to help manage social media accounts, marketing tasks, and daily operations for our OnlyFans models. Accuracy and consistency matter. If you're selected, you'll be contacted via Telegram or email for the next step.

🇬🇷 For Greek Applicants — If you are Greek, you can answer the questions in Greek or English — whichever you feel more comfortable with. Grammar or spelling don't matter as much as clarity and honesty.`;

const DESCRIPTION_EL = `💬 Συμπλήρωσε τη φόρμα με προσοχή. Ψάχνουμε για οργανωμένα, αξιόπιστα άτομα με προσοχή στη λεπτομέρεια που θα βοηθήσουν στη διαχείριση λογαριασμών social media, marketing εργασιών και καθημερινών λειτουργιών για τα OnlyFans μοντέλα μας. Η ακρίβεια και η συνέπεια μετράνε. Αν επιλεγείς, θα επικοινωνήσουμε μέσω Telegram ή email για το επόμενο βήμα.

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
    question_text: "Telegram username (e.g. @username)",
    question_text_el: "Telegram username (π.χ. @username)",
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
    question_text: "Phone Number",
    question_text_el: "Τηλέφωνο",
    question_type: "short_text",
    is_required: true,
  },
  {
    question_text: "Email",
    question_text_el: "Email",
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
    options: ["Morning", "Afternoon", "Evening", "Late Night", "Flexible"],
    options_el: ["Πρωί", "Απόγευμα", "Βράδυ", "Αργά το βράδυ", "Ευέλικτα"],
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
    question_text:
      "Do you have experience managing social media accounts (Instagram, TikTok, Facebook)? If yes, please describe",
    question_text_el:
      "Έχεις εμπειρία στη διαχείριση λογαριασμών social media (Instagram, TikTok, Facebook); Αν ναι, περιέγραψε",
    question_type: "long_text",
    is_required: true,
  },
  {
    question_text: "Have you worked in an OnlyFans agency or VA role before? If yes, for how long?",
    question_text_el:
      "Έχεις δουλέψει σε OnlyFans agency ή ως VA στο παρελθόν; Αν ναι, για πόσο καιρό;",
    question_type: "long_text",
    is_required: true,
  },
  {
    question_text: "How comfortable are you following detailed checklists and instructions?",
    question_text_el: "Πόσο άνετα αισθάνεσαι να ακολουθείς λεπτομερή checklists και οδηγίες;",
    question_type: "dropdown",
    options: [
      "Very comfortable",
      "Comfortable",
      "Somewhat comfortable",
      "Not very comfortable",
    ],
    options_el: [
      "Πολύ άνετα",
      "Άνετα",
      "Σχετικά άνετα",
      "Όχι πολύ άνετα",
    ],
    is_required: true,
  },
  {
    question_text:
      "Describe a time you had to manage several repetitive tasks at once — how did you stay organized?",
    question_text_el:
      "Περιέγραψε μια φορά που έπρεπε να διαχειριστείς πολλές επαναλαμβανόμενες εργασίες ταυτόχρονα — πώς παρέμεινες οργανωμένος/η;",
    question_type: "long_text",
    is_required: true,
  },
  {
    question_text: "Why do you want to work as a VA with our team?",
    question_text_el: "Γιατί θέλεις να δουλέψεις ως VA με την ομάδα μας;",
    question_type: "long_text",
    is_required: true,
  },
  {
    question_text: "Give an example that shows you pay close attention to detail",
    question_text_el: "Δώσε ένα παράδειγμα που δείχνει ότι δίνεις μεγάλη προσοχή στη λεπτομέρεια",
    question_type: "long_text",
    is_required: true,
  },
  {
    question_text:
      "Do you have a stable internet connection and a computer or smartphone you can use for this work?",
    question_text_el:
      "Έχεις σταθερό internet και υπολογιστή ή smartphone που μπορείς να χρησιμοποιήσεις για αυτή τη δουλειά;",
    question_type: "yes_no",
    is_required: true,
  },
];

async function main() {
  if (QUESTIONS.length !== 18) {
    throw new Error(`Expected 18 questions, got ${QUESTIONS.length}`);
  }

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
