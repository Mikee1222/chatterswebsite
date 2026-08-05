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
  uploadUserContractAttachments,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/services/users";
import { createDefaultPreferencesForUser } from "@/services/notification-preferences";
import type { VaType, CompensationType, UserContractAttachment } from "@/types";
import { devLog } from "@/lib/dev-log";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import { getRoles } from "@/services/roles";
import { isSupabaseBackend } from "@/lib/data-backend";
import { isAllowedDirectUploadToken } from "@/lib/direct-storage-upload";

async function requireAccountsPermission(permission: Permission) {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (!(await hasPermission(user, permission))) redirect(ROUTES.dashboard);
  return user;
}

const VA_TYPES: VaType[] = ["chatting", "marketing", "both"];

const ACCOUNTS_LIST = ROUTES.admin.accounts;

function revalidateAccountsPaths() {
  revalidatePath(ROUTES.accounts);
  revalidatePath(ROUTES.admin.accounts);
}

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

function parseCompensationType(raw: string): CompensationType | null {
  const s = raw.trim();
  if (s === "Percentage" || s === "Flat Fee") return s;
  return null;
}

function parseKeptContractAttachments(raw: string): UserContractAttachment[] {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is UserContractAttachment => x != null && typeof x === "object" && "url" in (x as object))
      .map((x) => ({
        id: typeof x.id === "string" ? x.id : undefined,
        url: typeof x.url === "string" ? x.url : "",
        filename: typeof x.filename === "string" ? x.filename : undefined,
      }))
      .filter((x) => x.url.length > 0);
  } catch {
    return [];
  }
}

async function readContractUploadFiles(formData: FormData) {
  const files: Array<{ name: string; type: string; bytes: Uint8Array }> = [];
  for (const entry of formData.getAll("contract_attachments")) {
    if (!(entry instanceof File) || entry.size <= 0) continue;
    files.push({
      name: entry.name || "contract.pdf",
      type: entry.type || "application/octet-stream",
      bytes: new Uint8Array(await entry.arrayBuffer()),
    });
  }
  return files;
}

function parseContractAttachmentUrls(formData: FormData): UserContractAttachment[] {
  const raw = (formData.get("contract_attachment_urls") as string)?.trim() ?? "";
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: UserContractAttachment[] = [];
    for (const item of parsed) {
      if (typeof item === "string") {
        if (isAllowedDirectUploadToken(item, "user-contract")) {
          out.push({ url: item });
        }
        continue;
      }
      if (!item || typeof item !== "object") continue;
      const url = typeof (item as { url?: unknown }).url === "string" ? (item as { url: string }).url.trim() : "";
      if (!url || !isAllowedDirectUploadToken(url, "user-contract")) continue;
      const filename =
        typeof (item as { filename?: unknown }).filename === "string"
          ? (item as { filename: string }).filename
          : undefined;
      out.push({ url, ...(filename ? { filename } : {}) });
    }
    return out;
  } catch {
    return [];
  }
}

type ParsedCompensationFields = {
  compensation_type: CompensationType | null;
  compensation_value: number | null;
  contract_attachments: UserContractAttachment[];
  collaboration_start_date: string | null;
  collaboration_end_date: string | null;
};

