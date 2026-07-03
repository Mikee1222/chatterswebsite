import fs from "node:fs";
import path from "node:path";
import { PDFDocument, type PDFFont, type PDFPage, rgb, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  DEFAULT_PDF_STYLE,
  normalizePdfStyle,
  type PdfSection,
  type PdfStyle,
} from "@/services/pdf-maker";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_L = 50;
const MARGIN_R = 50;
const MIN_Y_FROM_BOTTOM = 55;
const MAX_CONTENT_Y_FROM_TOP = PAGE_H - MIN_Y_FROM_BOTTOM;
const BODY_SIZE = 10;
const BODY_LINE_HEIGHT = 14;
const SECTION_TITLE_SIZE = 14;
const SECTION_TITLE_GAP = 22;
const FIRST_CONTENT_Y = 162;
const CONTINUATION_CONTENT_Y = 50;
const CONTENT_MAX_WIDTH = PAGE_W - MARGIN_L - MARGIN_R;

const NUMBERED_HEADER_SIZE = 11;
const NUMBERED_HEADER_LINE_HEIGHT = 16;
const NUMBERED_HEADER_EXTRA_BEFORE = 10;
const NUMBERED_HEADER_ACCENT_WIDTH = 2;
const NUMBERED_HEADER_ACCENT_GAP = 8;
const NUMBERED_HEADER_TEXT_X =
  MARGIN_L + NUMBERED_HEADER_ACCENT_WIDTH + NUMBERED_HEADER_ACCENT_GAP;
const NUMBERED_HEADER_TEXT_MAX_WIDTH = PAGE_W - MARGIN_R - NUMBERED_HEADER_TEXT_X;

const WARNING_PADDING_X = 10;
const WARNING_PADDING_Y = 8;
const WARNING_EXTRA_AFTER = 4;

const BULLET_CHAR = "•";
const BULLET_INDENT = 14;

const NUMBERED_HEADER_RE = /^(.+?##)\s+—\s+(.+)$/;

type LineKind = "empty" | "warning" | "field_label" | "numbered_header" | "bullet" | "body";

type PdfPalette = {
  bg: RGB;
  banner: RGB;
  bodyText: RGB;
  headerTitle: RGB;
  accent: RGB;
  warningBg: RGB;
  warningText: RGB;
};

type RenderContext = {
  page: PDFPage;
  y: number;
  regularFont: PDFFont;
  boldFont: PDFFont;
  pageHeight: number;
  palette: PdfPalette;
  footerText: string;
  ensureSpace: (heightNeeded: number) => void;
  setPage: (page: PDFPage) => void;
  setY: (y: number) => void;
  getY: () => number;
};

function yFromTop(pageHeight: number, fromTop: number): number {
  return pageHeight - fromTop;
}

function hexToPdfRgb(hex: string, fallback: RGB): RGB {
  const h = hex.replace("#", "").trim();
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16) / 255;
    const g = parseInt(h[1] + h[1], 16) / 255;
    const b = parseInt(h[2] + h[2], 16) / 255;
    if ([r, g, b].some((v) => Number.isNaN(v))) return fallback;
    return rgb(r, g, b);
  }
  if (h.length >= 6) {
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    if ([r, g, b].some((v) => Number.isNaN(v))) return fallback;
    return rgb(r, g, b);
  }
  return fallback;
}

