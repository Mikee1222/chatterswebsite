import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN_L = 50;
const MARGIN_R = 50;
const MIN_Y = 55;
const FOOTER_Y = 28;
const FOOTER_TEXT = "GUNZO AGENCY - CONFIDENTIAL";
const BODY_WRAP_CHARS = 72;
const BODY_SIZE = 10;
const BODY_LINE_HEIGHT = 14;
const SECTION_TITLE_SIZE = 14;
const SECTION_TITLE_GAP = 22;
const FIRST_CONTENT_Y = 680;
const CONTINUATION_CONTENT_Y = PAGE_H - 50;

const BG = [10 / 255, 10 / 255, 10 / 255] as const;
const PINK = [1, 20 / 255, 147 / 255] as const;
const WHITE = [1, 1, 1] as const;
const LIGHT_GRAY = [0.75, 0.75, 0.75] as const;
const BANNER = [15 / 255, 15 / 255, 15 / 255] as const;

const requestSchema = z.object({
  title: z.string().min(1).max(500),
  subtitle: z.string().max(500).optional(),
  sections: z
    .array(
      z.object({
        title: z.string().max(500).optional(),
        content: z.string().max(50000),
      }),
    )
    .max(50),
});

type Rgb = readonly [number, number, number];

function escapePdfString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r/g, "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

