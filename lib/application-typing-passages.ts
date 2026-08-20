/**
 * Typing speed test passages (~150–250 words) in English and Greek.
 * One random passage is chosen per attempt for the selected language.
 */

export type TypingPassage = {
  id: string;
  language: "en" | "el";
  text: string;
};

export const TYPING_PASSAGES: TypingPassage[] = [
  {
    id: "en_1",
    language: "en",
    text:
      "Working as a chatter means staying calm when fans ask many questions at once. You learn to read tone between the lines, answer clearly, and keep the conversation warm without rushing. Upsells work best when they feel natural: a tip idea after a genuine compliment, or a custom suggestion when the fan shares a preference. Accuracy matters because wrong prices or broken promises damage trust. Speed helps during busy hours, but clarity always comes first. Keep notes on what each fan likes so the next shift can continue the story. When something goes wrong, own it quickly and offer a simple fix. Good chatters balance personality with discipline, show up on time, and treat every message like it belongs to a real person who chose to spend time with the model.",
  },
  {
    id: "en_2",
    language: "en",
    text:
      "A strong fan relationship grows from consistency. Reply within a reasonable time, remember small details, and never invent stories that conflict with the model profile. If you are unsure about a boundary, pause and check before sending. Chatting is creative work: you invent light moments, keep flirting playful, and guide fans toward content that fits their mood. Still, the basics are operational. Track tips, follow pricing rules, and log anything that needs a manager. Late nights can feel long, so hydrate, stretch, and reset your focus between waves of messages. When a fan is upset, acknowledge the feeling first, then solve the issue. When a fan is quiet, a short thoughtful check-in often reopens the chat better than a hard sell.",
  },
  {
    id: "en_3",
    language: "en",
    text:
      "Discipline separates average chatters from reliable ones. Arrive ready with passwords, tools, and a clean workspace. Internet drops happen, so have a backup plan and tell the team early if you lose connection. During peak traffic, triage: whales and active spenders first, then warm leads, then lighter chats. Use templates as a starting point, never as a copy-paste wall. Rewrite them so they sound like the model and fit the fan. Upsells should feel like invitations, not pressure. If a fan says no, respect it and keep the vibe friendly. Over time you will notice patterns: who tips after voice notes, who prefers long talks, who buys PPV on weekends. Write those patterns down. That knowledge compounds and makes every future shift smoother for the whole team.",
  },
  {
    id: "el_1",
    language: "el",
    text:
      "Η δουλειά του chatter χρειάζεται ηρεμία όταν οι fans στέλνουν πολλά μηνύματα μαζί. Μαθαίνεις να διαβάζεις τον τόνο ανάμεσα στις γραμμές, να απαντάς καθαρά και να κρατάς τη συζήτηση ζεστή χωρίς να βιάζεσαι. Τα upsells δουλεύουν καλύτερα όταν φαίνονται φυσικά: μια ιδέα για tip μετά από ένα αληθινό κομπλιμέντο, ή μια πρόταση για custom όταν ο fan μοιράζεται μια προτίμηση. Η ακρίβεια μετράει γιατί λάθος τιμές ή υποσχέσεις που δεν κρατιούνται χαλάνε την εμπιστοσύνη. Η ταχύτητα βοηθάει στις ώρες αιχμής, αλλά η σαφήνεια έρχεται πάντα πρώτη. Κράτα σημειώσεις για το τι αρέσει σε κάθε fan ώστε η επόμενη βάρδια να συνεχίσει την ιστορία. Όταν κάτι πάει στραβά, ανάλαβε το γρήγορα και πρότεινε μια απλή λύση. Οι καλοί chatters συνδυάζουν προσωπικότητα με πειθαρχία, έρχονται στην ώρα τους και αντιμετωπίζουν κάθε μήνυμα σαν να ανήκει σε πραγματικό άνθρωπο.",
  },
  {
    id: "el_2",
    language: "el",
    text:
      "Μια δυνατή σχέση με τον fan χτίζεται με συνέπεια. Απάντα σε λογικό χρόνο, θυμήσου μικρές λεπτομέρειες και μην εφευρίσκεις ιστορίες που συγκρούονται με το προφίλ του μοντέλου. Αν έχεις αμφιβολία για ένα όριο, σταμάτα και τσέκαρε πριν στείλεις. Το chatting είναι δημιουργική δουλειά: φτιάχνεις ανάλαφρες στιγμές, κρατάς το φλερτ παιχνιδιάρικο και οδηγείς τους fans σε περιεχόμενο που ταιριάζει στη διάθεσή τους. Παράλληλα, τα βασικά είναι λειτουργικά. Παρακολούθησε tips, ακολούθησε τους κανόνες τιμολόγησης και κατέγραψε ό,τι χρειάζεται manager. Οι βραδινές βάρδιες μπορεί να φαίνονται μεγάλες, οπότε πιες νερό, κουνήσου λίγο και ξαναβρες συγκέντρωση ανάμεσα στα κύματα μηνυμάτων. Όταν ένας fan είναι εκνευρισμένος, αναγνώρισε πρώτα το συναίσθημα και μετά λύσε το θέμα. Όταν είναι ήσυχος, ένα σύντομο και προσεκτικό check-in συχνά ανοίγει ξανά τη συζήτηση καλύτερα από μια σκληρή πώληση.",
  },
  {
    id: "el_3",
    language: "el",
    text:
      "Η πειθαρχία χωρίζει τον μέσο chatter από τον αξιόπιστο. Έλα έτοιμος με κωδικούς, εργαλεία και καθαρό χώρο δουλειάς. Το ίντερνετ μπορεί να πέσει, γι αυτό να έχεις εναλλακτικό πλάνο και να ενημερώνεις νωρίς την ομάδα αν χαθεί η σύνδεση. Στην αιχμή, βάλε προτεραιότητες: πρώτα whales και ενεργοί spenders, μετά ζεστά leads και μετά πιο ελαφριά chats. Χρησιμοποίησε templates ως αφετηρία, ποτέ ως τυφλό copy-paste. Ξαναγράψε τα ώστε να ακούγονται σαν το μοντέλο και να ταιριάζουν στον fan. Τα upsells πρέπει να μοιάζουν με πρόσκληση, όχι με πίεση. Αν κάποιος πει όχι, σεβάσου το και κράτα φιλικό κλίμα. Με τον καιρό θα δεις μοτίβα: ποιος tipάρει μετά από voice notes, ποιος προτιμάει μεγάλες κουβέντες, ποιος αγοράζει PPV τα σαββατοκύριακα. Γράψε τα. Αυτή η γνώση μεγαλώνει και κάνει κάθε επόμενη βάρδια πιο ομαλή για όλη την ομάδα.",
  },
];

