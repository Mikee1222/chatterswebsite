import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { buildPdfBytes, safePdfFilename } from "@/lib/pdf-maker-build";
import { createPdfDocument } from "@/services/pdf-maker";

const requestSchema = z.object({
  title: z.string().min(1).max(500),
  subtitle: z.string().max(500).optional(),
  templateId: z.string().max(200).optional(),
  sections: z
    .array(
      z.object({
        title: z.string().max(500).optional(),
        content: z.string().max(50000),
      }),
    )
    .max(50),
});

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

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "File upload not configured" }, { status: 503 });
  }

  const { title, subtitle, sections, templateId } = parsed.data;

  try {
    const pdfBytes = await buildPdfBytes(title, subtitle, sections);
    const filename = `pdf-maker/${Date.now()}-${safePdfFilename(title)}`;
    const blob = await put(filename, Buffer.from(pdfBytes), {
      access: "public",
      contentType: "application/pdf",
      addRandomSuffix: false,
    });

    const createdBy = (session.fullName?.trim() || session.email?.trim() || "Unknown");
    const record = await createPdfDocument({
      title,
      subtitle,
      sections,
      template: templateId,
      createdBy,
      fileUrl: blob.url,
    });

    return NextResponse.json({
      downloadUrl: blob.url,
      recordId: record.id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/pdf-maker]", e);
    return NextResponse.json({ error: msg || "Failed to generate PDF" }, { status: 500 });
  }
}
