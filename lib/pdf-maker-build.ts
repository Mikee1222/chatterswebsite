import fs from "node:fs";
import path from "node:path";
import { PDFDocument, type PDFFont, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { PdfSection } from "@/services/pdf-maker";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_L = 50;
const MARGIN_R = 50;
const MIN_Y_FROM_BOTTOM = 55;
const MAX_CONTENT_Y_FROM_TOP = PAGE_H - MIN_Y_FROM_BOTTOM;
const FOOTER_TEXT = "GUNZO AGENCY - CONFIDENTIAL";
const BODY_SIZE = 10;
const BODY_LINE_HEIGHT = 14;
const SECTION_TITLE_SIZE = 14;
const SECTION_TITLE_GAP = 22;
const FIRST_CONTENT_Y = 162;
const CONTINUATION_CONTENT_Y = 50;
const CONTENT_MAX_WIDTH = PAGE_W - MARGIN_L - MARGIN_R;

const BG = rgb(10 / 255, 10 / 255, 10 / 255);
const PINK = rgb(1, 20 / 255, 147 / 255);
const WHITE = rgb(1, 1, 1);
const LIGHT_GRAY = rgb(0.75, 0.75, 0.75);
const BANNER = rgb(15 / 255, 15 / 255, 15 / 255);

function yFromTop(pageHeight: number, fromTop: number): number {
  return pageHeight - fromTop;
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split("\n");

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }

    const words = paragraph.split(/\s+/);
    let current = "";

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      const width = font.widthOfTextAtSize(candidate, fontSize);
      if (width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }

    if (current) lines.push(current);
  }

  return lines.length > 0 ? lines : [""];
}

function readFontBytes(filename: string): Uint8Array {
  const fontPath = path.join(process.cwd(), "public", "fonts", filename);
  return new Uint8Array(fs.readFileSync(fontPath));
}

function drawFirstPageBackground(page: ReturnType<PDFDocument["addPage"]>) {
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: 0, width, height, color: BG });
  page.drawRectangle({ x: 0, y: height - 6, width, height: 6, color: PINK });
  page.drawRectangle({ x: 0, y: height - 106, width, height: 100, color: BANNER });
}

function drawContinuationPageBackground(page: ReturnType<PDFDocument["addPage"]>) {
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: 0, width, height, color: BG });
  page.drawRectangle({ x: 0, y: height - 3, width, height: 3, color: PINK });
}

function drawFooter(page: ReturnType<PDFDocument["addPage"]>, font: PDFFont) {
  const { width } = page.getSize();
  const size = 8;
  const textWidth = font.widthOfTextAtSize(FOOTER_TEXT, size);
  page.drawText(FOOTER_TEXT, {
    x: Math.max(MARGIN_L, (width - textWidth) / 2),
    y: 28,
    size,
    font,
    color: PINK,
  });
}

function drawFirstPageHeader(
  page: ReturnType<PDFDocument["addPage"]>,
  title: string,
  subtitle: string | undefined,
  regularFont: PDFFont,
  boldFont: PDFFont,
) {
  const height = page.getSize().height;
  page.drawText(title, {
    x: MARGIN_L,
    y: yFromTop(height, 48),
    size: 26,
    font: boldFont,
    color: WHITE,
  });
  if (subtitle?.trim()) {
    page.drawText(subtitle.trim(), {
      x: MARGIN_L,
      y: yFromTop(height, 78),
      size: 13,
      font: regularFont,
      color: PINK,
    });
  }
}

export async function buildPdfBytes(
  title: string,
  subtitle: string | undefined,
  sections: PdfSection[],
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const regularFont = await pdfDoc.embedFont(readFontBytes("DejaVuSans.ttf"));
  const boldFont = await pdfDoc.embedFont(readFontBytes("DejaVuSans-Bold.ttf"));

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = FIRST_CONTENT_Y;
  let isFirstPage = true;

  drawFirstPageBackground(page);
  drawFirstPageHeader(page, title, subtitle, regularFont, boldFont);

  function startNewPage() {
    drawFooter(page, regularFont);
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    drawContinuationPageBackground(page);
    y = CONTINUATION_CONTENT_Y;
    isFirstPage = false;
  }

  function ensureSpace(heightNeeded: number) {
    if (y + heightNeeded > MAX_CONTENT_Y_FROM_TOP) startNewPage();
  }

  for (const section of sections) {
    const sectionTitle = section.title?.trim();
    if (sectionTitle) {
      ensureSpace(SECTION_TITLE_GAP + 6);
      page.drawText(sectionTitle, {
        x: MARGIN_L,
        y: yFromTop(page.getSize().height, y),
        size: SECTION_TITLE_SIZE,
        font: boldFont,
        color: PINK,
      });
      const lineY = y + 4;
      page.drawLine({
        start: { x: MARGIN_L, y: yFromTop(page.getSize().height, lineY) },
        end: { x: PAGE_W - MARGIN_R, y: yFromTop(page.getSize().height, lineY) },
        thickness: 0.75,
        color: PINK,
      });
      y += SECTION_TITLE_GAP;
    }

    const lines = wrapText(section.content ?? "", regularFont, BODY_SIZE, CONTENT_MAX_WIDTH);
    for (const line of lines) {
      ensureSpace(BODY_LINE_HEIGHT);
      if (line) {
        page.drawText(line, {
          x: MARGIN_L,
          y: yFromTop(page.getSize().height, y),
          size: BODY_SIZE,
          font: regularFont,
          color: LIGHT_GRAY,
        });
      }
      y += BODY_LINE_HEIGHT;
    }

    y += isFirstPage && section === sections[0] ? 10 : 6;
  }

  drawFooter(page, regularFont);
  return pdfDoc.save();
}

export function safePdfFilename(title: string): string {
  const base = title
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return `${base || "document"}.pdf`;
}