function parseCompensationFields(formData: FormData): ParsedCompensationFields | { error: string } {
  const compensationTypeRaw = (formData.get("compensation_type") as string)?.trim() ?? "";
  const compensationType = parseCompensationType(compensationTypeRaw);
  const compensationValueRaw = (formData.get("compensation_value") as string)?.trim() ?? "";
  const collaborationStartRaw = (formData.get("collaboration_start_date") as string)?.trim() ?? "";
  const collaborationEndRaw = (formData.get("collaboration_end_date") as string)?.trim() ?? "";
  const keptAttachments = parseKeptContractAttachments(
    (formData.get("kept_contract_attachments") as string)?.trim() ?? ""
  );

  let compensation_value: number | null = null;
  if (compensationType) {
    if (!compensationValueRaw) {
      return { error: "Compensation value is required when compensation type is selected." };
    }
    const parsedValue = Number(compensationValueRaw);
    if (!Number.isFinite(parsedValue)) {
      return { error: "Compensation value must be a valid number." };
    }
    if (compensationType === "Percentage" && (parsedValue < 0 || parsedValue > 100)) {
      return { error: "Percentage must be between 0 and 100." };
    }
    if (compensationType === "Flat Fee" && parsedValue < 0) {
      return { error: "Flat fee amount cannot be negative." };
    }
    compensation_value = Math.round(parsedValue * 100) / 100;
  } else if (compensationValueRaw) {
    return { error: "Select a compensation type before entering a value." };
  }

  return {
    compensation_type: compensationType,
    compensation_value,
    contract_attachments: keptAttachments,
    collaboration_start_date: collaborationStartRaw ? collaborationStartRaw.slice(0, 10) : null,
    collaboration_end_date: collaborationEndRaw ? collaborationEndRaw.slice(0, 10) : null,
  };
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
    redirect(ACCOUNTS_LIST + "?error=" + encodeURIComponent("Name and email are required"));
  }
  if (!role) {
    redirect(ACCOUNTS_LIST + "?error=" + encodeURIComponent("Invalid role selected."));
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
      redirect(ACCOUNTS_LIST + "?error=" + encodeURIComponent("VA type is required for virtual assistant accounts."));
    }
    input.va_type = vaType;
  }

  const compensation = parseCompensationFields(formData);
  if ("error" in compensation) {
    redirect(ACCOUNTS_LIST + "?error=" + encodeURIComponent(compensation.error));
  }
  input.compensation_type = compensation.compensation_type;
  input.compensation_value = compensation.compensation_value;
  input.contract_attachments = compensation.contract_attachments;
  input.collaboration_start_date = compensation.collaboration_start_date;
  input.collaboration_end_date = compensation.collaboration_end_date;

  const preUploadedContractUrls = parseContractAttachmentUrls(formData);
  if (preUploadedContractUrls.length > 0) {
    input.contract_attachments = [
      ...compensation.contract_attachments,
      ...preUploadedContractUrls,
    ];
  }

  // On Supabase, contracts are pre-uploaded client-side as sb:// tokens — never
  // pull File bytes through the server action (Vercel body size limits).
  const contractFiles =
    isSupabaseBackend() || preUploadedContractUrls.length > 0
      ? []
      : await readContractUploadFiles(formData);

  try {
    const created = await createUser(input);
    if (contractFiles.length > 0) {
      try {
        await uploadUserContractAttachments(created.id, contractFiles);
      } catch (uploadErr) {
        console.error("[createAccount] contract attachment upload failed", uploadErr);
        redirect(
          ACCOUNTS_LIST +
            "?error=" +
            encodeURIComponent("User created but contract upload failed. Edit the user to re-upload files.")
        );
      }
    }
    await createDefaultPreferencesForUser(created.id, role).catch((err) => {
      console.error("[createAccount] notification prefs init failed", err);
    });
    revalidateAccountsPaths();
    redirect(ACCOUNTS_LIST + "?success=created");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    console.error("[createAccount] error", err);
    redirect(ACCOUNTS_LIST + "?error=" + encodeURIComponent(message || "Failed to create account"));
  }
}

export async function updateAccount(formData: FormData) {
  await requireAccountsPermission(PERMISSIONS.ACCOUNTS_EDIT);
  const recordId = (formData.get("recordId") as string)?.trim();
  if (!recordId) redirect(ACCOUNTS_LIST + "?error=missing_record");

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
  const infloww_employee_id_raw = formData.get("infloww_employee_id");
  let infloww_employee_id: number | null | undefined = undefined;
  if (infloww_employee_id_raw !== null) {
    const trimmed = String(infloww_employee_id_raw).trim();
    if (!trimmed) {
      infloww_employee_id = null;
    } else {
      const n = Number.parseInt(trimmed, 10);
      if (!Number.isFinite(n) || n <= 0) {
        redirect(ACCOUNTS_LIST + "?error=" + encodeURIComponent("Invalid Infloww employee ID."));
      }
      infloww_employee_id = n;
    }
  }

  const input: UpdateUserInput = {};
  if (full_name !== undefined) input.full_name = full_name;
  if (email !== undefined) input.email = email;
  if (roleRaw != null) {
    if (!role) {
      redirect(ACCOUNTS_LIST + "?error=" + encodeURIComponent("Invalid role selected."));
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
          ACCOUNTS_LIST +
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
        ACCOUNTS_LIST +
          "?error=" +
          encodeURIComponent("VA type is required when the account has a virtual assistant role.")
      );
    }
    input.va_type = vaType;
  } else {
    input.va_type = null;
  }
  if (telegram_username !== undefined) input.telegram_username = telegram_username;
  if (infloww_employee_id !== undefined) input.infloww_employee_id = infloww_employee_id;

  const compensation = parseCompensationFields(formData);
  if ("error" in compensation) {
    redirect(ACCOUNTS_LIST + "?error=" + encodeURIComponent(compensation.error));
  }
  input.compensation_type = compensation.compensation_type;
  input.compensation_value = compensation.compensation_value;
  input.contract_attachments = compensation.contract_attachments;
  input.collaboration_start_date = compensation.collaboration_start_date;
  input.collaboration_end_date = compensation.collaboration_end_date;

  const preUploadedContractUrls = parseContractAttachmentUrls(formData);
  if (preUploadedContractUrls.length > 0) {
    input.contract_attachments = [
      ...compensation.contract_attachments,
      ...preUploadedContractUrls,
    ];
  }

  const contractFiles =
    isSupabaseBackend() || preUploadedContractUrls.length > 0
      ? []
      : await readContractUploadFiles(formData);

  try {
    await updateUser(recordId, input);
    if (contractFiles.length > 0) {
      try {
        await uploadUserContractAttachments(recordId, contractFiles);
      } catch (uploadErr) {
        console.error("[updateAccount] contract attachment upload failed", uploadErr);
        redirect(
          ACCOUNTS_LIST +
            "?error=" +
            encodeURIComponent("User updated but new contract upload failed. Try uploading again.")
        );
      }
    }
    revalidateAccountsPaths();
    redirect(ACCOUNTS_LIST + "?success=updated");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    console.error("[updateAccount] error", err);
    redirect(ACCOUNTS_LIST + "?error=" + encodeURIComponent(message || "Failed to update account"));
  }
}

