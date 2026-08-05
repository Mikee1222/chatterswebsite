import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { isSupabaseBackend } from "@/lib/data-backend";
import { SOP_FILES_BUCKET } from "@/lib/direct-storage-upload";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { buildPdfBytes, safePdfFilename } from "@/lib/pdf-maker-build";
import { uploadToPrivateStorage, resolveStorageUrl } from "@/lib/supabase-signed-url";
import { createPdfDocument, getDefaultPdfStyle, normalizePdfStyle } from "@/services/pdf-maker";

const styleSchema = z.object({
  accentColor: z.string().max(20).optional(),
  backgroundColor: z.string().max(20).optional(),
  textColor: z.string().max(20).optional(),
  theme: z.enum(["dark", "light"]).optional(),
  fontFamily: z.string().max(50).optional(),
  footerText: z.string().max(500).optional(),
});

const metaFieldSchema = z.object({
  label: z.string().max(200),
  value: z.string().max(500),
});

const requestSchema = z.object({
  title: z.string().min(1).max(500),
  subtitle: z.string().max(500).optional(),
  templateId: z.string().max(200).optional(),
  style: styleSchema.optional(),
  metaFields: z.array(metaFieldSchema).max(3).optional(),
  sections: z
    .array(
      z.object({
        title: z.string().max(500).optional(),
        content: z.string().max(50000),
        sectionStyle: z.enum(["normal", "reference_link", "script_breakdown"]).optional(),
      }),
    )
    .max(50),
});

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.PDF_MAKER_MANAGE))) {
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

  if (!isSupabaseBackend() && !process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "File upload not configured" }, { status: 503 });
  }

  const { title, subtitle, sections, templateId, style: styleInput, metaFields } = parsed.data;
  const style = styleInput ? normalizePdfStyle(styleInput) : await getDefaultPdfStyle();

  try {
    const pdfBytes = await buildPdfBytes(title, subtitle, sections, style, metaFields ?? []);
    const safeName = safePdfFilename(title);
    let fileUrl: string;

    if (isSupabaseBackend()) {
      fileUrl = await uploadToPrivateStorage({
        bucket: SOP_FILES_BUCKET,
        objectPath: `pdf-maker/${Date.now()}_${safeName}`,
        bytes: new Uint8Array(pdfBytes),
        contentType: "application/pdf",
      });
    } else {
      const filename = `pdf-maker/${Date.now()}-${safeName}`;
      const blob = await put(filename, Buffer.from(pdfBytes), {
        access: "public",
        contentType: "application/pdf",
        addRandomSuffix: false,
      });
      fileUrl = blob.url;
    }

    const createdBy = (session.fullName?.trim() || session.email?.trim() || "Unknown");
    const record = await createPdfDocument({
      title,
      subtitle,
      sections,
      metaFields: metaFields ?? [],
      template: templateId,
      style,
      createdBy,
      fileUrl,
    });

    const downloadUrl = isSupabaseBackend() ? await resolveStorageUrl(fileUrl) : fileUrl;

    return NextResponse.json({
      downloadUrl,
      recordId: record.id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/pdf-maker]", e);
    return NextResponse.json({ error: msg || "Failed to generate PDF" }, { status: 500 });
  }
}
