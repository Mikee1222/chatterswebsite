import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth";
import { getUserByEmailForAuth } from "@/services/users";

export const runtime = "nodejs";

type DebugAuthBody = {
  email?: string;
  password?: string;
};

function detectHashType(hash: string | undefined): "bcrypt" | "scrypt" | "unknown" | null {
  if (!hash) return null;
  if (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$")) return "bcrypt";
  if (hash.includes(":")) return "scrypt";
  return "unknown";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as DebugAuthBody;
    const submittedEmail = (body.email ?? "").trim().toLowerCase();
    const submittedPassword = (body.password ?? "").trim();

    if (!submittedEmail || !submittedPassword) {
      return NextResponse.json(
        {
          userFound: false,
          hasPassword: false,
          hashType: null,
          passwordMatch: false,
          error: "Email and password are required",
        },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    let userFound = false;
    let hasPassword = false;
    let hashType: "bcrypt" | "scrypt" | "unknown" | null = null;
    let passwordMatch = false;
    let error: string | null = null;

    try {
      const user = await getUserByEmailForAuth(submittedEmail);
      userFound = !!user;
      hasPassword = !!user?.password_hash;
      hashType = detectHashType(user?.password_hash);

      if (user?.can_login && user.password_hash) {
        passwordMatch = await verifyPassword(submittedPassword, user.password_hash);
      } else if (user && !user.can_login) {
        error = "User found but can_login is false";
      } else if (user && !user.password_hash) {
        error = "User found but password_hash is empty";
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    return NextResponse.json(
      {
        userFound,
        hasPassword,
        hashType,
        passwordMatch,
        error,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      {
        userFound: false,
        hasPassword: false,
        hashType: null,
        passwordMatch: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