export async function setAccountPassword(formData: FormData) {
  await requireAccountsPermission(PERMISSIONS.ACCOUNTS_RESET_PASSWORD);
  const recordId = (formData.get("recordId") as string)?.trim();
  if (!recordId) redirect(ACCOUNTS_LIST + "?error=missing_record");
  const password = (formData.get("password") as string)?.trim() ?? "";
  if (!password || password.length < 8) {
    redirect(ACCOUNTS_LIST + "?error=" + encodeURIComponent("Password must be at least 8 characters"));
  }
  const hash = await hashPassword(password);
  try {
    await setPasswordHash(recordId, hash);
    try {
      const { notifyByRoleConfig } = await import("@/services/notification-service");
      const { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY } = await import("@/lib/notification-types");
      const { formatNotificationTimeElGr, passwordChangedPersonal } = await import("@/lib/notification-copy");
      const time = formatNotificationTimeElGr(new Date());
      const copy = passwordChangedPersonal(time);
      await notifyByRoleConfig(NOTIFICATION_EVENT.PASSWORD_CHANGED, {
        personal_user_id: recordId,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title: copy.title,
        body: copy.body,
        entity_type: "account",
        entity_id: `password_changed:${recordId}:${Date.now()}`,
        context: { time },
      });
    } catch (notifyErr) {
      console.error("[setAccountPassword] password_changed notify failed", notifyErr);
    }
    revalidateAccountsPaths();
    redirect(ACCOUNTS_LIST + "?success=password_reset");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    console.error("[setAccountPassword] error", err);
    redirect(ACCOUNTS_LIST + "?error=" + encodeURIComponent(message || "Failed to set password"));
  }
}

export async function toggleCanLogin(formData: FormData) {
  await requireAccountsPermission(PERMISSIONS.ACCOUNTS_EDIT);
  const recordId = (formData.get("recordId") as string)?.trim();
  const canLogin = formData.get("can_login") === "true";
  if (!recordId) redirect(ACCOUNTS_LIST + "?error=missing_record");
  try {
    await updateUser(recordId, { can_login: canLogin });
    revalidateAccountsPaths();
    redirect(ACCOUNTS_LIST + "?success=updated");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    console.error("[toggleCanLogin] error", err);
    redirect(ACCOUNTS_LIST + "?error=" + encodeURIComponent(message || "Failed to update"));
  }
}

export async function deleteUserAction(recordId: string) {
  await requireAccountsPermission(PERMISSIONS.ACCOUNTS_DELETE);
  const id = recordId?.trim();
  if (!id) {
    redirect(ACCOUNTS_LIST + "?error=" + encodeURIComponent("Missing user record"));
    return;
  }
  try {
    devLog("[delete-user]", { userId: id, step: "forceDeleteUser" });
    await forceDeleteUser(id);
    revalidateAccountsPaths();
    redirect(ACCOUNTS_LIST + "?success=user_deleted");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    console.error("[deleteUserAction] error", err);
    redirect(ACCOUNTS_LIST + "?error=" + encodeURIComponent(message || "Failed to delete user"));
  }
}
