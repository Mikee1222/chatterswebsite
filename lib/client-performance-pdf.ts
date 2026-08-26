/**
 * Branded Client Gunzo Partnership monthly performance PDF.
 * Uses pdf-lib (same stack as PDF Maker) — no new PDF library.
 */

import fs from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export type ClientPerformancePdfInput = {
  clientName: string;
  yearMonth: string;
  modelNames: string[];
  narrative: string;
  stats: {
    grossRevenue?: number | null;
    netRevenue?: number | null;
    activeFans?: number | null;
    newFans?: number | null;
    renewals?: number | null;
    autoRenewPct?: number | null;
  };
  dailyRevenue?: Array<{ date: string; gross: number }>;
};

function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function pct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

async function tryEmbedLogo(pdf: PDFDocument): Promise<ReturnType<PDFDocument["embedPng"]> | null> {
  const candidates = [
    path.join(process.cwd(), "public", "apple-touch-icon-v2.png"),
    path.join(process.cwd(), "public", "icon-192-v2.png"),
  ];
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const bytes = fs.readFileSync(file);
      return await pdf.embedPng(bytes);
    } catch {
      // try next
    }
  }
  return null;
}

function wrapText(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number,
  maxWidth: number,
): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function buildClientPerformancePdfBytes(
  input: ClientPerformancePdfInput,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const margin = 48;
  const pink = rgb(0.914, 0.118, 0.549);
  const dark = rgb(0.08, 0.07, 0.12);
  const muted = rgb(0.45, 0.45, 0.5);
  const white = rgb(1, 1, 1);

  // Background wash
  page.drawRectangle({ x: 0, y: 0, width, height, color: dark });
  page.drawRectangle({
    x: 0,
    y: height - 110,
    width,
    height: 110,
    color: rgb(0.12, 0.09, 0.16),
  });

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const logo = await tryEmbedLogo(pdf);
  if (logo) {
    const logoH = 36;
    const logoW = (logo.width / logo.height) * logoH;
    page.drawImage(logo, {
      x: margin,
      y: height - 70,
      width: logoW,
      height: logoH,
    });
  } else {
    page.drawText("GUNZO", {
      x: margin,
      y: height - 58,
      size: 18,
      font: bold,
      color: pink,
    });
  }

  page.drawText("Partnership Performance Report", {
    x: margin + 50,
    y: height - 48,
    size: 14,
    font: bold,
    color: white,
  });
  page.drawText(`${input.clientName} · ${input.yearMonth}`, {
    x: margin + 50,
    y: height - 68,
    size: 10,
    font: regular,
    color: muted,
  });

  let y = height - 140;

  page.drawText("Models covered", {
    x: margin,
    y,
    size: 9,
    font: bold,
    color: pink,
  });
  y -= 16;
  const modelsLine =
    input.modelNames.length > 0 ? input.modelNames.join(", ") : "—";
  for (const line of wrapText(modelsLine, regular, 10, width - margin * 2)) {
    page.drawText(line, { x: margin, y, size: 10, font: regular, color: white });
    y -= 14;
  }

  y -= 12;
  page.drawText("Key stats", {
    x: margin,
    y,
    size: 9,
    font: bold,
    color: pink,
  });
  y -= 20;

  const rows: Array<[string, string]> = [
    ["Gross revenue", money(input.stats.grossRevenue)],
    ["Net revenue", money(input.stats.netRevenue)],
    ["Active fans", input.stats.activeFans != null ? String(input.stats.activeFans) : "—"],
    ["New fans", input.stats.newFans != null ? String(input.stats.newFans) : "—"],
    ["Renewals", input.stats.renewals != null ? String(input.stats.renewals) : "—"],
    ["Auto-renew", pct(input.stats.autoRenewPct)],
  ];

  const colW = (width - margin * 2) / 3;
  rows.forEach((row, i) => {
    const col = i % 3;
    const rowIdx = Math.floor(i / 3);
    const x = margin + col * colW;
    const yy = y - rowIdx * 42;
    page.drawRectangle({
      x,
      y: yy - 8,
      width: colW - 8,
      height: 36,
      color: rgb(0.14, 0.12, 0.18),
      borderColor: rgb(0.25, 0.22, 0.3),
      borderWidth: 0.5,
    });
    page.drawText(row[0], { x: x + 8, y: yy + 12, size: 8, font: regular, color: muted });
    page.drawText(row[1], { x: x + 8, y: yy - 2, size: 12, font: bold, color: white });
  });
  y -= Math.ceil(rows.length / 3) * 42 + 16;

  // Simple sparkline-like bar chart for daily revenue
  const daily = (input.dailyRevenue ?? []).slice(-31);
  if (daily.length > 1) {
    page.drawText("Daily revenue", {
      x: margin,
      y,
      size: 9,
      font: bold,
      color: pink,
    });
    y -= 10;
    const chartH = 70;
    const chartW = width - margin * 2;
    const maxG = Math.max(...daily.map((d) => d.gross), 1);
    const barW = chartW / daily.length;
    page.drawRectangle({
      x: margin,
      y: y - chartH,
      width: chartW,
      height: chartH,
      color: rgb(0.12, 0.1, 0.15),
    });
    daily.forEach((d, i) => {
      const h = (d.gross / maxG) * (chartH - 4);
      page.drawRectangle({
        x: margin + i * barW + 1,
        y: y - chartH + 2,
        width: Math.max(1, barW - 2),
        height: Math.max(1, h),
        color: pink,
      });
    });
    y -= chartH + 20;
  }

  page.drawText("AI narrative", {
    x: margin,
    y,
    size: 9,
    font: bold,
    color: pink,
  });
  y -= 16;
  const narrative = input.narrative.trim() || "No narrative available for this month yet.";
  for (const line of wrapText(narrative, regular, 10, width - margin * 2)) {
    if (y < 60) break;
    page.drawText(line, { x: margin, y, size: 10, font: regular, color: white });
    y -= 14;
  }

  page.drawText("Confidential · Gunzo Partnership", {
    x: margin,
    y: 32,
    size: 8,
    font: regular,
    color: muted,
  });

  return pdf.save();
}
