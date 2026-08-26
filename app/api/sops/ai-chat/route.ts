import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getAllSopDepartments, getAllSopRoles, getFunctionsByRole } from "@/services/sops";
import { answerSopLibraryQuestion, type SopChatChunk } from "@/services/ai-powered-features";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_CHUNK_CHARS = 2500;
const MAX_CHUNKS = 40;

async function buildSopChunks(): Promise<SopChatChunk[]> {
  const [roles, departments] = await Promise.all([
    getAllSopRoles().catch(() => []),
    getAllSopDepartments().catch(() => []),
  ]);
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const chunks: SopChatChunk[] = [];

  for (const role of roles.filter((r) => r.is_active !== false)) {
    const functions = await getFunctionsByRole(role.id).catch(() => []);
    for (const fn of functions) {
      if (!fn.is_active) continue;
      const content = (fn.sop_content ?? "").trim();
      if (!content) continue;
      chunks.push({
        function_name: fn.name,
        role_name: role.name,
        department_name: deptName.get(fn.department_id || role.department_id) ?? "—",
        content: content.slice(0, MAX_CHUNK_CHARS),
      });
      if (chunks.length >= MAX_CHUNKS) return chunks;
    }
  }
  return chunks;
}

/**
 * POST /api/sops/ai-chat — SOP Library Q&A grounded in published sop_content.
 */
export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.SOPS_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    question?: string;
    history?: { role: "user" | "assistant"; content: string }[];
  };
  const question = String(body.question ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }
  if (question.length > 2000) {
    return NextResponse.json({ error: "question too long" }, { status: 400 });
  }

  try {
    const chunks = await buildSopChunks();
    const history = Array.isArray(body.history)
      ? body.history
          .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 2000) }))
          .filter((m) => m.content)
          .slice(-6)
      : [];
    const answer = await answerSopLibraryQuestion({ question, chunks, history });
    return NextResponse.json({ answer });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "SOP chat failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
