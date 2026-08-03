/**
 * Supabase backend for services/pdf-maker.ts
 * Uses PascalCase field names in Airtable; Supabase mirror uses snake_case.
 */
import {
  publicId,
  sbDeleteByPublicId,
  sbInsert,
  sbSelectAll,
  type SbRow,
} from "@/lib/supabase-data";
import type {
  PdfDocument,
  PdfMetaField,
  PdfSection,
  PdfSectionStyle,
  PdfStyle,
  PdfTemplate,
  PdfTemplateConfig,
} from "./pdf-maker";
import { DEFAULT_PDF_STYLE, normalizePdfStyle } from "./pdf-maker";

const PDF_DOCUMENTS_TABLE = "pdf_documents";
const PDF_TEMPLATES_TABLE = "pdf_templates";

type TemplateRow = SbRow & Record<string, unknown>;
type DocumentRow = SbRow & Record<string, unknown>;

const SECTION_STYLES = new Set<PdfSectionStyle>(["normal", "reference_link", "script_breakdown"]);

function fieldStr(f: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = f[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

function parseSectionStyle(raw: unknown): PdfSectionStyle | undefined {
  if (typeof raw !== "string") return undefined;
  const style = raw.trim() as PdfSectionStyle;
  return SECTION_STYLES.has(style) ? style : undefined;
}

function parseMetaFieldsJson(raw: unknown): PdfMetaField[] {
  if (raw == null || raw === "") return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        const label = typeof row.label === "string" ? row.label.trim() : "";
        const value = typeof row.value === "string" ? row.value.trim() : "";
        if (!label && !value) return null;
        return { label, value };
      })
      .filter((item): item is PdfMetaField => item != null)
      .slice(0, 3);
  } catch {
    return [];
  }
}

function parseTemplateConfigJson(raw: unknown): PdfTemplateConfig | undefined {
  if (raw == null || raw === "") return undefined;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object") return undefined;
    const row = parsed as Record<string, unknown>;
    const config: PdfTemplateConfig = {};
    const meta = parseMetaFieldsJson(row.defaultMetaFields);
    if (meta.length > 0) config.defaultMetaFields = meta;
    if (typeof row.defaultFooterText === "string" && row.defaultFooterText.trim()) {
      config.defaultFooterText = row.defaultFooterText.trim();
    }
    return Object.keys(config).length > 0 ? config : undefined;
  } catch {
    return undefined;
  }
}

function parseSectionsJson(raw: unknown): PdfSection[] {
  if (raw == null || raw === "") return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => {
      if (typeof item === "string") {
        const title = item.trim();
        return title ? { title, content: "" } : { content: "" };
      }
      if (!item || typeof item !== "object") {
        return { content: String(item ?? "") };
      }
      const row = item as Record<string, unknown>;
      const title = typeof row.title === "string" ? row.title : undefined;
      const content = typeof row.content === "string" ? row.content : String(row.content ?? "");
      const sectionStyle = parseSectionStyle(row.sectionStyle);
      return sectionStyle ? { title, content, sectionStyle } : { title, content };
    });
  } catch {
    return [];
  }
}

function parseStyleJson(raw: unknown): PdfStyle {
  if (raw == null || raw === "") return { ...DEFAULT_PDF_STYLE };
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_PDF_STYLE };
    return normalizePdfStyle(parsed as Partial<PdfStyle>);
  } catch {
    return { ...DEFAULT_PDF_STYLE };
  }
}

function mapTemplate(row: TemplateRow): PdfTemplate {
  const defaultRaw = row["Default Sections"] ?? row.default_sections;
  const configRaw = row["Template Config"] ?? row.template_config;
  return {
    id: publicId(row),
    templateId: fieldStr(row, "Template ID", "template_id"),
    name: fieldStr(row, "Name", "name") || "Untitled template",
    description: fieldStr(row, "Description", "description"),
    defaultSections: parseSectionsJson(defaultRaw),
    config: parseTemplateConfigJson(configRaw),
  };
}

function mapDocument(row: DocumentRow): PdfDocument {
  const sectionsRaw = row.Sections ?? row.sections;
  const metaRaw = row["Meta Fields"] ?? row.meta_fields;
  const styleRaw = row.Style ?? row.style;
  const createdBy = fieldStr(row, "Created By", "created_by");
  return {
    id: publicId(row),
    title: fieldStr(row, "Title", "title") || "Untitled",
    subtitle: fieldStr(row, "Subtitle", "subtitle"),
    template: fieldStr(row, "Template", "template"),
    sections: parseSectionsJson(sectionsRaw),
    metaFields: parseMetaFieldsJson(metaRaw),
    style: parseStyleJson(styleRaw),
    createdBy,
    fileUrl: fieldStr(row, "File URL", "file_url"),
    createdAt: fieldStr(row, "Created At", "created_at"),
  };
}

export async function getPdfTemplates(): Promise<PdfTemplate[]> {
  const rows = await sbSelectAll<TemplateRow>(PDF_TEMPLATES_TABLE);
  return rows.map(mapTemplate).sort((a, b) => a.name.localeCompare(b.name));
}

export async function createPdfDocument(input: {
  title: string;
  subtitle?: string;
  sections: PdfSection[];
  metaFields?: PdfMetaField[];
  template?: string;
  style: PdfStyle;
  createdBy?: string;
  fileUrl: string;
}): Promise<PdfDocument> {
  const style = normalizePdfStyle(input.style);
  const metaFields = parseMetaFieldsJson(input.metaFields ?? []);
  const now = new Date().toISOString();
  const row = await sbInsert<DocumentRow>(PDF_DOCUMENTS_TABLE, {
    Title: input.title.trim(),
    Subtitle: input.subtitle?.trim() ?? "",
    Template: input.template?.trim() ?? "",
    Sections: JSON.stringify(input.sections),
    "Meta Fields": JSON.stringify(metaFields),
    Style: JSON.stringify(style),
    "File URL": input.fileUrl.trim(),
    "Created At": now,
    "Created By": String(input.createdBy || "Unknown"),
  });
  return mapDocument(row);
}

export async function getPdfHistory(limit = 20): Promise<PdfDocument[]> {
  const rows = await sbSelectAll<DocumentRow>(PDF_DOCUMENTS_TABLE);
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100);
  return rows
    .map(mapDocument)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, safeLimit);
}

export async function deletePdfDocument(recordId: string): Promise<void> {
  const id = recordId.trim();
  if (!id) throw new Error("Missing record id");
  await sbDeleteByPublicId(PDF_DOCUMENTS_TABLE, id);
}
