"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ROUTES } from "@/lib/routes";
import { getSessionFromCookies, hashPassword } from "@/lib/auth";
import { getDeleteBlockReasonsForUser } from "@/services/accounts-delete";
import { deleteRecord, listAllRecords } from "@/lib/airtable-server";
import { getPreferencesByUserId } from "@/services/notification-preferences";
import { getActiveSubscriptionsForUser } from "@/services/push-subscriptions";

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

async function requireAdmin() {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "admin") redirect(ROUTES.dashboard);
  return user;
}

export async function createAccount(formData: FormData) {
  await requireAdmin();
  const full_name = (formData.get("full_name") as string)?.trim() ?? "";
  const email = (formData.get("email") as string)?.trim()?.toLowerCase() ?? "";
  const role = (formData.get("role") as CreateUserInput["role"]) ?? "chatter";
  const password = (formData.get("password") as string)?.trim() ?? "";
  const can_login = formData.get("can_login") === "on" || formData.get("can_login") === "true";
  const notes = (formData.get("notes") as string)?.trim() ?? "";

  if (!full_name || !email) {
    redirect(ROUTES.accounts + "?error=" + encodeURIComponent("Name and email are required"));
  }

  const input: CreateUserInput = {
    full_name,
    email,
    role,
    status: "active",
    can_login,
    notes,
  };
  if (password) {
    input.password_hash = await hashPassword(password);
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
  await requireAdmin();
  const recordId = (formData.get("recordId") as string)?.trim();
  if (!recordId) redirect(ROUTES.accounts + "?error=missing_record");

  const full_name = (formData.get("full_name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim()?.toLowerCase();
  const role = formData.get("role") as UpdateUserInput["role"] | null;
  const status = (formData.get("status") as string)?.trim();
  const can_login = formData.get("can_login") === "on" || formData.get("can_login") === "true";
  const notes = (formData.get("notes") as string)?.trim();

  const input: UpdateUserInput = {};
  if (full_name !== undefined) input.full_name = full_name;
  if (email !== undefined) input.email = email;
  if (role !== undefined && role !== null) input.role = role;
  if (status !== undefined) input.status = status;
  input.can_login = can_login;
  if (notes !== undefined) input.notes = notes;
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
  await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();
  const id = recordId?.trim();
  if (!id) {
    redirect(ROUTES.accounts + "?error=" + encodeURIComponent("Missing user record"));
    return;
  }
  try {
    const check = await getDeleteBlockReasonsForUser(id);
    if (!check.canDelete) {
      redirect(ROUTES.accounts + "?error=" + encodeURIComponent(check.summary));
      return;
    }
    const escaped = id.replace(/"/g, '""');
    const userFormula = `{user_id} = "${escaped}"`;
    const notifRecs = await listAllRecords<{ id: string }>("notifications", { filterByFormula: userFormula });
    await Promise.all(notifRecs.map((r) => deleteRecord("notifications", r.id)));
    const pref = await getPreferencesByUserId(id);
    if (pref) await deleteRecord("notification_preferences", pref.id);
    const subs = await getActiveSubscriptionsForUser(id);
    await Promise.all(subs.map((s) => deleteRecord("push_subscriptions", s.id)));
    await deleteRecord("users", id);
    revalidatePath(ROUTES.accounts);
    redirect(ROUTES.accounts + "?success=user_deleted");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    console.error("[deleteUserAction] error", err);
    redirect(ROUTES.accounts + "?error=" + encodeURIComponent(message || "Failed to delete user"));
  }
}
