/**
 * Typing speed test passages (~150–250 words) in English and Greek.
 * One random passage is chosen per attempt for the selected language.
 *
 * Greek passages are stored without tonos/accents so mobile keyboards that
 * omit accents are not unfairly penalized on accuracy.
 */

export type TypingPassage = {
  id: string;
  language: "en" | "el";
  text: string;
};

/** Strip Greek tonos and other combining diacritics (ά → α). English unchanged. */
export function stripGreekTonos(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "");
}

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
      "Η δουλεια του chatter χρειαζεται ηρεμια οταν οι fans στελνουν πολλα μηνυματα μαζι. Μαθαινεις να διαβαζεις τον τονο αναμεσα στις γραμμες, να απαντας καθαρα και να κρατας τη συζητηση ζεστη χωρις να βιαζεσαι. Τα upsells δουλευουν καλυτερα οταν φαινονται φυσικα: μια ιδεα για tip μετα απο ενα αληθινο κομπλιμεντο, η μια προταση για custom οταν ο fan μοιραζεται μια προτιμηση. Η ακριβεια μετραει γιατι λαθος τιμες η υποσχεσεις που δεν κρατιουνται χαλανε την εμπιστοσυνη. Η ταχυτητα βοηθαει στις ωρες αιχμης, αλλα η σαφηνεια ερχεται παντα πρωτη. Κρατα σημειωσεις για το τι αρεσει σε καθε fan ωστε η επομενη βαρδια να συνεχισει την ιστορια. Οταν κατι παει στραβα, αναλαβε το γρηγορα και προτεινε μια απλη λυση. Οι καλοι chatters συνδυαζουν προσωπικοτητα με πειθαρχια, ερχονται στην ωρα τους και αντιμετωπιζουν καθε μηνυμα σαν να ανηκει σε πραγματικο ανθρωπο.",
  },
  {
    id: "el_2",
    language: "el",
    text:
      "Μια δυνατη σχεση με τον fan χτιζεται με συνεπεια. Απαντα σε λογικο χρονο, θυμησου μικρες λεπτομερειες και μην εφευρισκεις ιστοριες που συγκρουονται με το προφιλ του μοντελου. Αν εχεις αμφιβολια για ενα οριο, σταματα και τσεκαρε πριν στειλεις. Το chatting ειναι δημιουργικη δουλεια: φτιαχνεις αναλαφρες στιγμες, κρατας το φλερτ παιχνιδιαρικο και οδηγεις τους fans σε περιεχομενο που ταιριαζει στη διαθεση τους. Παραλληλα, τα βασικα ειναι λειτουργικα. Παρακολουθησε tips, ακολουθησε τους κανονες τιμολογησης και κατεγραψε ο,τι χρειαζεται manager. Οι βραδινες βαρδιες μπορει να φαινονται μεγαλες, οποτε πιες νερο, κουνησου λιγο και ξαναβρες συγκεντρωση αναμεσα στα κυματα μηνυματων. Οταν ενας fan ειναι εκνευρισμενος, αναγνωρισε πρωτα το συναισθημα και μετα λυσε το θεμα. Οταν ειναι ησυχος, ενα συντομο και προσεκτικο check-in συχνα ανοιγει ξανα τη συζητηση καλυτερα απο μια σκληρη πωληση.",
  },
  {
    id: "el_3",
    language: "el",
    text:
      "Η πειθαρχια χωριζει τον μεσο chatter απο τον αξιοπιστο. Ελα ετοιμος με κωδικους, εργαλεια και καθαρο χωρο δουλειας. Το ιντερνετ μπορει να πεσει, γι αυτο να εχεις εναλλακτικο πλανο και να ενημερωνεις νωρις την ομαδα αν χαθει η συνδεση. Στην αιχμη, βαλε προτεραιοτητες: πρωτα whales και ενεργοι spenders, μετα ζεστα leads και μετα πιο ελαφρια chats. Χρησιμοποιησε templates ως αφετηρια, ποτε ως τυφλο copy-paste. Ξαναγραψε τα ωστε να ακουγονται σαν το μοντελο και να ταιριαζουν στον fan. Τα upsells πρεπει να μοιαζουν με προσκληση, οχι με πιεση. Αν καποιος πει οχι, σεβασου το και κρατα φιλικο κλιμα. Με τον καιρο θα δεις μοτιβα: ποιος tipαρει μετα απο voice notes, ποιος προτιμαει μεγαλες κουβεντες, ποιος αγοραζει PPV τα σαββατοκυριακα. Γραψε τα. Αυτη η γνωση μεγαλωνει και κανει καθε επομενη βαρδια πιο ομαλη για ολη την ομαδα.",
  },
];

export function pickRandomTypingPassage(language: "en" | "el"): TypingPassage {
  const pool = TYPING_PASSAGES.filter((p) => p.language === language);
  const list = pool.length > 0 ? pool : TYPING_PASSAGES.filter((p) => p.language === "en");
  const idx = Math.floor(Math.random() * list.length);
  const picked = list[idx]!;
  // Ensure Greek display + accuracy target never include tonos
  if (picked.language === "el") {
    return { ...picked, text: stripGreekTonos(picked.text) };
  }
  return picked;
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
