/**
 * Supabase backend for services/users.ts (DATA_BACKEND=supabase).
 * Public ids remain Airtable-shaped (airtable_id) during dual-run.
 */

import {
  publicId,
  sbFirstLinkedAirtableId,
  sbInsert,
  sbSelectAll,
  sbSelectByPublicId,
  sbSelectEq,
  sbUpdateByPublicId,
  sbUuidsForAirtableIds,
  type SbRow,
  requireSbUuids,
} from "@/lib/supabase-data";
import { filterActiveUsersForAssignment, isUserActiveForAssignment } from "@/lib/assignment-filters";
import { DEFAULT_ROLE_PERMISSIONS, type Permission } from "@/lib/permissions";
import { getRolePermissions } from "@/services/roles";
import type { UserRecord, UserRole, VaType, CompensationType, UserContractAttachment } from "@/types";

const TABLE = "users";

type Row = SbRow & {
  user_id?: string | null;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  secondary_role?: string | null;
  va_type?: string | null;
  status?: string | null;
  can_login?: boolean | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  password_hash?: string | null;
  linked_model?: string[] | null;
  language_preference?: string | null;
  telegram_username?: string | null;
  last_login_user_agent?: string | null;
  compensation_type?: string | null;
  compensation_value?: number | null;
  contract_attachments?: string[] | null;
  collaboration_start_date?: string | null;
  collaboration_end_date?: string | null;
};

function parseCompensationType(raw: unknown): CompensationType | null {
  const s = String(raw ?? "").trim();
  if (s === "Percentage" || s === "Flat Fee") return s;
  return null;
}

async function parseContractAttachmentsFromUrls(
  urls: string[] | null | undefined
): Promise<UserContractAttachment[]> {
  if (!urls?.length) return [];
  const { urlsToAttachments } = await import("@/lib/supabase-signed-url");
  return urlsToAttachments(urls);
}

function mapSecondaryRoleField(raw: unknown): "chatter" | "virtual_assistant" | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "chatter") return "chatter";
  if (s === "va" || s === "virtual_assistant") return "virtual_assistant";
  return null;
}

function mapVaTypeField(raw: unknown): VaType | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "chatting" || s === "marketing" || s === "both") return s;
  return null;
}

async function mapRow(row: Row, includePasswordHash = false): Promise<UserRecord> {
  const out: UserRecord = {
    id: publicId(row),
    user_id: row.user_id ?? "",
    full_name: row.full_name ?? "",
    email: row.email ?? "",
    role: (row.role === "va" ? "virtual_assistant" : row.role) as UserRole,
    status: row.status ?? "",
    can_login: row.can_login ?? true,
    notes: row.notes ?? "",
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
  };
  if (includePasswordHash && row.password_hash) out.password_hash = row.password_hash;
  const linkedModelId = await sbFirstLinkedAirtableId("modelss", row.linked_model);
  if (linkedModelId) out.linked_model_id = linkedModelId;
  if (typeof row.language_preference === "string" && row.language_preference.trim()) {
    out.language_preference = row.language_preference.trim();
  }
  const sec = mapSecondaryRoleField(row.secondary_role);
  if (sec) out.secondary_role = sec;
  const vaType = mapVaTypeField(row.va_type);
  if (vaType) out.va_type = vaType;
  if (typeof row.telegram_username === "string" && row.telegram_username.trim()) {
    out.telegram_username = row.telegram_username.trim();
  }
  if (typeof row.last_login_user_agent === "string" && row.last_login_user_agent.trim()) {
    out.last_login_user_agent = row.last_login_user_agent.trim();
  }
  const compensationType = parseCompensationType(row.compensation_type);
  if (compensationType) out.compensation_type = compensationType;
  if (typeof row.compensation_value === "number" && !Number.isNaN(row.compensation_value)) {
    out.compensation_value = Number(row.compensation_value);
  }
  const contractAttachments = await parseContractAttachmentsFromUrls(row.contract_attachments);
  if (contractAttachments.length > 0) out.contract_attachments = contractAttachments;
  if (row.collaboration_start_date) {
    out.collaboration_start_date = String(row.collaboration_start_date).slice(0, 10);
  }
  if (row.collaboration_end_date) {
    out.collaboration_end_date = String(row.collaboration_end_date).slice(0, 10);
  }
  return out;
}

function genUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function listUsers(): Promise<{ users: UserRecord[]; offset?: string }> {
  const rows = await sbSelectAll<Row>(TABLE);
  const users = await Promise.all(rows.map((r) => mapRow(r)));
  return { users };
}

export async function listAllUsers(): Promise<UserRecord[]> {
  const rows = await sbSelectAll<Row>(TABLE);
  return Promise.all(rows.map((r) => mapRow(r)));
}

