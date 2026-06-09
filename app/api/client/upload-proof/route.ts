import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "client") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const form = await req.formData();
  const file = form.get("file") as File;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  const allowed = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "image/gif",
    "application/pdf",
  ];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "File upload not configured" }, { status: 503 });
  }

  const clientId = session.airtableUserId ?? session.id;
  const filename = `proofs/${clientId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
  const blob = await put(filename, file, {
    access: "public",
    addRandomSuffix: false,
  });
  return NextResponse.json({ url: blob.url });
}