export function pickRandomTypingPassage(language: "en" | "el"): TypingPassage {
  const pool = TYPING_PASSAGES.filter((p) => p.language === language);
  const list = pool.length > 0 ? pool : TYPING_PASSAGES.filter((p) => p.language === "en");
  const idx = Math.floor(Math.random() * list.length);
  return list[idx]!;
}

/** Standard WPM: (correct characters / 5) / minutes. */
export function computeTypingStats(input: {
  passage: string;
  typed: string;
  elapsedMs: number;
}): { wpm: number; accuracy_percent: number; correctChars: number; totalTyped: number } {
  const target = input.passage;
  const typed = input.typed;
  let correct = 0;
  const len = Math.min(target.length, typed.length);
  for (let i = 0; i < len; i++) {
    if (typed[i] === target[i]) correct += 1;
  }
  const minutes = Math.max(input.elapsedMs / 60000, 1 / 60);
  const wpm = Math.round(((correct / 5) / minutes) * 100) / 100;
  const accuracy_percent =
    typed.length === 0
      ? 0
      : Math.round((correct / Math.max(typed.length, target.length === 0 ? 1 : Math.max(typed.length, 1))) * 10000) / 100;
  // More intuitive accuracy: correct / chars typed (capped), but also penalize incompleteness lightly via min(typed, target)
  const denom = Math.max(typed.length, 1);
  const accuracy = Math.round((correct / denom) * 10000) / 100;
  return {
    wpm: Math.max(0, wpm),
    accuracy_percent: Math.min(100, Math.max(0, accuracy)),
    correctChars: correct,
    totalTyped: typed.length,
  };
}
