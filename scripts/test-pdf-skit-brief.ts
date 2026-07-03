#!/usr/bin/env npx tsx
/**
 * Generate a local test PDF for the skit-brief template (no Airtable/blob required).
 *
 * Usage: npx tsx scripts/test-pdf-skit-brief.ts
 */

import fs from "node:fs";
import path from "node:path";
import { buildPdfBytes } from "@/lib/pdf-maker-build";
import { SKIT_BRIEF_DEFAULT_FOOTER } from "@/lib/pdf-maker-constants";
import { DEFAULT_PDF_STYLE, type PdfSection } from "@/services/pdf-maker";

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const sections: PdfSection[] = [
    {
      title: "Reference Link",
      sectionStyle: "reference_link",
      content:
        "https://drive.google.com/file/d/example-skit-reference\n_Σύνδεσμος αναφοράς για το σκηνικό και τα props._",
    },
    {
      title: "Πλήρες Ελληνικό Script",
      sectionStyle: "script_breakdown",
      content: [
        "SETTING: Στο σαλόνι ενός μοντέρνου διαμερίσματος, απόγευμα.",
        "ACTION: Η Lina μπαίνει από την πόρτα με τα κλειδιά στο χέρι.",
        "ΑΝΤΡΑΣ: Έφτασες! Σε περίμενα.",
        "LINA: Συγγνώμη για την καθυστέρηση — η κίνηση ήταν τρομερή.",
      ].join("\n"),
    },
    {
      title: "Special Instructions",
      sectionStyle: "normal",
      content:
        "Κρατήστε φυσικό ρυθμό. Χρησιμοποιήστε διαθέσιμο φυσικό φως όπου είναι δυνατόν. Επικοινωνήστε με τον manager πριν από οποιαδήποτε αλλαγή στο script.",
    },
  ];

  const pdfBytes = await buildPdfBytes(
    "Final Production Brief (Skit)",
    "Production brief for on-set team",
    sections,
    { ...DEFAULT_PDF_STYLE, footerText: SKIT_BRIEF_DEFAULT_FOOTER },
    [
      { label: "TYPE", value: "Skit" },
      { label: "MODEL", value: "Lina" },
      { label: "ΗΜΕΡΟΜΗΝΙΑ ΓΥΡΙΣΜΑΤΟΣ", value: today },
    ],
  );

  const outPath = path.join(process.cwd(), "tmp-skit-brief-test.pdf");
  fs.writeFileSync(outPath, pdfBytes);
  console.log(`Wrote ${outPath} (${pdfBytes.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
