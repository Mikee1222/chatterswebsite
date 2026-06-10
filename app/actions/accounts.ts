"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ROUTES } from "@/lib/routes";
import { getSessionFromCookies, hashPassword } from "@/lib/auth";
import { forceDeleteUser } from "@/services/force-delete-cascade";

/** Next.js redirect() throws; re-throw so redirect is not treated as a normal error. */
function isRedirectError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}
import {
  createUser,
  updateUser,
  setPasswordHash,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/services/users";
import type { VaType } from "@/types";
import { devLog } from "@/lib/dev-log";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import { getRoles } from "@/services/roles";

async function requireAccountsPermission(permission: Permission) {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (!(await hasPermission(user, permission))) redirect(ROUTES.dashboard);
  return user;
}

const VA_TYPES: VaType[] = ["chatting", "marketing", "both"];

async function resolveValidRoleId(raw: string): Promise<string | null> {
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  const roles = await getRoles();
  const match = roles.find((r) => r.role_id.trim().toLowerCase() === key);
  return match?.role_id ?? null;
}

function parseVaType(raw: string): VaType | null {
  const v = raw.trim().toLowerCase();
  return VA_TYPES.includes(v as VaType) ? (v as VaType) : null;
}

export async function createAccount(formData: FormData) {
  await requireAccountsPermission(PERMISSIONS.ACCOUNTS_CREATE);
  const full_name = (formData.get("full_name") as string)?.trim() ?? "";
  const email = (formData.get("email") as string)?.trim()?.toLowerCase() ?? "";
  const roleRaw = (formData.get("role") as string)?.trim() ?? "chatter";
  const role = await resolveValidRoleId(roleRaw);
  const password = (formData.get("password") as string)?.trim() ?? "";
  const can_login = formData.get("can_login") === "on" || formData.get("can_login") === "true";
  const notes = (formData.get("notes") as string)?.trim() ?? "";
  const linked_model_id = (formData.get("linked_model_id") as string)?.trim() || undefined;
  const language_preference = (formData.get("language_preference") as string)?.trim() || undefined;
  const telegram_username = (formData.get("telegram_username") as string)?.trim() || undefined;
  const va_type_raw = (formData.get("va_type") as string)?.trim() ?? "";

  if (!full_name || !email) {
    redirect(ROUTES.accounts + "?error=" + encodeURIComponent("Name and email are required"));
  }
  if (!role) {
    redirect(ROUTES.accounts + "?error=" + encodeURIComponent("Invalid role selected."));
  }

  const input: CreateUserInput = {
    full_name,
    email,
    role: role as CreateUserInput["role"],
    status: "active",
    can_login,
    notes,
  };
  if (password) {
    input.password_hash = await hashPassword(password);
  }
  if (role === "model" && linked_model_id) input.linked_model_id = linked_model_id;
  if (role === "model" && language_preference) input.language_preference = language_preference;
  if (telegram_username) input.telegram_username = telegram_username;
  if (role === "virtual_assistant") {
    const vaType = parseVaType(va_type_raw);
    if (!vaType) {
      redirect(ROUTES.accounts + "?error=" + encodeURIComponent("VA type is required for virtual assistant accounts."));
    }
    input.va_type = vaType;
  }
  try {
    await createUser(input);
    redirect(ROUTES.accounts + "?success=created");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    console.error("[createAccount] error", err);
    redirect(ROUTES.accounts + "?error=" + encodeURIComponent(message || "Failed to create account"));
  }
}

export async function updateAccount(formData: FormData) {
  await requireAccountsPermission(PERMISSIONS.ACCOUNTS_EDIT);
  const recordId = (formData.get("recordId") as string)?.trim();
  if (!recordId) redirect(ROUTES.accounts + "?error=missing_record");

  const full_name = (formData.get("full_name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim()?.toLowerCase();
  const roleRaw = formData.get("role") as string | null;
  const role = roleRaw != null ? await resolveValidRoleId(roleRaw) : null;
  const secondary_role_raw = (formData.get("secondary_role") as string)?.trim() ?? "";
  const va_type_raw = (formData.get("va_type") as string)?.trim() ?? "";
  const status = (formData.get("status") as string)?.trim();
  const can_login = formData.get("can_login") === "on" || formData.get("can_login") === "true";
  const notes = (formData.get("notes") as string)?.trim();
  const linked_model_id = (formData.get("linked_model_id") as string)?.trim() || null;
  const language_preference = (formData.get("language_preference") as string)?.trim() || undefined;
  const telegram_username_raw = formData.get("telegram_username");
  const telegram_username =
    telegram_username_raw === null
      ? undefined
      : (telegram_username_raw as string).trim().replace(/^@/, "") || null;

  const input: UpdateUserInput = {};
  if (full_name !== undefined) input.full_name = full_name;
  if (email !== undefined) input.email = email;
  if (roleRaw != null) {
    if (!role) {
      redirect(ROUTES.accounts + "?error=" + encodeURIComponent("Invalid role selected."));
    }
    input.role = role as UpdateUserInput["role"];
  }
  if (status !== undefined) input.status = status;
  input.can_login = can_login;
  if (notes !== undefined) input.notes = notes;
  if (role === "model") {
    input.linked_model_id = linked_model_id;
    input.language_preference = language_preference ?? undefined;
  } else {
    input.linked_model_id = null;
  }
  if (role === "chatter" || role === "virtual_assistant") {
    if (secondary_role_raw === "chatter" || secondary_role_raw === "virtual_assistant") {
      if (secondary_role_raw === role) {
        redirect(
          ROUTES.accounts +
            "?error=" +
            encodeURIComponent("Secondary role must be different from primary role.")
        );
      }
      input.secondary_role = secondary_role_raw;
    } else {
      input.secondary_role = null;
    }
  } else {
    input.secondary_role = null;
  }
  const isVaAccount =
    role === "virtual_assistant" || secondary_role_raw === "virtual_assistant";
  if (isVaAccount) {
    const vaType = parseVaType(va_type_raw);
    if (!vaType) {
      redirect(
        ROUTES.accounts +
          "?error=" +
          encodeURIComponent("VA type is required when the account has a virtual assistant role.")
      );
    }
    input.va_type = vaType;
  } else {
    input.va_type = null;
  }
  if (telegram_username !== undefined) input.telegram_username = telegram_username;
  try {
    await updateUser(recordId, input);
    redirect(ROUTES.accounts + "?success=updated");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    console.error("[updateAccount] error", err);
    redirect(ROUTES.accounts + "?error=" + encodeURIComponent(message || "Failed to update account"));
  }
}

export async function setAccountPassword(formData: FormData) {
  await requireAccountsPermission(PERMISSIONS.ACCOUNTS_RESET_PASSWORD);
  const recordId = (formData.get("recordId") as string)?.trim();
  if (!recordId) redirect(ROUTES.accounts + "?error=missing_record");
  const password = (formData.get("password") as string)?.trim() ?? "";
  if (!password || password.length < 8) {
    redirect(ROUTES.accounts + "?error=" + encodeURIComponent("Password must be at least 8 characters"));
  }
  const hash = await hashPassword(password);
  try {
    await setPasswordHash(recordId, hash);
    redirect(ROUTES.accounts + "?success=password_reset");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    console.error("[setAccountPassword] error", err);
    redirect(ROUTES.accounts + "?error=" + encodeURIComponent(message || "Failed to set password"));
  }
}

export async function toggleCanLogin(formData: FormData) {
  await requireAccountsPermission(PERMISSIONS.ACCOUNTS_EDIT);
  const recordId = (formData.get("recordId") as string)?.trim();
  const canLogin = formData.get("can_login") === "true";
  if (!recordId) redirect(ROUTES.accounts + "?error=missing_record");
  try {
    await updateUser(recordId, { can_login: canLogin });
    redirect(ROUTES.accounts + "?success=updated");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    console.error("[toggleCanLogin] error", err);
    redirect(ROUTES.accounts + "?error=" + encodeURIComponent(message || "Failed to update"));
  }
}

export async function deleteUserAction(recordId: string) {
  await requireAccountsPermission(PERMISSIONS.ACCOUNTS_DELETE);
  const id = recordId?.trim();
  if (!id) {
    redirect(ROUTES.accounts + "?error=" + encodeURIComponent("Missing user record"));
    return;
  }
  try {
    devLog("[delete-user]", { userId: id, step: "forceDeleteUser" });
    await forceDeleteUser(id);
    revalidatePath(ROUTES.accounts);
    redirect(ROUTES.accounts + "?success=user_deleted");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    console.error("[deleteUserAction] error", err);
    redirect(ROUTES.accounts + "?error=" + encodeURIComponent(message || "Failed to delete user"));
  }
}