export async function listActiveUsers(): Promise<UserRecord[]> {
  return filterActiveUsersForAssignment(await listAllUsers());
}

export async function listUsersWithPermission(permission: Permission): Promise<UserRecord[]> {
  const users = await listAllUsers();
  const roleCache = new Map<string, Set<Permission>>();
  const out: UserRecord[] = [];
  for (const u of users) {
    if (!isUserActiveForAssignment(u)) continue;
    const roleKey = (u.role ?? "").trim().toLowerCase();
    if (!roleKey) continue;
    let perms = roleCache.get(roleKey);
    if (!perms) {
      let list: Permission[] = [];
      try {
        list = await getRolePermissions(roleKey);
      } catch {
        list = [];
      }
      if (list.length === 0) list = DEFAULT_ROLE_PERMISSIONS[roleKey as UserRole] ?? [];
      perms = new Set(list);
      roleCache.set(roleKey, perms);
    }
    if (perms.has(permission)) out.push(u);
  }
  return out;
}

export async function getActiveModelUserAirtableIdByLinkedModelRecordId(
  modelssRecordId: string | null | undefined
): Promise<string | null> {
  const id = modelssRecordId?.trim();
  if (!id) return null;
  const users = await listAllUsers();
  const found = users.find(
    (x) =>
      x.role === "model" &&
      x.linked_model_id === id &&
      (x.status ?? "").toLowerCase() === "active"
  );
  return found?.id ?? null;
}

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const normalized = email.trim().toLowerCase();
  const rows = await sbSelectEq<Row>(TABLE, "email", normalized, "*", 1);
  if (!rows[0]) return null;
  return mapRow(rows[0]);
}

export async function getUserByEmailForAuth(email: string): Promise<UserRecord | null> {
  const normalized = email.trim().toLowerCase();
  const rows = await sbSelectEq<Row>(TABLE, "email", normalized, "*", 1);
  if (!rows[0]) return null;
  return mapRow(rows[0], true);
}

export async function getUserByAirtableId(recordId: string): Promise<UserRecord | null> {
  const row = await sbSelectByPublicId<Row>(TABLE, recordId);
  if (!row) return null;
  return mapRow(row);
}

export async function getUserByUserId(userId: string): Promise<UserRecord | null> {
  const trimmed = userId.trim();
  if (!trimmed) return null;
  const rows = await sbSelectEq<Row>(TABLE, "user_id", trimmed, "*", 1);
  if (!rows[0]) return null;
  return mapRow(rows[0]);
}

export type CreateUserInput = {
  full_name: string;
  email: string;
  role: UserRole;
  status?: string;
  can_login?: boolean;
  notes?: string;
  password_hash?: string;
  linked_model_id?: string;
  language_preference?: string;
  telegram_username?: string;
  va_type?: VaType;
  compensation_type?: CompensationType | null;
  compensation_value?: number | null;
  contract_attachments?: UserContractAttachment[];
  collaboration_start_date?: string | null;
  collaboration_end_date?: string | null;
};

