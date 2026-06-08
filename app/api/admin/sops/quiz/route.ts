import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import {
  createQuizQuestion,
  getQuestionsByFunctionAdmin,
} from "@/services/sop-quiz";

function isStaffAdmin(session: { role: string } | null): boolean {
  return session != null && (session.role === "admin" || session.role === "manager");
}

const postSchema = z.object({
  sop_function_id: z.string().trim().min(1),
  question: z.string().trim().min(1).max(2000),
  option_a: z.string().trim().min(1).max(500),
  option_b: z.string().trim().min(1).max(500),
  option_c: z.string().trim().min(1).max(500),
  option_d: z.string().trim().min(1).max(500),
  correct_option: z.enum(["a", "b", "c", "d"]),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
});

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!isStaffAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const functionId = new URL(req.url).searchParams.get("function_id")?.trim() ?? "";
  if (!functionId) {
    return NextResponse.json({ error: "function_id required" }, { status: 400 });
  }

  try {
    const questions = await getQuestionsByFunctionAdmin(functionId);
    return NextResponse.json({ questions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!isStaffAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const question = await createQuizQuestion(parsed.data);
    return NextResponse.json({ success: true, question });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
