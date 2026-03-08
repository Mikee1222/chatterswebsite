"use server";

import { loadEnvConfig } from "@next/env";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME } from "@/lib/auth-config";
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

  if (!submittedEmail || !submittedPassword) {
    redirect(`${ROUTES.login}?error=${encodeURIComponent("Email and password are required")}`);
  }

  // 1. Try Airtable user (hashed password)
  try {
    const user = await getUserByEmailForAuth(submittedEmail);
    if (user?.can_login && user.password_hash) {
      const valid = await verifyPassword(submittedPassword, user.password_hash);
      if (valid) {
        const token = await setSession({
          id: user.id,
          email: user.email,
          role: user.role,
          airtableUserId: user.id,
          fullName: user.full_name,
        });
        const rememberMe = formData.get("remember_me") === "on" || formData.get("remember_me") === "true";
        const cookieStore = await cookies();
        cookieStore.set(AUTH_COOKIE_NAME, token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          ...(rememberMe && { maxAge: 60 * 60 * 24 * 30 }),
        });
        redirect(ROUTES.dashboard);
      }
    }
  } catch (err) {
    if (isRedirectError(err)) throw err;
    // Airtable not configured or error; fall back to demo
  }

  // 2. Demo fallback (env vars)
  const { email: demoEmail, password: demoPassword, role: demoRole } = getDemoCredentials();
  if (submittedEmail === demoEmail && submittedPassword === demoPassword) {
    const token = await setSession({
      id: "demo-user",
      email: demoEmail,
      role: demoRole,
      airtableUserId: null,
      fullName: "Demo User",
    });
    const rememberMe = formData.get("remember_me") === "on" || formData.get("remember_me") === "true";
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      ...(rememberMe && { maxAge: 60 * 60 * 24 * 30 }),
    });
    redirect(ROUTES.dashboard);
  }

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
