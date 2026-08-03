import {
  createRecord,
  deleteRecord,
  listRecords,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { isSupabaseBackend } from "@/lib/data-backend";
import { getSystemSetting, setSystemSetting } from "@/services/system-settings";

export const PDF_DOCUMENTS_TABLE = "pdf_documents";
export const PDF_TEMPLATES_TABLE = "pdf_templates";

export type PdfSectionStyle = "normal" | "reference_link" | "script_breakdown";

export type PdfSection = {
  title?: string;
  content: string;
  sectionStyle?: PdfSectionStyle;
};

export type PdfMetaField = {
  label: string;
  value: string;
};

export type PdfTemplateConfig = {
  defaultMetaFields?: PdfMetaField[];
  defaultFooterText?: string;
};

export type PdfStyle = {
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  theme: "dark" | "light";
  fontFamily: string;
  footerText: string;
};

export const DEFAULT_PDF_STYLE: PdfStyle = {
  accentColor: "#FF1493",
  backgroundColor: "#0A0A0A",
  textColor: "#DCDCDC",
  theme: "dark",
  fontFamily: "DejaVu",
  footerText: "GUNZO AGENCY — CONFIDENTIAL",
};

const PDF_STYLE_SETTING_KEY = "pdf_maker_default_style";

export function normalizePdfStyle(input?: Partial<PdfStyle> | null): PdfStyle {
  const theme = input?.theme === "light" ? "light" : "dark";
  return {
    accentColor: input?.accentColor?.trim() || DEFAULT_PDF_STYLE.accentColor,
    backgroundColor: input?.backgroundColor?.trim() || DEFAULT_PDF_STYLE.backgroundColor,
    textColor: input?.textColor?.trim() || DEFAULT_PDF_STYLE.textColor,
    theme,
    fontFamily: input?.fontFamily?.trim() || DEFAULT_PDF_STYLE.fontFamily,
    footerText: input?.footerText?.trim() || DEFAULT_PDF_STYLE.footerText,
  };
}

export async function getDefaultPdfStyle(): Promise<PdfStyle> {
  const stored = await getSystemSetting(PDF_STYLE_SETTING_KEY);
  if (stored != null && stored.trim() !== "") {
    try {
      const parsed = JSON.parse(stored) as Partial<PdfStyle>;
      return normalizePdfStyle(parsed);
    } catch {
      /* invalid JSON → fallback */
    }
  }
  return { ...DEFAULT_PDF_STYLE };
}

export async function setDefaultPdfStyle(style: PdfStyle): Promise<void> {
  const normalized = normalizePdfStyle(style);
  await setSystemSetting(
    PDF_STYLE_SETTING_KEY,
    JSON.stringify(normalized),
    "Default PDF Maker style JSON (colors, theme, footer).",
  );
}

export type PdfTemplate = {
  id: string;
  templateId: string;
  name: string;
  description: string;
  defaultSections: PdfSection[];
  config?: PdfTemplateConfig;
};

export type PdfDocument = {
  id: string;
  title: string;
  subtitle: string;
  template: string;
  sections: PdfSection[];
  metaFields: PdfMetaField[];
  style: PdfStyle;
  createdBy: string;
  fileUrl: string;
  createdAt: string;
};

type TemplateFields = {
  "Template ID"?: string;
  template_id?: string;
  Name?: string;
  name?: string;
  Description?: string;
  description?: string;
  "Default Sections"?: string;
  default_sections?: string;
  "Template Config"?: string;
  template_config?: string;
};

type DocumentFields = {
  Title?: string;
  title?: string;
  Subtitle?: string;
  subtitle?: string;
  Template?: string;
  template?: string;
  Sections?: string;
  sections?: string;
  "Meta Fields"?: string;
  meta_fields?: string;
  "Created By"?: string | string[];
  created_by?: string | string[];
  "File URL"?: string;
  file_url?: string;
  "Created At"?: string;
  created_at?: string;
  Style?: string;
  style?: string;
};

function fieldStr(f: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = f[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

const SECTION_STYLES = new Set<PdfSectionStyle>(["normal", "reference_link", "script_breakdown"]);

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

function mapTemplateRecord(rec: AirtableRecord<TemplateFields>): PdfTemplate {
  const f = (rec.fields ?? {}) as Record<string, unknown>;
  const defaultRaw = f["Default Sections"] ?? f.default_sections;
  const configRaw = f["Template Config"] ?? f.template_config;
  return {
    id: rec.id,
    templateId: fieldStr(f, "Template ID", "template_id"),
    name: fieldStr(f, "Name", "name") || "Untitled template",
    description: fieldStr(f, "Description", "description"),
    defaultSections: parseSectionsJson(defaultRaw),
    config: parseTemplateConfigJson(configRaw),
  };
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

function mapDocumentRecord(rec: AirtableRecord<DocumentFields>): PdfDocument {
  const f = (rec.fields ?? {}) as Record<string, unknown>;
  const sectionsRaw = f.Sections ?? f.sections;
  const metaRaw = f["Meta Fields"] ?? f.meta_fields;
  const styleRaw = f.Style ?? f.style;
  const createdBy = fieldStr(f, "Created By", "created_by");
  return {
    id: rec.id,
    title: fieldStr(f, "Title", "title") || "Untitled",
    subtitle: fieldStr(f, "Subtitle", "subtitle"),
    template: fieldStr(f, "Template", "template"),
    sections: parseSectionsJson(sectionsRaw),
    metaFields: parseMetaFieldsJson(metaRaw),
    style: parseStyleJson(styleRaw),
    createdBy,
    fileUrl: fieldStr(f, "File URL", "file_url"),
    createdAt: fieldStr(f, "Created At", "created_at"),
  };
}

export async function getPdfTemplates(): Promise<PdfTemplate[]> {
  if (isSupabaseBackend()) return (await import("./pdf-maker-supabase")).getPdfTemplates();
  const { records } = await listRecords<TemplateFields>(PDF_TEMPLATES_TABLE, {
    pageSize: 100,
    _caller: "getPdfTemplates",
  });
  return records.map(mapTemplateRecord).sort((a, b) => a.name.localeCompare(b.name));
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
  if (isSupabaseBackend()) return (await import("./pdf-maker-supabase")).createPdfDocument(input);
  const style = normalizePdfStyle(input.style);
  const metaFields = parseMetaFieldsJson(input.metaFields ?? []);
  const fields: Record<string, unknown> = {
    Title: input.title.trim(),
    Subtitle: input.subtitle?.trim() ?? "",
    Template: input.template?.trim() ?? "",
    Sections: JSON.stringify(input.sections),
    "Meta Fields": JSON.stringify(metaFields),
    Style: JSON.stringify(style),
    "File URL": input.fileUrl.trim(),
    "Created At": new Date().toISOString(),
    // "Created By" is a singleLineText field in Airtable — must be a plain string, not a linked-record array.
    "Created By": String(input.createdBy || "Unknown"),
  };

  const rec = await createRecord<DocumentFields>(PDF_DOCUMENTS_TABLE, fields);
  return mapDocumentRecord(rec);
}

export async function getPdfHistory(limit = 20): Promise<PdfDocument[]> {
  if (isSupabaseBackend()) return (await import("./pdf-maker-supabase")).getPdfHistory(limit);
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100);
  const { records } = await listRecords<DocumentFields>(PDF_DOCUMENTS_TABLE, {
    pageSize: safeLimit,
    sort: [{ field: "Created At", direction: "desc" }],
    _caller: "getPdfHistory",
  });
  return records.map(mapDocumentRecord);
}

export async function deletePdfDocument(recordId: string): Promise<void> {
  if (isSupabaseBackend()) return (await import("./pdf-maker-supabase")).deletePdfDocument(recordId);
  const id = recordId.trim();
  if (!id) throw new Error("Missing record id");
  await deleteRecord(PDF_DOCUMENTS_TABLE, id);
}