function resolvePalette(style: PdfStyle): PdfPalette {
  const accent = hexToPdfRgb(style.accentColor, rgb(1, 20 / 255, 147 / 255));

  if (style.theme === "light") {
    return {
      bg: hexToPdfRgb("#FFFFFF", rgb(1, 1, 1)),
      banner: hexToPdfRgb("#F5F5F5", rgb(0.96, 0.96, 0.96)),
      bodyText: hexToPdfRgb("#1A1A1A", rgb(0.1, 0.1, 0.1)),
      headerTitle: hexToPdfRgb("#0A0A0A", rgb(0.04, 0.04, 0.04)),
      accent,
      warningBg: hexToPdfRgb("#FFF0EB", rgb(1, 0.94, 0.92)),
      warningText: hexToPdfRgb("#7A2E1A", rgb(0.48, 0.18, 0.1)),
    };
  }

  const bg = hexToPdfRgb(style.backgroundColor, rgb(10 / 255, 10 / 255, 10 / 255));
  return {
    bg,
    banner: hexToPdfRgb("#0F0F0F", rgb(15 / 255, 15 / 255, 15 / 255)),
    bodyText: hexToPdfRgb(style.textColor, rgb(0.75, 0.75, 0.75)),
    headerTitle: rgb(1, 1, 1),
    accent,
    warningBg: rgb(0.28, 0.12, 0.1),
    warningText: rgb(1, 0.85, 0.75),
  };
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

function classifyLine(rawLine: string): LineKind {
  const trimmed = rawLine.trim();
  if (!trimmed) return "empty";
  if (trimmed.startsWith("⚠")) return "warning";
  if (NUMBERED_HEADER_RE.test(trimmed)) return "numbered_header";
  if (trimmed.startsWith("•")) return "bullet";
  if (/^[^:]+:\s*/.test(trimmed)) return "field_label";
  return "body";
}

function readFontBytes(filename: string): Uint8Array {
  const fontPath = path.join(process.cwd(), "public", "fonts", filename);
  return new Uint8Array(fs.readFileSync(fontPath));
}

function drawFirstPageBackground(page: PDFPage, palette: PdfPalette) {
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: 0, width, height, color: palette.bg });
  page.drawRectangle({ x: 0, y: height - 6, width, height: 6, color: palette.accent });
  page.drawRectangle({ x: 0, y: height - 106, width, height: 100, color: palette.banner });
}

function drawContinuationPageBackground(page: PDFPage, palette: PdfPalette) {
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: 0, width, height, color: palette.bg });
  page.drawRectangle({ x: 0, y: height - 3, width, height: 3, color: palette.accent });
}

function drawFooter(page: PDFPage, font: PDFFont, footerText: string, accent: RGB) {
  const { width } = page.getSize();
  const size = 8;
  const textWidth = font.widthOfTextAtSize(footerText, size);
  page.drawText(footerText, {
    x: Math.max(MARGIN_L, (width - textWidth) / 2),
    y: 28,
    size,
    font,
    color: accent,
  });
}

function drawFirstPageHeader(
  page: PDFPage,
  title: string,
  subtitle: string | undefined,
  regularFont: PDFFont,
  boldFont: PDFFont,
  palette: PdfPalette,
) {
  const height = page.getSize().height;
  page.drawText(title, {
    x: MARGIN_L,
    y: yFromTop(height, 48),
    size: 26,
    font: boldFont,
    color: palette.headerTitle,
  });
  if (subtitle?.trim()) {
    page.drawText(subtitle.trim(), {
      x: MARGIN_L,
      y: yFromTop(height, 78),
      size: 13,
      font: regularFont,
      color: palette.accent,
    });
  }
}

function drawBodyText(ctx: RenderContext, rawLine: string) {
  const wrapped = wrapText(rawLine, ctx.regularFont, BODY_SIZE, CONTENT_MAX_WIDTH);
  for (const line of wrapped) {
    ctx.ensureSpace(BODY_LINE_HEIGHT);
    if (line) {
      ctx.page.drawText(line, {
        x: MARGIN_L,
        y: yFromTop(ctx.pageHeight, ctx.getY()),
        size: BODY_SIZE,
        font: ctx.regularFont,
        color: ctx.palette.bodyText,
      });
    }
    ctx.setY(ctx.getY() + BODY_LINE_HEIGHT);
  }
}

function drawWarningBox(ctx: RenderContext, rawLine: string) {
  const text = rawLine.trim().replace(/^⚠\s*/, "").trim();
  const wrapped = wrapText(text, ctx.boldFont, BODY_SIZE, CONTENT_MAX_WIDTH - WARNING_PADDING_X * 2);
  const boxHeight =
    wrapped.length * BODY_LINE_HEIGHT + WARNING_PADDING_Y * 2;
  const boxWidth = CONTENT_MAX_WIDTH;

  ctx.ensureSpace(boxHeight + WARNING_EXTRA_AFTER);

  const boxTop = ctx.getY();
  ctx.page.drawRectangle({
    x: MARGIN_L,
    y: yFromTop(ctx.pageHeight, boxTop + boxHeight),
    width: boxWidth,
    height: boxHeight,
    color: ctx.palette.warningBg,
  });

  let lineY = boxTop + WARNING_PADDING_Y;
  for (const line of wrapped) {
    if (line) {
      ctx.page.drawText(line, {
        x: MARGIN_L + WARNING_PADDING_X,
        y: yFromTop(ctx.pageHeight, lineY),
        size: BODY_SIZE,
        font: ctx.boldFont,
        color: ctx.palette.warningText,
      });
    }
    lineY += BODY_LINE_HEIGHT;
  }

  ctx.setY(boxTop + boxHeight + WARNING_EXTRA_AFTER);
}

