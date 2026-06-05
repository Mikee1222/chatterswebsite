"use server";

import {
  listRecords,
  listAllRecords,
  getRecord,
  createRecord,
  updateRecord,
  type AirtableRecord,
  type ListParams,
} from "@/lib/airtable-server";
import { firstLinkedId } from "@/lib/airtable-linked";
import type { UserRecord, UserRole } from "@/types";

const TABLE = "users";

type Fields = {
  user_id?: string;
  full_name?: string;
  email?: string;
  role?: string;
  /** Airtable single select: chatter | va */
  secondary_role?: string;
  status?: string;
  can_login?: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  password_hash?: string;
  linked_model?: string | string[];
  language_preference?: string;
  telegram_username?: string;
};

function mapSecondaryRoleField(raw: unknown): "chatter" | "virtual_assistant" | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "chatter") return "chatter";
  if (s === "va" || s === "virtual_assistant") return "virtual_assistant";
  return null;
}

function mapRecord(rec: AirtableRecord<Fields>, includePasswordHash = false): UserRecord {
  const f = rec.fields;
  const out: UserRecord = {
    id: rec.id,
    user_id: f.user_id ?? "",
    full_name: f.full_name ?? "",
    email: f.email ?? "",
    role: (f.role as UserRole) ?? "chatter",
    status: f.status ?? "",
    can_login: f.can_login ?? true,
    notes: f.notes ?? "",
    created_at: f.created_at ?? "",
    updated_at: f.updated_at ?? "",
  };
  if (includePasswordHash && f.password_hash) out.password_hash = f.password_hash;
  const linkedModelId = firstLinkedId(f.linked_model);
  if (linkedModelId) out.linked_model_id = linkedModelId;
  if (typeof f.language_preference === "string" && f.language_preference.trim()) {
    out.language_preference = f.language_preference.trim();
  }
  const sec = mapSecondaryRoleField(f.secondary_role);
  if (sec) out.secondary_role = sec;
  if (typeof f.telegram_username === "string" && f.telegram_username.trim()) {
    out.telegram_username = f.telegram_username.trim();
  }
  return out;
}

export async function listUsers(params: ListParams = {}) {
  const { records, offset } = await listRecords<Fields>(TABLE, params);
  return { users: records.map((r) => mapRecord(r)), offset };
}

/** All users (full table). Uses a 5-minute in-memory cache in `listAllRecords` for the `users` table — see `lib/airtable-server.ts`. */
export async function listAllUsers(): Promise<UserRecord[]> {
  const records = await listAllRecords<Fields>(TABLE, {});
  return records.map((r) => mapRecord(r));
}

/**
 * Airtable `users` record id for an active model account linked to this `modelss` row.
 * Used for notify({ user_id }) — same pattern as shift notifications (always Airtable user id).
 */
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

/** For display / accounts list; does not include password_hash. */
export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const { users } = await listUsers({
    filterByFormula: `{email} = "${email.replace(/"/g, '""')}"`,
    pageSize: 1,
  });
  return users[0] ?? null;
}

/** For login only; includes password_hash for verification. Never expose to client. */
export async function getUserByEmailForAuth(email: string): Promise<UserRecord | null> {
  const normalized = email.trim().toLowerCase();
  const { records } = await listRecords<Fields>(TABLE, {
    filterByFormula: `{email} = "${normalized.replace(/"/g, '""')}"`,
    pageSize: 1,
  });
  if (!records[0]) return null;
  return mapRecord(records[0], true);
}

export async function getUserByAirtableId(recordId: string): Promise<UserRecord | null> {
  try {
    const rec = await getRecord<Fields>(TABLE, recordId);
    return mapRecord(rec);
  } catch {
    return null;
  }
}

function genUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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
};

export async function createUser(input: CreateUserInput): Promise<UserRecord> {
  const fields: Record<string, unknown> = {
    user_id: genUserId(),
    full_name: input.full_name.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    status: input.status?.trim() ?? "active",
    can_login: input.can_login ?? true,
    notes: input.notes?.trim() ?? "",
  };
  if (input.password_hash) fields.password_hash = input.password_hash;
  if (input.linked_model_id) fields.linked_model = [input.linked_model_id];
  if (input.language_preference) fields.language_preference = input.language_preference;
  if (input.telegram_username?.trim()) fields.telegram_username = input.telegram_username.trim();
  const rec = await createRecord<Fields>(TABLE, fields as Fields);
  return mapRecord(rec);
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
  /** Persists Airtable values `chatter` or `va` (null clears). */
  secondary_role: "chatter" | "virtual_assistant" | null;
  telegram_username: string | null;
}>;

export async function updateUser(recordId: string, input: UpdateUserInput): Promise<UserRecord> {
  const fields: Partial<Fields> = {};
  if (input.full_name !== undefined) fields.full_name = input.full_name.trim();
  if (input.email !== undefined) fields.email = input.email.trim().toLowerCase();
  if (input.role !== undefined) fields.role = input.role;
  if (input.status !== undefined) fields.status = input.status;
  if (input.can_login !== undefined) fields.can_login = input.can_login;
  if (input.notes !== undefined) fields.notes = input.notes;
  if (input.linked_model_id !== undefined) {
    fields.linked_model = input.linked_model_id ? [input.linked_model_id] : [];
  }
  if (input.language_preference !== undefined) {
    fields.language_preference = input.language_preference ?? "";
  }
  if (input.secondary_role !== undefined) {
    if (input.secondary_role === null) {
      (fields as Record<string, unknown>).secondary_role = null;
    } else {
      fields.secondary_role = input.secondary_role === "virtual_assistant" ? "va" : "chatter";
    }
  }
  if (input.telegram_username !== undefined) {
    fields.telegram_username = input.telegram_username?.trim() ?? "";
  }
  const rec = await updateRecord<Fields>(TABLE, recordId, fields);
  return mapRecord(rec);
}

export async function setPasswordHash(recordId: string, passwordHash: string): Promise<void> {
  await updateRecord<Fields>(TABLE, recordId, {
    password_hash: passwordHash,
  });
}

/**
 * Re-link which model user account owns a specific modelss profile.
 * - Clears previous user linked to this model (if different)
 * - Sets selected model user's linked_model_id to this model
 * - If selectedUserId is null, only clears the existing link
 */
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