function wrapText(text: string, maxChars: number): string[] {
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
      if (candidate.length > maxChars && current) {
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

class ContentStream {
  private parts: string[] = [];

  fillRect(x: number, y: number, w: number, h: number, color: Rgb) {
    this.parts.push(`${color[0]} ${color[1]} ${color[2]} rg`);
    this.parts.push(`${x} ${y} ${w} ${h} re`);
    this.parts.push("f");
  }

  line(x1: number, y1: number, x2: number, y2: number, color: Rgb, width = 0.75) {
    this.parts.push(`${width} w`);
    this.parts.push(`${color[0]} ${color[1]} ${color[2]} RG`);
    this.parts.push(`${x1} ${y1} m`);
    this.parts.push(`${x2} ${y2} l`);
    this.parts.push("S");
  }

  text(x: number, y: number, text: string, font: "F1" | "F2", size: number, color: Rgb) {
    if (!text) return;
    this.parts.push("BT");
    this.parts.push(`/${font} ${size} Tf`);
    this.parts.push(`${color[0]} ${color[1]} ${color[2]} rg`);
    this.parts.push(`1 0 0 1 ${x} ${y} Tm`);
    this.parts.push(`(${escapePdfString(text)}) Tj`);
    this.parts.push("ET");
  }

  textCentered(y: number, text: string, font: "F1" | "F2", size: number, color: Rgb) {
    const approxWidth = text.length * size * 0.5;
    const x = Math.max(MARGIN_L, (PAGE_W - approxWidth) / 2);
    this.text(x, y, text, font, size, color);
  }

  toString() {
    return this.parts.join("\n");
  }
}

function drawFirstPageBackground(stream: ContentStream) {
  stream.fillRect(0, 0, PAGE_W, PAGE_H, BG);
  stream.fillRect(0, PAGE_H - 6, PAGE_W, 6, PINK);
  stream.fillRect(0, PAGE_H - 106, PAGE_W, 100, BANNER);
}

function drawContinuationPageBackground(stream: ContentStream) {
  stream.fillRect(0, 0, PAGE_W, PAGE_H, BG);
  stream.fillRect(0, PAGE_H - 3, PAGE_W, 3, PINK);
}

function drawFooter(stream: ContentStream) {
  stream.textCentered(FOOTER_Y, FOOTER_TEXT, "F1", 8, PINK);
}

function drawFirstPageHeader(stream: ContentStream, title: string, subtitle?: string) {
  stream.text(MARGIN_L, PAGE_H - 48, title, "F2", 26, WHITE);
  if (subtitle?.trim()) {
    stream.text(MARGIN_L, PAGE_H - 78, subtitle.trim(), "F1", 13, PINK);
  }
}

function buildPageStreams(
  title: string,
  subtitle: string | undefined,
  sections: Array<{ title?: string; content: string }>,
): string[] {
  const streams: ContentStream[] = [];
  let stream = new ContentStream();
  let y = FIRST_CONTENT_Y;
  let isFirstPage = true;

  drawFirstPageBackground(stream);
  drawFirstPageHeader(stream, title, subtitle);

  function startNewPage() {
    drawFooter(stream);
    streams.push(stream);
    stream = new ContentStream();
    drawContinuationPageBackground(stream);
    y = CONTINUATION_CONTENT_Y;
    isFirstPage = false;
  }

  function ensureSpace(height: number) {
    if (y - height < MIN_Y) startNewPage();
  }

  for (const section of sections) {
    const sectionTitle = section.title?.trim();
    if (sectionTitle) {
      ensureSpace(SECTION_TITLE_GAP + 6);
      stream.text(MARGIN_L, y, sectionTitle, "F2", SECTION_TITLE_SIZE, PINK);
      stream.line(MARGIN_L, y - 4, PAGE_W - MARGIN_R, y - 4, PINK, 0.75);
      y -= SECTION_TITLE_GAP;
    }

    const lines = wrapText(section.content ?? "", BODY_WRAP_CHARS);
    for (const line of lines) {
      ensureSpace(BODY_LINE_HEIGHT);
      if (line) {
        stream.text(MARGIN_L, y, line, "F1", BODY_SIZE, LIGHT_GRAY);
      }
      y -= BODY_LINE_HEIGHT;
    }

    if (!isFirstPage || section !== sections[0]) {
      y -= 6;
    } else {
      y -= 10;
    }
  }

  drawFooter(stream);
  streams.push(stream);
  return streams.map((s) => s.toString());
}

class PdfDocument {
  private chunks: string[] = ["%PDF-1.4\n"];
  private offsets: number[] = [];
  private objectCount = 0;

  addObject(content: string): number {
    this.objectCount += 1;
    this.offsets.push(this.chunks.join("").length);
    this.chunks.push(`${this.objectCount} 0 obj\n${content}\nendobj\n`);
    return this.objectCount;
  }

  finalize(catalogId: number): Uint8Array {
    const body = this.chunks.join("");
    const xrefOffset = body.length;
    let xref = `xref\n0 ${this.objectCount + 1}\n`;
    xref += "0000000000 65535 f \n";
    for (const offset of this.offsets) {
      xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
    }
    const trailer = `trailer\n<< /Size ${this.objectCount + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return new TextEncoder().encode(body + xref + trailer);
  }
}

function buildPdfBytes(
  title: string,
  subtitle: string | undefined,
  sections: Array<{ title?: string; content: string }>,
): Uint8Array {
  const pageStreams = buildPageStreams(title, subtitle, sections);
  const pageCount = pageStreams.length;

  const fontRegularId = 1;
  const fontBoldId = 2;
  const pagesId = 3 + pageCount * 2;
  const catalogId = pagesId + 1;

  const doc = new PdfDocument();

  doc.addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  doc.addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const pageIds: number[] = [];

  for (let i = 0; i < pageCount; i += 1) {
    const streamContent = pageStreams[i]!;
    const streamLength = new TextEncoder().encode(streamContent).length;
    const contentId = doc.addObject(`<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream`);
    const pageId = doc.addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> >>`,
    );
    pageIds.push(pageId);
  }

  doc.addObject(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`);
  doc.addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  return doc.finalize(catalogId);
}

function safeFilename(title: string): string {
  const base = title.trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
  return `${base || "document"}.pdf`;
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.SOPS_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { title, subtitle, sections } = parsed.data;
  const pdfBytes = buildPdfBytes(title, subtitle, sections);

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeFilename(title)}"`,
      "Cache-Control": "no-store",
    },
  });
}