function drawFieldLabel(ctx: RenderContext, rawLine: string) {
  const trimmed = rawLine.trim();
  const colonIndex = trimmed.indexOf(":");
  const labelPart = trimmed.slice(0, colonIndex + 1);
  const valuePart = trimmed.slice(colonIndex + 1).trimStart();

  const labelWidth = ctx.boldFont.widthOfTextAtSize(labelPart, BODY_SIZE);
  const valueX = MARGIN_L + labelWidth;
  const valueMaxWidth = CONTENT_MAX_WIDTH - labelWidth;

  const valueWrapped = valuePart
    ? wrapText(valuePart, ctx.regularFont, BODY_SIZE, valueMaxWidth)
    : [""];

  for (let i = 0; i < valueWrapped.length; i++) {
    ctx.ensureSpace(BODY_LINE_HEIGHT);
    const lineY = ctx.getY();

    if (i === 0) {
      ctx.page.drawText(labelPart, {
        x: MARGIN_L,
        y: yFromTop(ctx.pageHeight, lineY),
        size: BODY_SIZE,
        font: ctx.boldFont,
        color: ctx.palette.accent,
      });
    }

    const valueLine = valueWrapped[i];
    if (valueLine) {
      ctx.page.drawText(valueLine, {
        x: i === 0 ? valueX : MARGIN_L + labelWidth,
        y: yFromTop(ctx.pageHeight, lineY),
        size: BODY_SIZE,
        font: ctx.regularFont,
        color: ctx.palette.bodyText,
      });
    }

    ctx.setY(lineY + BODY_LINE_HEIGHT);
  }
}

function drawNumberedHeader(ctx: RenderContext, rawLine: string) {
  const match = rawLine.trim().match(NUMBERED_HEADER_RE);
  if (!match) {
    drawBodyText(ctx, rawLine);
    return;
  }

  const headerText = `${match[1]} — ${match[2]}`;
  const wrapped = wrapText(
    headerText,
    ctx.boldFont,
    NUMBERED_HEADER_SIZE,
    NUMBERED_HEADER_TEXT_MAX_WIDTH,
  );
  const blockHeight = wrapped.length * NUMBERED_HEADER_LINE_HEIGHT;

  ctx.setY(ctx.getY() + NUMBERED_HEADER_EXTRA_BEFORE);
  ctx.ensureSpace(blockHeight);

  const blockTop = ctx.getY();
  const accentTop = blockTop;
  const accentBottom = blockTop + blockHeight;

  ctx.page.drawRectangle({
    x: MARGIN_L,
    y: yFromTop(ctx.pageHeight, accentBottom),
    width: NUMBERED_HEADER_ACCENT_WIDTH,
    height: accentBottom - accentTop,
    color: ctx.palette.accent,
  });

  let lineY = blockTop;
  for (const line of wrapped) {
    if (line) {
      ctx.page.drawText(line, {
        x: NUMBERED_HEADER_TEXT_X,
        y: yFromTop(ctx.pageHeight, lineY),
        size: NUMBERED_HEADER_SIZE,
        font: ctx.boldFont,
        color: ctx.palette.headerTitle,
      });
    }
    lineY += NUMBERED_HEADER_LINE_HEIGHT;
  }

  ctx.setY(blockTop + blockHeight);
}

function drawBullet(ctx: RenderContext, rawLine: string) {
  const text = rawLine.trim().replace(/^•\s*/, "");
  const textX = MARGIN_L + BULLET_INDENT;
  const textMaxWidth = CONTENT_MAX_WIDTH - BULLET_INDENT;
  const wrapped = wrapText(text, ctx.regularFont, BODY_SIZE, textMaxWidth);

  for (let i = 0; i < wrapped.length; i++) {
    ctx.ensureSpace(BODY_LINE_HEIGHT);
    const lineY = ctx.getY();

    if (i === 0) {
      ctx.page.drawText(BULLET_CHAR, {
        x: MARGIN_L,
        y: yFromTop(ctx.pageHeight, lineY),
        size: BODY_SIZE,
        font: ctx.regularFont,
        color: ctx.palette.bodyText,
      });
    }

    const line = wrapped[i];
    if (line) {
      ctx.page.drawText(line, {
        x: textX,
        y: yFromTop(ctx.pageHeight, lineY),
        size: BODY_SIZE,
        font: ctx.regularFont,
        color: ctx.palette.bodyText,
      });
    }

    ctx.setY(lineY + BODY_LINE_HEIGHT);
  }
}

