/**
 * Sync RBAC role slugs into the Airtable `users.role` single-select field via Meta API.
 * Custom roles created in the RBAC UI must exist as select options or user create/update fails
 * with INVALID_MULTIPLE_CHOICE_OPTIONS.
 */

const META_BASE = "https://api.airtable.com/v0/meta/bases";
const USERS_TABLE_NAME = "users";
const ROLE_FIELD_NAME = "role";

type MetaChoice = { id?: string; name: string; color?: string };

type MetaField = {
  id: string;
  name: string;
  type: string;
  options?: { choices?: MetaChoice[] };
};

type MetaTable = {
  id: string;
  name: string;
  fields: MetaField[];
};

type UsersRoleFieldRef = {
  baseId: string;
  tableId: string;
  fieldId: string;
  field: MetaField;
};

let cachedUsersRoleField: UsersRoleFieldRef | null = null;

function getConfig(): { token: string; baseId: string } {
  const token = process.env.AIRTABLE_TOKEN?.trim();
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();
  if (!token || !baseId) {
    throw new Error("AIRTABLE_TOKEN and AIRTABLE_BASE_ID must be set");
  }
  return { token, baseId };
}

function normalizeRoleId(roleId: string): string {
  return roleId.trim().toLowerCase();
}

function choiceNamesSet(choices: MetaChoice[]): Set<string> {
  return new Set(choices.map((c) => (c.name ?? "").trim().toLowerCase()).filter(Boolean));
}

function preserveChoice(choice: MetaChoice): MetaChoice {
  const out: MetaChoice = { name: choice.name };
  if (choice.id) out.id = choice.id;
  if (choice.color) out.color = choice.color;
  return out;
}

function mergeRoleChoices(existing: MetaChoice[], roleIds: string[]): MetaChoice[] {
  const seen = choiceNamesSet(existing);
  const merged = existing.map(preserveChoice);
  for (const raw of roleIds) {
    const roleId = normalizeRoleId(raw);
    if (!roleId || seen.has(roleId)) continue;
    seen.add(roleId);
    merged.push({ name: roleId, color: "grayLight2" });
  }
  return merged;
}

async function metaFetch(
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  return fetch(`${META_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

/** Resolve `users` table id and `role` single-select field id via Meta API (cached per process). */
export async function resolveUsersRoleField(): Promise<UsersRoleFieldRef> {
  const { token, baseId } = getConfig();
  if (cachedUsersRoleField?.baseId === baseId) {
    return cachedUsersRoleField;
  }

  const res = await metaFetch(token, `/${baseId}/tables`, { method: "GET" });
  if (!res.ok) {
    throw new Error(`GET meta tables failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { tables?: MetaTable[] };
  const usersTable = data.tables?.find((t) => t.name.toLowerCase() === USERS_TABLE_NAME);
  if (!usersTable) {
    throw new Error(`Table "${USERS_TABLE_NAME}" not found in Airtable base`);
  }

  const roleField = usersTable.fields.find(
    (f) => f.name.toLowerCase() === ROLE_FIELD_NAME && f.type === "singleSelect"
  );
  if (!roleField) {
    throw new Error(
      `Field "${ROLE_FIELD_NAME}" (singleSelect) not found on "${USERS_TABLE_NAME}" table`
    );
  }

  cachedUsersRoleField = {
    baseId,
    tableId: usersTable.id,
    fieldId: roleField.id,
    field: roleField,
  };
  return cachedUsersRoleField;
}

export function clearUsersRoleFieldCache(): void {
  cachedUsersRoleField = null;
}

async function patchUsersRoleChoices(
  ref: UsersRoleFieldRef,
  token: string,
  nextChoices: MetaChoice[]
): Promise<void> {
  const res = await metaFetch(
    token,
    `/${ref.baseId}/tables/${ref.tableId}/fields/${ref.fieldId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        type: "singleSelect",
        options: { ...(ref.field.options ?? {}), choices: nextChoices },
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`PATCH users.role field failed (${res.status}): ${await res.text()}`);
  }
  clearUsersRoleFieldCache();
}

export type SyncRoleOptionsResult = {
  added: string[];
  skipped: string[];
};

/** Ensure each role slug exists on users.role. Idempotent; batches into one PATCH when possible. */
export async function syncRoleOptionsToAirtable(roleIds: string[]): Promise<SyncRoleOptionsResult> {
  const normalized = [...new Set(roleIds.map(normalizeRoleId).filter(Boolean))];
  if (normalized.length === 0) {
    return { added: [], skipped: [] };
  }

  const { token } = getConfig();
  const ref = await resolveUsersRoleField();
  const existing = ref.field.options?.choices ?? [];
  const existingNames = choiceNamesSet(existing);
  const toAdd = normalized.filter((id) => !existingNames.has(id));
  const skipped = normalized.filter((id) => existingNames.has(id));

  if (toAdd.length === 0) {
    return { added: [], skipped };
  }

  const nextChoices = mergeRoleChoices(existing, toAdd);
  await patchUsersRoleChoices(ref, token, nextChoices);
  return { added: toAdd, skipped };
}

export type SyncRoleOptionResult = {
  ok: boolean;
  warning?: string;
};

/** Ensure one role slug exists on users.role. Logs and returns warning on failure (does not throw). */
export async function syncRoleOptionToAirtable(roleId: string): Promise<SyncRoleOptionResult> {
  const normalized = normalizeRoleId(roleId);
  if (!normalized) {
    return { ok: false, warning: "Empty role id" };
  }

  try {
    const { added } = await syncRoleOptionsToAirtable([normalized]);
    if (added.length > 0) {
      console.log(`[syncRoleOptionToAirtable] Added "${normalized}" to users.role select options`);
    }
    return { ok: true };
  } catch (err) {
    const warning = err instanceof Error ? err.message : String(err);
    console.error(`[syncRoleOptionToAirtable] Failed for "${normalized}":`, warning);
    return {
      ok: false,
      warning: `Could not sync role option to Airtable users.role field: ${warning}`,
    };
  }
}
