import { loadE2EEnv } from "./load-env";

export type E2ERole = "admin" | "chatter" | "virtual_assistant" | "model";

export type RoleCredentials = {
  role: E2ERole;
  email: string;
  password: string;
};

const ROLE_ENV: Record<E2ERole, { email: string; password: string; label: string }> = {
  admin: { email: "E2E_ADMIN_EMAIL", password: "E2E_ADMIN_PASSWORD", label: "admin" },
  chatter: { email: "E2E_CHATTER_EMAIL", password: "E2E_CHATTER_PASSWORD", label: "chatter" },
  virtual_assistant: { email: "E2E_VA_EMAIL", password: "E2E_VA_PASSWORD", label: "virtual_assistant" },
  model: { email: "E2E_MODEL_EMAIL", password: "E2E_MODEL_PASSWORD", label: "model" },
};

export function getRoleCredentials(role: E2ERole): RoleCredentials {
  loadE2EEnv();
  const keys = ROLE_ENV[role];
  const email = process.env[keys.email]?.trim();
  const password = process.env[keys.password]?.trim();
  if (!email || !password) {
    throw new Error(
      `Missing credentials for role "${role}". Set ${keys.email} and ${keys.password} in .env.e2e (see .env.e2e.example).`
    );
  }
  return { role, email, password };
}

export function tryGetRoleCredentials(role: E2ERole): RoleCredentials | null {
  try {
    return getRoleCredentials(role);
  } catch {
    return null;
  }
}

export function requireAnyRoleCredentials(roles: E2ERole[]): RoleCredentials[] {
  const missing: string[] = [];
  const found: RoleCredentials[] = [];
  for (const role of roles) {
    const creds = tryGetRoleCredentials(role);
    if (creds) found.push(creds);
    else missing.push(role);
  }
  if (found.length === 0) {
    throw new Error(
      `No E2E credentials found for roles: ${roles.join(", ")}. Copy .env.e2e.example → .env.e2e and fill values.`
    );
  }
  if (missing.length) {
    console.warn(`[e2e] Skipping roles with missing credentials: ${missing.join(", ")}`);
  }
  return found;
}
