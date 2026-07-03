import { Fraunces, Noto_Serif } from "next/font/google";

/** Display serif for VA Tasks — Fraunces (Latin) + Noto Serif (Greek fallback). */
export const displaySerif = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-va-display",
  display: "swap",
});

/** Greek glyph fallback when Fraunces lacks coverage. */
export const displaySerifGreek = Noto_Serif({
  subsets: ["greek"],
  variable: "--font-va-display-greek",
  weight: ["400", "600", "700"],
  display: "swap",
});

export const displaySerifClassName = `${displaySerif.variable} ${displaySerifGreek.variable}`;

export const DISPLAY_SERIF_FAMILY =
  "var(--font-va-display), var(--font-va-display-greek), Georgia, 'Times New Roman', serif";
