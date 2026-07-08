/**
 * Sync RBAC role slugs into the Airtable `users.role` single-select field.
 * Tries Meta API PATCH first (options.choices only, id+name for existing choices).
 * Falls back to a typecast probe record when choice PATCH is rejected (422 on some bases).
 * Custom roles created in the RBAC UI must exist as select options or user create/update fails
 * with INVALID_MULTIPLE_CHOICE_OPTIONS.
 */

const META_BASE = "https://api.airtable.com/v0/meta/bases";
const DATA_API = "https://api.airtable.com/v0";
const USERS_TABLE_NAME = "users";
const ROLE_FIELD_NAME = "role";
const SOP_ROLES_TABLE_NAME = "sop_roles";
const SOP_AUTH_ROLES_FIELD_NAME = "auth_roles";

type MetaChoice = { id?: string; name: string };

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

type SopAuthRolesFieldRef = {
  baseId: string;
  tableId: string;
  fieldId: string;
  field: MetaField;
};

let cachedSopAuthRolesField: SopAuthRolesFieldRef | null = null;

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

function preserveChoice(choice: { id?: string; name: string }): MetaChoice {
  const out: MetaChoice = { name: choice.name };
  if (choice.id) out.id = choice.id;
  return out;
}

function mergeRoleChoices(existing: MetaChoice[], roleIds: string[]): MetaChoice[] {
  const seen = choiceNamesSet(existing);
  const merged = existing.map(preserveChoice);
  for (const raw of roleIds) {
    const roleId = normalizeRoleId(raw);
    if (!roleId || seen.has(roleId)) continue;
    seen.add(roleId);
    merged.push({ name: roleId });
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

export function clearSopAuthRolesFieldCache(): void {
  cachedSopAuthRolesField = null;
}

/** Resolve `sop_roles` table id and `auth_roles` multipleSelects field id via Meta API (cached per process). */
export async function resolveSopAuthRolesField(): Promise<SopAuthRolesFieldRef> {
  const { token, baseId } = getConfig();
  if (cachedSopAuthRolesField?.baseId === baseId) {
    return cachedSopAuthRolesField;
  }

  const res = await metaFetch(token, `/${baseId}/tables`, { method: "GET" });
  if (!res.ok) {
    throw new Error(`GET meta tables failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { tables?: MetaTable[] };
  const sopRolesTable = data.tables?.find((t) => t.name.toLowerCase() === SOP_ROLES_TABLE_NAME);
  if (!sopRolesTable) {
    throw new Error(`Table "${SOP_ROLES_TABLE_NAME}" not found in Airtable base`);
  }

  const authRolesField = sopRolesTable.fields.find(
    (f) => f.name.toLowerCase() === SOP_AUTH_ROLES_FIELD_NAME && f.type === "multipleSelects"
  );
  if (!authRolesField) {
    throw new Error(
      `Field "${SOP_AUTH_ROLES_FIELD_NAME}" (multipleSelects) not found on "${SOP_ROLES_TABLE_NAME}" table`
    );
  }

  cachedSopAuthRolesField = {
    baseId,
    tableId: sopRolesTable.id,
    fieldId: authRolesField.id,
    field: authRolesField,
  };
  return cachedSopAuthRolesField;
}

async function dataFetch(
  token: string,
  baseId: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  return fetch(`${DATA_API}/${baseId}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

/** Meta API PATCH for singleSelect choices. Returns false on 422 (use typecast fallback). */
async function patchUsersRoleChoices(
  ref: UsersRoleFieldRef,
  token: string,
  nextChoices: MetaChoice[]
): Promise<boolean> {
  const res = await metaFetch(
    token,
    `/${ref.baseId}/tables/${ref.tableId}/fields/${ref.fieldId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        options: { choices: nextChoices },
      }),
    }
  );
  if (res.ok) {
    clearUsersRoleFieldCache();
    return true;
  }
  const body = await res.text();
  if (res.status === 422) {
    return false;
  }
  throw new Error(`PATCH users.role field failed (${res.status}): ${body}`);
}

/** Add one select option via typecast create + delete (no Meta API choice PATCH needed). */
async function addRoleOptionViaTypecast(
  ref: UsersRoleFieldRef,
  token: string,
  roleSlug: string
): Promise<void> {
  const createRes = await dataFetch(token, ref.baseId, encodeURIComponent(USERS_TABLE_NAME), {
    method: "POST",
    body: JSON.stringify({
      typecast: true,
      records: [{ fields: { [ROLE_FIELD_NAME]: roleSlug } }],
    }),
  });
  if (!createRes.ok) {
    throw new Error(
      `typecast create users.role="${roleSlug}" failed (${createRes.status}): ${await createRes.text()}`
    );
  }
  const created = (await createRes.json()) as { records?: Array<{ id: string }> };
  const probeId = created.records?.[0]?.id;
  if (!probeId) {
    throw new Error(`typecast create users.role="${roleSlug}" returned no record id`);
  }

  const deleteRes = await dataFetch(
    token,
    ref.baseId,
    `${encodeURIComponent(USERS_TABLE_NAME)}/${probeId}`,
    { method: "DELETE" }
  );
  if (!deleteRes.ok) {
    throw new Error(
      `failed to delete typecast probe record ${probeId} (${deleteRes.status}): ${await deleteRes.text()}`
    );
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
  const patched = await patchUsersRoleChoices(ref, token, nextChoices);
  if (patched) {
    return { added: toAdd, skipped };
  }

  const added: string[] = [];
  for (const roleId of toAdd) {
    await addRoleOptionViaTypecast(ref, token, roleId);
    added.push(roleId);
  }
  return { added, skipped };
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

async function patchSopAuthRoleChoices(
  ref: SopAuthRolesFieldRef,
  token: string,
  nextChoices: MetaChoice[]
): Promise<boolean> {
  const res = await metaFetch(
    token,
    `/${ref.baseId}/tables/${ref.tableId}/fields/${ref.fieldId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        options: { choices: nextChoices },
      }),
    }
  );
  if (res.ok) {
    clearSopAuthRolesFieldCache();
    return true;
  }
  const body = await res.text();
  if (res.status === 422) {
    return false;
  }
  throw new Error(`PATCH sop_roles.auth_roles field failed (${res.status}): ${body}`);
}

/** Add one select option via typecast create + delete on sop_roles.auth_roles. */
async function addSopAuthRoleOptionViaTypecast(
  ref: SopAuthRolesFieldRef,
  token: string,
  roleSlug: string
): Promise<void> {
  const createRes = await dataFetch(token, ref.baseId, encodeURIComponent(SOP_ROLES_TABLE_NAME), {
    method: "POST",
    body: JSON.stringify({
      typecast: true,
      records: [{ fields: { [SOP_AUTH_ROLES_FIELD_NAME]: [roleSlug] } }],
    }),
  });
  if (!createRes.ok) {
    throw new Error(
      `typecast create sop_roles.auth_roles=["${roleSlug}"] failed (${createRes.status}): ${await createRes.text()}`
    );
  }
  const created = (await createRes.json()) as { records?: Array<{ id: string }> };
  const probeId = created.records?.[0]?.id;
  if (!probeId) {
    throw new Error(`typecast create sop_roles.auth_roles=["${roleSlug}"] returned no record id`);
  }

  const deleteRes = await dataFetch(
    token,
    ref.baseId,
    `${encodeURIComponent(SOP_ROLES_TABLE_NAME)}/${probeId}`,
    { method: "DELETE" }
  );
  if (!deleteRes.ok) {
    throw new Error(
      `failed to delete typecast probe record ${probeId} (${deleteRes.status}): ${await deleteRes.text()}`
    );
  }
  clearSopAuthRolesFieldCache();
}

/** Ensure each role slug exists on sop_roles.auth_roles. Idempotent; batches into one PATCH when possible. */
export async function syncSopAuthRoleOptionsToAirtable(roleIds: string[]): Promise<SyncRoleOptionsResult> {
  const normalized = [...new Set(roleIds.map(normalizeRoleId).filter(Boolean))];
  if (normalized.length === 0) {
    return { added: [], skipped: [] };
  }

  const { token } = getConfig();
  const ref = await resolveSopAuthRolesField();
  const existing = ref.field.options?.choices ?? [];
  const existingNames = choiceNamesSet(existing);
  const toAdd = normalized.filter((id) => !existingNames.has(id));
  const skipped = normalized.filter((id) => existingNames.has(id));

  if (toAdd.length === 0) {
    return { added: [], skipped };
  }

  const nextChoices = mergeRoleChoices(existing, toAdd);
  const patched = await patchSopAuthRoleChoices(ref, token, nextChoices);
  if (patched) {
    return { added: toAdd, skipped };
  }

  const added: string[] = [];
  for (const roleId of toAdd) {
    await addSopAuthRoleOptionViaTypecast(ref, token, roleId);
    added.push(roleId);
  }
  return { added, skipped };
}

/** Ensure sop_roles.auth_roles options exist for the given slugs. Logs warning on failure (does not throw). */
export async function syncSopAuthRoleOptionsSafe(roleIds: string[]): Promise<SyncRoleOptionResult> {
  try {
    const { added } = await syncSopAuthRoleOptionsToAirtable(roleIds);
    if (added.length > 0) {
      console.log(`[syncSopAuthRoleOptionsSafe] Added to sop_roles.auth_roles: ${added.join(", ")}`);
    }
    return { ok: true };
  } catch (err) {
    const warning = err instanceof Error ? err.message : String(err);
    console.error("[syncSopAuthRoleOptionsSafe] Failed:", warning);
    return {
      ok: false,
      warning: `Could not sync role options to Airtable sop_roles.auth_roles field: ${warning}`,
    };
  }
}