export async function createUser(input: CreateUserInput): Promise<UserRecord> {
  const row: Record<string, unknown> = {
    user_id: genUserId(),
    full_name: input.full_name.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    status: input.status?.trim() ?? "active",
    can_login: input.can_login ?? true,
    notes: input.notes?.trim() ?? "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (input.password_hash) row.password_hash = input.password_hash;
  if (input.linked_model_id) {
    row.linked_model = await requireSbUuids("modelss", [input.linked_model_id], "linked_model");
  }
  if (input.language_preference) row.language_preference = input.language_preference;
  if (input.telegram_username?.trim()) row.telegram_username = input.telegram_username.trim();
  if (input.va_type) row.va_type = input.va_type;
  if (input.compensation_type) row.compensation_type = input.compensation_type;
  if (input.compensation_value != null) row.compensation_value = input.compensation_value;
  if (input.contract_attachments?.length) {
    row.contract_attachments = input.contract_attachments.map((a) => a.url).filter(Boolean);
  }
  if (input.collaboration_start_date) row.collaboration_start_date = input.collaboration_start_date;
  if (input.collaboration_end_date) row.collaboration_end_date = input.collaboration_end_date;

  const created = await sbInsert<Row>(TABLE, row);
  return mapRow(created);
}

export type UpdateUserInput = Partial<{
  full_name: string;
  email: string;
  role: UserRole;
  status: string;
  can_login: boolean;
  notes: string;
  linked_model_id: string | null;
  language_preference: string | null;
  secondary_role: "chatter" | "virtual_assistant" | null;
  va_type: VaType | null;
  telegram_username: string | null;
  compensation_type: CompensationType | null;
  compensation_value: number | null;
  contract_attachments: UserContractAttachment[] | null;
  collaboration_start_date: string | null;
  collaboration_end_date: string | null;
}>;

export async function updateUser(recordId: string, input: UpdateUserInput): Promise<UserRecord> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.full_name !== undefined) patch.full_name = input.full_name.trim();
  if (input.email !== undefined) patch.email = input.email.trim().toLowerCase();
  if (input.role !== undefined) patch.role = input.role;
  if (input.status !== undefined) patch.status = input.status;
  if (input.can_login !== undefined) patch.can_login = input.can_login;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.linked_model_id !== undefined) {
    patch.linked_model = input.linked_model_id
      ? await requireSbUuids("modelss", [input.linked_model_id], "linked_model")
      : [];
  }
  if (input.language_preference !== undefined) {
    patch.language_preference = input.language_preference ?? "";
  }
  if (input.secondary_role !== undefined) {
    patch.secondary_role =
      input.secondary_role === null
        ? null
        : input.secondary_role === "virtual_assistant"
          ? "va"
          : "chatter";
  }
  if (input.va_type !== undefined) patch.va_type = input.va_type;
  if (input.telegram_username !== undefined) {
    patch.telegram_username = input.telegram_username?.trim() ?? "";
  }
  if (input.compensation_type !== undefined) {
    if (input.compensation_type === null) {
      patch.compensation_type = null;
      patch.compensation_value = null;
    } else {
      patch.compensation_type = input.compensation_type;
      if (input.compensation_value !== undefined) patch.compensation_value = input.compensation_value;
    }
  } else if (input.compensation_value !== undefined) {
    patch.compensation_value = input.compensation_value;
  }
  if (input.contract_attachments !== undefined) {
    patch.contract_attachments =
      input.contract_attachments?.map((a) => a.url).filter(Boolean) ?? [];
  }
  if (input.collaboration_start_date !== undefined) {
    patch.collaboration_start_date = input.collaboration_start_date || null;
  }
  if (input.collaboration_end_date !== undefined) {
    patch.collaboration_end_date = input.collaboration_end_date || null;
  }
  const updated = await sbUpdateByPublicId<Row>(TABLE, recordId, patch);
  return mapRow(updated);
}

export async function setPasswordHash(recordId: string, passwordHash: string): Promise<void> {
  await sbUpdateByPublicId(TABLE, recordId, {
    password_hash: passwordHash,
    updated_at: new Date().toISOString(),
  });
}

export async function updateLastLoginUserAgent(recordId: string, userAgent: string): Promise<void> {
  await sbUpdateByPublicId(TABLE, recordId, {
    last_login_user_agent: userAgent.trim(),
    updated_at: new Date().toISOString(),
  });
}

export async function uploadUserContractAttachments(
  recordId: string,
  files: Array<{ name: string; type: string; bytes: Uint8Array }>
): Promise<void> {
  // Private bucket: store durable sb:// tokens (signed URLs minted on read).
  const { uploadToPrivateStorage } = await import("@/lib/supabase-signed-url");
  const existing = await sbSelectByPublicId<Row>(TABLE, recordId);
  const urls = [...(existing?.contract_attachments ?? [])];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file.bytes.byteLength) continue;
    const safeName = (file.name || "contract.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectPath = `users/${recordId}/contract_attachments/${Date.now()}_${i}_${safeName}`;
    const token = await uploadToPrivateStorage({
      bucket: "attachments",
      objectPath,
      bytes: file.bytes,
      contentType: file.type || "application/octet-stream",
    });
    urls.push(token);
  }
  await sbUpdateByPublicId(TABLE, recordId, {
    contract_attachments: urls,
    updated_at: new Date().toISOString(),
  });
}

export async function relinkModelUserForModelProfile(
  modelRecordId: string,
  selectedUserId: string | null
): Promise<void> {
  const modelId = modelRecordId?.trim();
  if (!modelId) return;
  const selectedId = selectedUserId?.trim() || null;

  const users = await listAllUsers();
  const modelUsers = users.filter((u) => u.role === "model");
  const currentlyLinked = modelUsers.find((u) => u.linked_model_id === modelId) ?? null;

  if (currentlyLinked && currentlyLinked.id !== selectedId) {
    await updateUser(currentlyLinked.id, { linked_model_id: null });
  }

  if (!selectedId) return;

  const selected = modelUsers.find((u) => u.id === selectedId);
  if (!selected) throw new Error("Selected model user account not found.");
  await updateUser(selectedId, { linked_model_id: modelId });
}
