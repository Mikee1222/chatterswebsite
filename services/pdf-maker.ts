import {
  createRecord,
  deleteRecord,
  listRecords,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { firstLinkedId, toLinkedRecordPayload } from "@/lib/airtable-linked";

export const PDF_DOCUMENTS_TABLE = "pdf_documents";
export const PDF_TEMPLATES_TABLE = "pdf_templates";

export type PdfSection = {
  title?: string;
  content: string;
};

export type PdfTemplate = {
  id: string;
  templateId: string;
  name: string;
  description: string;
  defaultSections: PdfSection[];
};

export type PdfDocument = {
  id: string;
  title: string;
  subtitle: string;
  template: string;
  sections: PdfSection[];
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
  "Created By"?: string | string[];
  created_by?: string | string[];
  "File URL"?: string;
  file_url?: string;
  "Created At"?: string;
  created_at?: string;
};

function fieldStr(f: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = f[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

function parseSectionsJson(raw: unknown): PdfSection[] {
  if (raw == null || raw === "") return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => {
      if (!item || typeof item !== "object") {
        return { content: String(item ?? "") };
      }
      const row = item as Record<string, unknown>;
      const title = typeof row.title === "string" ? row.title : undefined;
      const content = typeof row.content === "string" ? row.content : String(row.content ?? "");
      return { title, content };
    });
  } catch {
    return [];
  }
}

function mapTemplateRecord(rec: AirtableRecord<TemplateFields>): PdfTemplate {
  const f = (rec.fields ?? {}) as Record<string, unknown>;
  const defaultRaw = f["Default Sections"] ?? f.default_sections;
  return {
    id: rec.id,
    templateId: fieldStr(f, "Template ID", "template_id"),
    name: fieldStr(f, "Name", "name") || "Untitled template",
    description: fieldStr(f, "Description", "description"),
    defaultSections: parseSectionsJson(defaultRaw),
  };
}

function mapDocumentRecord(rec: AirtableRecord<DocumentFields>): PdfDocument {
  const f = (rec.fields ?? {}) as Record<string, unknown>;
  const sectionsRaw = f.Sections ?? f.sections;
  const createdBy =
    firstLinkedId(f["Created By"] ?? f.created_by) ??
    fieldStr(f, "Created By", "created_by");
  return {
    id: rec.id,
    title: fieldStr(f, "Title", "title") || "Untitled",
    subtitle: fieldStr(f, "Subtitle", "subtitle"),
    template: fieldStr(f, "Template", "template"),
    sections: parseSectionsJson(sectionsRaw),
    createdBy,
    fileUrl: fieldStr(f, "File URL", "file_url"),
    createdAt: fieldStr(f, "Created At", "created_at"),
  };
}

export async function getPdfTemplates(): Promise<PdfTemplate[]> {
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
  template?: string;
  createdBy?: string;
  fileUrl: string;
}): Promise<PdfDocument> {
  const fields: Record<string, unknown> = {
    Title: input.title.trim(),
    Subtitle: input.subtitle?.trim() ?? "",
    Template: input.template?.trim() ?? "",
    Sections: JSON.stringify(input.sections),
    "File URL": input.fileUrl.trim(),
    "Created At": new Date().toISOString(),
  };
  const creatorLink = toLinkedRecordPayload(input.createdBy?.trim() ?? null);
  if (creatorLink) fields["Created By"] = creatorLink;

  const rec = await createRecord<DocumentFields>(PDF_DOCUMENTS_TABLE, fields);
  return mapDocumentRecord(rec);
}

export async function getPdfHistory(limit = 20): Promise<PdfDocument[]> {
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100);
  const { records } = await listRecords<DocumentFields>(PDF_DOCUMENTS_TABLE, {
    pageSize: safeLimit,
    sort: [{ field: "Created At", direction: "desc" }],
    _caller: "getPdfHistory",
  });
  return records.map(mapDocumentRecord);
}

export async function deletePdfDocument(recordId: string): Promise<void> {
  const id = recordId.trim();
  if (!id) throw new Error("Missing record id");
  await deleteRecord(PDF_DOCUMENTS_TABLE, id);
}
