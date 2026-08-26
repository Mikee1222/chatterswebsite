/**
 * Build a performance-review PDF using the established pdf-lib / pdf-maker pattern.
 */

import { buildPdfBytes, safePdfFilename } from "@/lib/pdf-maker-build";
import { DEFAULT_PDF_STYLE, type PdfMetaField, type PdfSection } from "@/services/pdf-maker";
import type { PerformanceReviewResult } from "@/services/ai-ops-features";

export async function buildPerformanceReviewPdfBytes(
  review: PerformanceReviewResult,
): Promise<{ bytes: Uint8Array; filename: string }> {
  const metaFields: PdfMetaField[] = [
    { label: "Person", value: review.person_name },
    { label: "Role", value: review.role === "chatter" ? "Chatter" : "Virtual Assistant" },
    {
      label: "Period",
      value: `${review.period.startYmd} → ${review.period.endYmd}`,
    },
  ];

  const sections: PdfSection[] = review.sections.map((s) => ({
    title: s.title,
    content: s.body,
  }));

  if (sections.length === 0) {
    sections.push({ title: "Review", content: review.review_markdown || "Insufficient data." });
  }

  const bytes = await buildPdfBytes(
    `Performance review — ${review.person_name}`,
    `Generated ${review.generated_at.slice(0, 10)} · grounded in app stats`,
    sections,
    DEFAULT_PDF_STYLE,
    metaFields,
  );

  const filename = safePdfFilename(
    `performance-review-${review.person_name}-${review.period.endYmd}.pdf`,
  );
  return { bytes, filename };
}
