/** Candidate pipeline UI chrome — English / Greek. */

export type PipelineLanguage = "en" | "el";

export function isPipelineLanguage(v: unknown): v is PipelineLanguage {
  return v === "en" || v === "el";
}

export const PIPELINE_UI = {
  en: {
    chooseLanguageTitle: "Choose your language / Επίλεξε γλώσσα",
    chooseLanguageHint: "You can switch language later without losing your answers.",
    english: "English",
    greek: "Ελληνικά",
    language: "Language",
    begin: "Begin",
    starting: "Starting…",
    thankYou: "Thank you",
    applicationReceived: "Application received",
    applicationReceivedBody:
      "We've received your submission. Our team will review it and get in touch if there's a fit.",
    applicationsClosed: "Applications closed",
    applicationsClosedBody:
      "This form is no longer accepting submissions. Thank you for your interest.",
    progress: "Progress",
    submit: "Submit application",
    submitting: "Submitting…",
    required: "This field is required",
    selectOne: "Please select at least one option",
    back: "Back",
    next: "Next",
    finishSection: "Finish section",
    yourAnswer: "Your answer",
    select: "Select…",
    yes: "Yes",
    no: "No",
    applicationQuestions: "Application questions",
    continueInEnglish: "Continue in English",
    continueInGreek: "Συνέχεια στα Ελληνικά",
    sectionBasicInfo: "Basic info",
    sectionAvailability: "Availability",
    sectionAboutYou: "About you",
    typingTitle: "Typing speed test",
    cognitiveTitle: "Cognitive ability",
    eqTitle: "Emotional intelligence — situational judgment",
    screeningIntroHeadline: "A short practical screening",
    screeningIntroBody:
      "This screening helps us compare how candidates approach reasoning and workplace situations. It is a relative practical tool among applicants — not a clinically validated IQ or EQ test, and not a diagnosis of ability or personality.",
    cognitiveBody:
      "Pattern recognition, logical reasoning, numerical, and verbal questions. You'll have a limited time; unanswered items are scored as incorrect when time ends.",
    eqBody:
      "Short workplace scenarios. Choose the response that best reflects thoughtful interpersonal judgment. There is no single “perfect” answer; options are graded for practical EQ skills.",
    typingIntro:
      "Type the passage as accurately and quickly as you can. Paste is disabled. Timing starts on your first keystroke.",
    typingStart: "Start typing test",
    typingFinished: "Finish test",
    typingResults: "Your results",
    typingWpm: "WPM",
    typingAccuracy: "Accuracy",
    typingTime: "Time",
    typingContinue: "Continue",
    typingPassageLang: "Passage language",
    typingReady: "Ready when you are",
    fieldRequiredMark: "*",
  },
  el: {
    chooseLanguageTitle: "Επίλεξε γλώσσα / Choose your language",
    chooseLanguageHint: "Μπορείς να αλλάξεις γλώσσα αργότερα χωρίς να χάσεις τις απαντήσεις σου.",
    english: "English",
    greek: "Ελληνικά",
    language: "Γλώσσα",
    begin: "Ξεκίνα",
    starting: "Έναρξη…",
    thankYou: "Ευχαριστούμε",
    applicationReceived: "Η αίτηση καταχωρήθηκε",
    applicationReceivedBody:
      "Λάβαμε την αίτησή σου. Η ομάδα μας θα την εξετάσει και θα επικοινωνήσει αν υπάρχει ταιριαστότητα.",
    applicationsClosed: "Οι αιτήσεις έκλεισαν",
    applicationsClosedBody:
      "Αυτή η φόρμα δεν δέχεται πλέον υποβολές. Ευχαριστούμε για το ενδιαφέρον σου.",
    progress: "Πρόοδος",
    submit: "Υποβολή αίτησης",
    submitting: "Υποβολή…",
    required: "Αυτό το πεδίο είναι υποχρεωτικό",
    selectOne: "Επίλεξε τουλάχιστον μία επιλογή",
    back: "Πίσω",
    next: "Επόμενο",
    finishSection: "Ολοκλήρωση ενότητας",
    yourAnswer: "Η απάντησή σου",
    select: "Επίλεξε…",
    yes: "Ναι",
    no: "Όχι",
    applicationQuestions: "Ερωτήσεις αίτησης",
    continueInEnglish: "Continue in English",
    continueInGreek: "Συνέχεια στα Ελληνικά",
    sectionBasicInfo: "Βασικά στοιχεία",
    sectionAvailability: "Διαθεσιμότητα",
    sectionAboutYou: "Σχετικά με εσένα",
    typingTitle: "Τεστ ταχύτητας πληκτρολόγησης",
    cognitiveTitle: "Γνωστική ικανότητα",
    eqTitle: "Συναισθηματική νοημοσύνη — καταστάσεις κρίσης",
    screeningIntroHeadline: "Ένα σύντομο πρακτικό screening",
    screeningIntroBody:
      "Αυτό το screening μας βοηθά να συγκρίνουμε πώς προσεγγίζουν οι υποψήφιοι τη λογική σκέψη και καταστάσεις στη δουλειά. Είναι πρακτικό εργαλείο σύγκρισης μεταξύ υποψηφίων — όχι κλινικά επικυρωμένο τεστ IQ ή EQ, και όχι διάγνωση ικανότητας ή προσωπικότητας.",
    cognitiveBody:
      "Ερωτήσεις αναγνώρισης μοτίβων, λογικής, αριθμητικής και λεκτικής κατανόησης. Έχεις περιορισμένο χρόνο· οι αναπάντητες βαθμολογούνται ως λάθος όταν τελειώσει ο χρόνος.",
    eqBody:
      "Σύντομα σενάρια χώρου εργασίας. Επίλεξε την απάντηση που δείχνει προσεκτική διαπροσωπική κρίση. Δεν υπάρχει μία «τέλεια» απάντηση· οι επιλογές βαθμολογούνται για πρακτικές δεξιότητες EQ.",
    typingIntro:
      "Πληκτρολόγησε το κείμενο όσο πιο σωστά και γρήγορα μπορείς. Η επικόλληση είναι απενεργοποιημένη. Ο χρόνος ξεκινά στο πρώτο πλήκτρο.",
    typingStart: "Έναρξη τεστ πληκτρολόγησης",
    typingFinished: "Ολοκλήρωση τεστ",
    typingResults: "Τα αποτελέσματά σου",
    typingWpm: "ΛΠΛ",
    typingAccuracy: "Ακρίβεια",
    typingTime: "Χρόνος",
    typingContinue: "Συνέχεια",
    typingPassageLang: "Γλώσσα κειμένου",
    typingReady: "Όποτε είσαι έτοιμος/η",
    fieldRequiredMark: "*",
  },
} as const;

export type PipelineUiCopy = (typeof PIPELINE_UI)[PipelineLanguage];

export function pipelineUi(lang: PipelineLanguage): PipelineUiCopy {
  return PIPELINE_UI[lang] ?? PIPELINE_UI.en;
}

/** "Question 4 of 17" / "Ερώτηση 4 από 17" */
export function questionProgressLabel(
  lang: PipelineLanguage,
  current: number,
  total: number,
): string {
  if (lang === "el") return `Ερώτηση ${current} από ${total}`;
  return `Question ${current} of ${total}`;
}

export function pickLocalized(
  lang: PipelineLanguage,
  en: string,
  el: string | null | undefined,
): string {
  if (lang === "el" && (el ?? "").trim()) return el!.trim();
  return en;
}

export function detectDeviceType(userAgent?: string | null): "desktop" | "mobile" | "tablet" | "unknown" {
  const ua = (userAgent ?? "").toLowerCase();
  if (!ua) return "unknown";
  if (/ipad|tablet|kindle|playbook|silk|(android(?!.*mobile))/.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android.*mobile|windows phone/.test(ua)) return "mobile";
  return "desktop";
}