function renderContentLine(ctx: RenderContext, rawLine: string) {
  switch (classifyLine(rawLine)) {
    case "empty":
      ctx.ensureSpace(BODY_LINE_HEIGHT);
      ctx.setY(ctx.getY() + BODY_LINE_HEIGHT);
      break;
    case "warning":
      drawWarningBox(ctx, rawLine);
      break;
    case "field_label":
      drawFieldLabel(ctx, rawLine);
      break;
    case "numbered_header":
      drawNumberedHeader(ctx, rawLine);
      break;
    case "bullet":
      drawBullet(ctx, rawLine);
      break;
    case "body":
      drawBodyText(ctx, rawLine);
      break;
  }
}

export async function buildPdfBytes(
  title: string,
  subtitle: string | undefined,
  sections: PdfSection[],
  style: PdfStyle = DEFAULT_PDF_STYLE,
): Promise<Uint8Array> {
  const resolvedStyle = normalizePdfStyle(style);
  const palette = resolvePalette(resolvedStyle);
  const footerText = resolvedStyle.footerText;

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const regularFont = await pdfDoc.embedFont(readFontBytes("DejaVuSans.ttf"));
  const boldFont = await pdfDoc.embedFont(readFontBytes("DejaVuSans-Bold.ttf"));

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = FIRST_CONTENT_Y;
  let isFirstPage = true;

  drawFirstPageBackground(page, palette);
  drawFirstPageHeader(page, title, subtitle, regularFont, boldFont, palette);

  const renderCtx: RenderContext = {
    page,
    y,
    regularFont,
    boldFont,
    pageHeight: PAGE_H,
    palette,
    footerText,
    ensureSpace: () => {},
    setPage: () => {},
    setY: () => {},
    getY: () => y,
  };

  function startNewPage() {
    drawFooter(page, regularFont, footerText, palette.accent);
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    drawContinuationPageBackground(page, palette);
    y = CONTINUATION_CONTENT_Y;
    isFirstPage = false;
    renderCtx.page = page;
    renderCtx.y = y;
    renderCtx.pageHeight = page.getSize().height;
  }

  function ensureSpace(heightNeeded: number) {
    if (y + heightNeeded > MAX_CONTENT_Y_FROM_TOP) startNewPage();
  }

  renderCtx.ensureSpace = ensureSpace;
  renderCtx.setPage = (nextPage) => {
    page = nextPage;
    renderCtx.page = nextPage;
    renderCtx.pageHeight = nextPage.getSize().height;
  };
  renderCtx.setY = (nextY) => {
    y = nextY;
    renderCtx.y = nextY;
  };
  renderCtx.getY = () => y;

  for (const section of sections) {
    const sectionTitle = section.title?.trim();
    if (sectionTitle) {
      ensureSpace(SECTION_TITLE_GAP + 6);
      page.drawText(sectionTitle, {
        x: MARGIN_L,
        y: yFromTop(page.getSize().height, y),
        size: SECTION_TITLE_SIZE,
        font: boldFont,
        color: palette.accent,
      });
      const lineY = y + 4;
      page.drawLine({
        start: { x: MARGIN_L, y: yFromTop(page.getSize().height, lineY) },
        end: { x: PAGE_W - MARGIN_R, y: yFromTop(page.getSize().height, lineY) },
        thickness: 0.75,
        color: palette.accent,
      });
      y += SECTION_TITLE_GAP;
      renderCtx.y = y;
    }

    const rawLines = (section.content ?? "").split("\n");
    for (const rawLine of rawLines) {
      renderCtx.page = page;
      renderCtx.pageHeight = page.getSize().height;
      renderContentLine(renderCtx, rawLine);
      y = renderCtx.y;
      page = renderCtx.page;
    }

    y += isFirstPage && section === sections[0] ? 10 : 6;
    renderCtx.y = y;
  }

  drawFooter(page, regularFont, footerText, palette.accent);
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
