"use server";

import { loadEnvConfig } from "@next/env";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  AUTH_COOKIE_NAME,
  SESSION_EPHEMERAL_JWT_MAX_AGE_SEC,
  SESSION_REMEMBER_MAX_AGE_SEC,
} from "@/lib/auth-config";
import { ROUTES } from "@/lib/routes";

/** Next.js redirect() throws; re-throw so redirect is not swallowed. */
function isRedirectError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}
import { setSession, getSessionFromCookies, deleteSession, hashPassword, verifyPassword } from "@/lib/auth";
import { getUserByEmailForAuth } from "@/services/users";

loadEnvConfig(process.cwd());

function getDemoCredentials(): { email: string; password: string; role: "admin" | "manager" | "chatter" | "virtual_assistant" } {
  const envEmail = process.env.DEMO_LOGIN_EMAIL?.trim()?.toLowerCase();
  const envPassword = process.env.DEMO_LOGIN_PASSWORD?.trim();
  const email = envEmail ?? "admin@example.com";
  const password = envPassword ?? "demo123";
  const role = (process.env.DEMO_LOGIN_ROLE?.trim() ?? "admin") as "admin" | "manager" | "chatter" | "virtual_assistant";
  return { email, password, role };
}

export async function login(formData: FormData) {
  const submittedEmail = (formData.get("email") as string)?.trim().toLowerCase() ?? "";
  const submittedPassword = (formData.get("password") as string)?.trim() ?? "";
  const logPrefix = "[auth.login]";
  const obfuscatedEmail = submittedEmail ? `${submittedEmail.slice(0, 2)}***@***` : "(empty)";

  if (!submittedEmail || !submittedPassword) {
    console.log(`${logPrefix} missing credentials`, {
      emailPresent: !!submittedEmail,
      passwordPresent: !!submittedPassword,
    });
    redirect(`${ROUTES.login}?error=${encodeURIComponent("Email and password are required")}`);
  }

  const rememberMe = formData.get("remember_me") === "on" || formData.get("remember_me") === "true";
  const jwtMaxAgeSec = rememberMe ? SESSION_REMEMBER_MAX_AGE_SEC : SESSION_EPHEMERAL_JWT_MAX_AGE_SEC;
  console.log(`${logPrefix} attempt`, {
    email: obfuscatedEmail,
    rememberMe,
  });

  // 1. Try Airtable user (hashed password)
  try {
    const user = await getUserByEmailForAuth(submittedEmail);
    console.log(`${logPrefix} airtable lookup`, {
      email: obfuscatedEmail,
      userFound: !!user,
      canLogin: !!user?.can_login,
      hasPasswordHash: !!user?.password_hash,
      role: user?.role ?? null,
      hashType: user?.password_hash?.startsWith("$2") ? "bcrypt" : user?.password_hash?.includes(":") ? "scrypt" : "unknown",
    });
    if (user?.can_login && user.password_hash) {
      const valid = await verifyPassword(submittedPassword, user.password_hash);
      console.log(`${logPrefix} password verify`, {
        email: obfuscatedEmail,
        valid,
      });
      if (valid) {
        const hasPair =
          user.secondary_role &&
          (user.role === "chatter" || user.role === "virtual_assistant");
        const token = await setSession(
          {
            id: user.id,
            email: user.email,
            role: user.role,
            airtableUserId: user.id,
            fullName: user.full_name,
            ...(user.secondary_role ? { secondary_role: user.secondary_role } : {}),
            ...(hasPair && (user.role === "chatter" || user.role === "virtual_assistant")
              ? { active_role: user.role }
              : {}),
          },
          jwtMaxAgeSec
        );
        const cookieStore = await cookies();
        cookieStore.set(AUTH_COOKIE_NAME, token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          // Remember me: persistent cookie (30 days). Unchecked: session cookie (no maxAge → cleared when browser closes).
          ...(rememberMe ? { maxAge: SESSION_REMEMBER_MAX_AGE_SEC } : {}),
        });
        console.log(`${logPrefix} login success (airtable)`, { email: obfuscatedEmail, role: user.role });
        redirect(ROUTES.dashboard);
      }
    }
  } catch (err) {
    if (isRedirectError(err)) throw err;
    console.error(`${logPrefix} airtable auth error`, {
      email: obfuscatedEmail,
      error: err instanceof Error ? err.message : String(err),
    });
    // Airtable not configured or error; fall back to demo
  }

  // 2. Demo fallback (env vars)
  const { email: demoEmail, password: demoPassword, role: demoRole } = getDemoCredentials();
  if (submittedEmail === demoEmail && submittedPassword === demoPassword) {
    const token = await setSession(
      {
        id: "demo-user",
        email: demoEmail,
        role: demoRole,
        airtableUserId: null,
        fullName: "Demo User",
      },
      jwtMaxAgeSec
    );
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      ...(rememberMe ? { maxAge: SESSION_REMEMBER_MAX_AGE_SEC } : {}),
    });
    console.log(`${logPrefix} login success (demo fallback)`, { email: obfuscatedEmail, role: demoRole });
    redirect(ROUTES.dashboard);
  }

  console.log(`${logPrefix} invalid credentials`, { email: obfuscatedEmail });
  redirect(`${ROUTES.login}?error=${encodeURIComponent("Invalid email or password")}`);
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
  redirect(ROUTES.login);
}

export async function getCurrentUser() {
  return getSessionFromCookies();
}
