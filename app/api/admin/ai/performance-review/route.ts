import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { isAdminAreaUser } from "@/lib/rbac";
import { generatePerformanceReview } from "@/services/ai-ops-features";
import { buildPerformanceReviewPdfBytes } from "@/lib/ai-performance-review-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminAreaUser(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    personId?: string;
    personName?: string;
    role?: "chatter" | "virtual_assistant";
    force?: boolean;
    format?: "json" | "pdf";
  };

  const personId = (body.personId ?? "").trim();
  const personName = (body.personName ?? "").trim() || personId;
  const role = body.role === "virtual_assistant" ? "virtual_assistant" : "chatter";
  if (!personId) {
    return NextResponse.json({ error: "personId required" }, { status: 400 });
  }

  try {
    const review = await generatePerformanceReview({
      personId,
      personName,
      role,
      force: Boolean(body.force),
    });

    if (body.format === "pdf") {
      const { bytes, filename } = await buildPerformanceReviewPdfBytes(review);
      return new NextResponse(Buffer.from(bytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json(review);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Performance review failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
