import {
  listRecords,
  listAllRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  batchUpdateRecords,
  type AirtableRecord,
} from "@/lib/airtable-server";
import {
  firstLinkedId,
  linkedRecordIds,
  toLinkedRecordPayload,
} from "@/lib/airtable-linked";
import type {
  SopDepartment,
  SopRole,
  SopFunction,
  SopColor,
  SopAuthRole,
  CadenceType,
  StandardType,
  UserRecord,
} from "@/types";

export const SOP_DEPARTMENTS_TABLE = "sop_departments";
export const SOP_ROLES_TABLE = "sop_roles";
export const SOP_FUNCTIONS_TABLE = "sop_functions";

const SOP_COLORS: readonly SopColor[] = [
  "blue",
  "pink",
  "green",
  "orange",
  "purple",
  "gray",
];

const SOP_AUTH_ROLES: readonly SopAuthRole[] = [
  "admin",
  "manager",
  "chatter",
  "virtual_assistant",
  "model",
  "client",
];

const CADENCE_TYPES: readonly CadenceType[] = [
  "daily",
  "per_shift",
  "weekly",
  "biweekly",
  "monthly",
  "ad_hoc",
];

const STANDARD_TYPES: readonly StandardType[] = ["text", "file"];

const SORT = [{ field: "sort_order", direction: "asc" as const }];

type DepartmentFields = {
  department_id?: string;
  name?: string;
  color?: string;
  sort_order?: number | string;
  is_active?: boolean;
  created_at?: string;
};

type RoleFields = {
  role_id?: string;
  name?: string;
  slug?: string;
  description?: string;
  icon?: string;
  color?: string;
  department?: string | string[];
  auth_roles?: string[];
  assigned_users?: string | string[];
  academy_mode?: boolean;
  sort_order?: number | string;
  is_active?: boolean;
  created_at?: string;
};

type FunctionFields = {
  function_id?: string;
  sop_role?: string | string[];
  name?: string;
  department?: string | string[];
  kpi?: string;
  standard_type?: string;
  sop_content?: string;
  sop_file_url?: string;
  sop_file_name?: string;
  loom_url?: string;
  cadence_type?: string;
  cadence_note?: string;
  sort_order?: number | string;
  is_active?: boolean;
  content_version?: number | string;
  estimated_minutes?: number | string;
  created_at?: string;
};

function coerceContentVersion(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(1, Math.floor(v));
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    if (Number.isFinite(n)) return Math.max(1, n);
  }
  return 1;
}

function coerceEstimatedMinutes(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return Math.floor(v);
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

function genStableId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function coerceSortOrder(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function coerceSopColor(v: unknown): SopColor {
  const s = String(v ?? "").trim() as SopColor;
  return SOP_COLORS.includes(s) ? s : "gray";
}

function coerceAuthRoles(v: unknown): SopAuthRole[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is SopAuthRole =>
    typeof x === "string" && (SOP_AUTH_ROLES as readonly string[]).includes(x)
  );
}

function coerceCadenceType(v: unknown): CadenceType {
  const s = String(v ?? "").trim() as CadenceType;
  return CADENCE_TYPES.includes(s) ? s : "ad_hoc";
}

function coerceStandardType(v: unknown): StandardType {
  const s = String(v ?? "").trim() as StandardType;
  return STANDARD_TYPES.includes(s) ? s : "text";
}

function mapDepartmentRecord(rec: AirtableRecord<DepartmentFields>): SopDepartment {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    department_id: String(f.department_id ?? ""),
    name: String(f.name ?? ""),
    color: coerceSopColor(f.color),
    sort_order: coerceSortOrder(f.sort_order),
    is_active: f.is_active !== false,
    created_at: f.created_at != null ? String(f.created_at) : undefined,
  };
}

function mapRoleRecord(rec: AirtableRecord<RoleFields>): SopRole {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    role_id: String(f.role_id ?? ""),
    name: String(f.name ?? ""),
    slug: String(f.slug ?? ""),
    description: String(f.description ?? ""),
    icon: String(f.icon ?? ""),
    color: coerceSopColor(f.color),
    department_id: firstLinkedId(f.department) ?? "",
    auth_roles: coerceAuthRoles(f.auth_roles),
    assigned_user_ids: linkedRecordIds(f.assigned_users),
    academy_mode: f.academy_mode === true,
    sort_order: coerceSortOrder(f.sort_order),
    is_active: f.is_active !== false,
    created_at: f.created_at != null ? String(f.created_at) : undefined,
  };
}

function mapFunctionRecord(rec: AirtableRecord<FunctionFields>): SopFunction {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    function_id: String(f.function_id ?? ""),
    sop_role_id: firstLinkedId(f.sop_role) ?? "",
    name: String(f.name ?? ""),
    department_id: firstLinkedId(f.department) ?? "",
    kpi: String(f.kpi ?? ""),
    standard_type: coerceStandardType(f.standard_type),
    sop_content: String(f.sop_content ?? ""),
    sop_file_url: String(f.sop_file_url ?? ""),
    sop_file_name: String(f.sop_file_name ?? ""),
    loom_url: String(f.loom_url ?? ""),
    cadence_type: coerceCadenceType(f.cadence_type),
    cadence_note: String(f.cadence_note ?? ""),
    sort_order: coerceSortOrder(f.sort_order),
    is_active: f.is_active !== false,
    content_version: coerceContentVersion(f.content_version),
    estimated_minutes: coerceEstimatedMinutes(f.estimated_minutes),
    created_at: f.created_at != null ? String(f.created_at) : undefined,
  };
}

export async function getFunctionById(recordId: string): Promise<SopFunction | null> {
  const id = recordId.trim();
  if (!id) return null;
  try {
    const rec = await getRecord<FunctionFields>(SOP_FUNCTIONS_TABLE, id);
    return mapFunctionRecord(rec);
  } catch {
    return null;
  }
}

// ── Departments ──

export async function getAllSopDepartments(): Promise<SopDepartment[]> {
  const rows = await listAllRecords<DepartmentFields>(SOP_DEPARTMENTS_TABLE, {
    filterByFormula: "{is_active}",
    sort: SORT,
    _caller: "getAllSopDepartments",
  });
  return rows.map(mapDepartmentRecord);
}

export async function getAllSopDepartmentsAdmin(): Promise<SopDepartment[]> {
  const rows = await listAllRecords<DepartmentFields>(SOP_DEPARTMENTS_TABLE, {
    sort: SORT,
    _caller: "getAllSopDepartmentsAdmin",
  });
  return rows.map(mapDepartmentRecord);
}

export async function createSopDepartment(
  data: Omit<SopDepartment, "id" | "department_id" | "created_at">
): Promise<SopDepartment> {
  const fields: Record<string, unknown> = {
    department_id: genStableId("sop_dept"),
    name: data.name,
    color: data.color,
    sort_order: data.sort_order,
    is_active: data.is_active,
    created_at: new Date().toISOString(),
  };
  const rec = await createRecord<DepartmentFields>(SOP_DEPARTMENTS_TABLE, fields);
  return mapDepartmentRecord(rec);
}

export async function updateSopDepartment(
  id: string,
  data: Partial<Omit<SopDepartment, "id" | "department_id">>
): Promise<SopDepartment> {
  const fields: Record<string, unknown> = {};
  if (data.name !== undefined) fields.name = data.name;
  if (data.color !== undefined) fields.color = data.color;
  if (data.sort_order !== undefined) fields.sort_order = data.sort_order;
  if (data.is_active !== undefined) fields.is_active = data.is_active;
  if (data.created_at !== undefined) fields.created_at = data.created_at;
  const rec = await updateRecord<DepartmentFields>(SOP_DEPARTMENTS_TABLE, id, fields);
  return mapDepartmentRecord(rec);
}

export async function deleteSopDepartment(id: string): Promise<void> {
  await deleteRecord(SOP_DEPARTMENTS_TABLE, id);
}

export async function reorderDepartments(orderedIds: string[]): Promise<void> {
  const updates = orderedIds.map((recordId, index) => ({
    id: recordId,
    fields: { sort_order: index + 1 },
  }));
  await batchUpdateRecords(SOP_DEPARTMENTS_TABLE, updates);
}

// ── Roles ──

/** Active users assigned to a role (explicit links or matching auth role). */
export function getSopRoleMemberUserIds(role: SopRole, users: UserRecord[]): string[] {
  const ids = new Set<string>();
  for (const uid of role.assigned_user_ids) {
    if (uid) ids.add(uid);
  }
  for (const u of users) {
    if ((u.status ?? "").toLowerCase() === "inactive") continue;
    if (ids.has(u.id)) continue;
    const primary = u.role as SopAuthRole;
    if (role.auth_roles.includes(primary)) {
      ids.add(u.id);
      continue;
    }
    if (u.secondary_role === "virtual_assistant" && role.auth_roles.includes("virtual_assistant")) {
      ids.add(u.id);
    } else if (u.secondary_role === "chatter" && role.auth_roles.includes("chatter")) {
      ids.add(u.id);
    }
  }
  return [...ids];
}

/** Whether an active SOP role applies to the signed-in member (assigned user or auth role). */
export function sopRoleMatchesMember(
  role: SopRole,
  opts: { airtableUserId: string | null; staffRole: SopAuthRole | null }
): boolean {
  const userId = opts.airtableUserId?.trim();
  if (userId && role.assigned_user_ids.includes(userId)) return true;
  if (opts.staffRole && role.auth_roles.includes(opts.staffRole)) return true;
  return false;
}

export async function getAllSopRoles(): Promise<SopRole[]> {
  const rows = await listAllRecords<RoleFields>(SOP_ROLES_TABLE, {
    filterByFormula: "{is_active}",
    sort: SORT,
    _caller: "getAllSopRoles",
  });
  return rows.map(mapRoleRecord);
}

export async function getAllSopRolesAdmin(): Promise<SopRole[]> {
  const rows = await listAllRecords<RoleFields>(SOP_ROLES_TABLE, {
    sort: SORT,
    _caller: "getAllSopRolesAdmin",
  });
  return rows.map(mapRoleRecord);
}

export async function getSopRoleById(recordId: string): Promise<SopRole | null> {
  const id = recordId.trim();
  if (!id) return null;
  try {
    const rec = await getRecord<RoleFields>(SOP_ROLES_TABLE, id);
    return mapRoleRecord(rec);
  } catch {
    return null;
  }
}

export async function getSopRoleBySlug(slug: string): Promise<SopRole | null> {
  const normalized = slug.trim();
  if (!normalized) return null;
  const escaped = normalized.replace(/"/g, '""');
  const { records } = await listRecords<RoleFields>(SOP_ROLES_TABLE, {
    filterByFormula: `{slug} = "${escaped}"`,
    pageSize: 1,
    _caller: "getSopRoleBySlug",
  });
  const rec = records[0];
  return rec ? mapRoleRecord(rec) : null;
}

export async function createSopRole(
  data: Omit<SopRole, "id" | "role_id" | "created_at">
): Promise<SopRole> {
  const fields: Record<string, unknown> = {
    role_id: genStableId("sop_role"),
    name: data.name,
    slug: data.slug,
    description: data.description,
    icon: data.icon,
    color: data.color,
    auth_roles: data.auth_roles,
    academy_mode: data.academy_mode,
    sort_order: data.sort_order,
    is_active: data.is_active,
    created_at: new Date().toISOString(),
  };
  if (data.assigned_user_ids.length > 0) {
    fields.assigned_users = data.assigned_user_ids;
  }
  const deptLink = toLinkedRecordPayload(data.department_id || null);
  if (deptLink) fields.department = deptLink;
  const rec = await createRecord<RoleFields>(SOP_ROLES_TABLE, fields);
  return mapRoleRecord(rec);
}

export async function updateSopRole(
  id: string,
  data: Partial<Omit<SopRole, "id" | "role_id">>
): Promise<SopRole> {
  const fields: Record<string, unknown> = {};
  if (data.name !== undefined) fields.name = data.name;
  if (data.slug !== undefined) fields.slug = data.slug;
  if (data.description !== undefined) fields.description = data.description;
  if (data.icon !== undefined) fields.icon = data.icon;
  if (data.color !== undefined) fields.color = data.color;
  if (data.auth_roles !== undefined) fields.auth_roles = data.auth_roles;
  if (data.academy_mode !== undefined) fields.academy_mode = data.academy_mode;
  if (data.sort_order !== undefined) fields.sort_order = data.sort_order;
  if (data.is_active !== undefined) fields.is_active = data.is_active;
  if (data.created_at !== undefined) fields.created_at = data.created_at;
  if (data.assigned_user_ids !== undefined) {
    fields.assigned_users = data.assigned_user_ids;
  }
  if (data.department_id !== undefined) {
    fields.department = data.department_id ? [data.department_id] : [];
  }
  const rec = await updateRecord<RoleFields>(SOP_ROLES_TABLE, id, fields);
  return mapRoleRecord(rec);
}

export async function deleteSopRole(id: string): Promise<void> {
  await deleteRecord(SOP_ROLES_TABLE, id);
}

export async function reorderRoles(orderedIds: string[]): Promise<void> {
  const updates = orderedIds.map((recordId, index) => ({
    id: recordId,
    fields: { sort_order: index + 1 },
  }));
  await batchUpdateRecords(SOP_ROLES_TABLE, updates);
}

// ── Functions ──

/**
 * List active SOP functions for a role. Client-side filter on `sop_role` linked id
 * (Airtable filterByFormula on linked fields is unreliable for record ids).
 */
export async function getFunctionsByRole(roleRecordId: string): Promise<SopFunction[]> {
  const roleId = roleRecordId.trim();
  if (!roleId) return [];
  const rows = await listAllRecords<FunctionFields>(SOP_FUNCTIONS_TABLE, {
    filterByFormula: "{is_active}",
    sort: SORT,
    _caller: "getFunctionsByRole",
  });
  return rows
    .filter((rec) => firstLinkedId(rec.fields?.sop_role) === roleId)
    .map(mapFunctionRecord);
}

export async function getFunctionsByRoleAdmin(roleRecordId: string): Promise<SopFunction[]> {
  const roleId = roleRecordId.trim();
  if (!roleId) return [];
  const rows = await listAllRecords<FunctionFields>(SOP_FUNCTIONS_TABLE, {
    sort: SORT,
    _caller: "getFunctionsByRoleAdmin",
  });
  return rows
    .filter((rec) => firstLinkedId(rec.fields?.sop_role) === roleId)
    .map(mapFunctionRecord);
}

export async function createFunction(
  data: Omit<SopFunction, "id" | "function_id" | "created_at">
): Promise<SopFunction> {
  const fields: Record<string, unknown> = {
    function_id: genStableId("sop_fn"),
    name: data.name,
    kpi: data.kpi,
    standard_type: data.standard_type,
    sop_content: data.sop_content,
    sop_file_url: data.sop_file_url,
    sop_file_name: data.sop_file_name,
    loom_url: data.loom_url,
    cadence_type: data.cadence_type,
    cadence_note: data.cadence_note,
    sort_order: data.sort_order,
    is_active: data.is_active,
    content_version: data.content_version ?? 1,
    created_at: new Date().toISOString(),
  };
  if (data.estimated_minutes != null && data.estimated_minutes > 0) {
    fields.estimated_minutes = data.estimated_minutes;
  }
  const roleLink = toLinkedRecordPayload(data.sop_role_id || null);
  if (roleLink) fields.sop_role = roleLink;
  const deptLink = toLinkedRecordPayload(data.department_id || null);
  if (deptLink) fields.department = deptLink;
  const rec = await createRecord<FunctionFields>(SOP_FUNCTIONS_TABLE, fields);
  return mapFunctionRecord(rec);
}

export type UpdateFunctionOptions = Partial<Omit<SopFunction, "id" | "function_id" | "estimated_minutes">> & {
  bumpVersion?: boolean;
  estimated_minutes?: number | null;
};

export async function updateFunction(
  id: string,
  data: UpdateFunctionOptions
): Promise<SopFunction> {
  const fields: Record<string, unknown> = {};
  if (data.name !== undefined) fields.name = data.name;
  if (data.kpi !== undefined) fields.kpi = data.kpi;
  if (data.standard_type !== undefined) fields.standard_type = data.standard_type;
  if (data.sop_content !== undefined) fields.sop_content = data.sop_content;
  if (data.sop_file_url !== undefined) fields.sop_file_url = data.sop_file_url;
  if (data.sop_file_name !== undefined) fields.sop_file_name = data.sop_file_name;
  if (data.loom_url !== undefined) fields.loom_url = data.loom_url;
  if (data.cadence_type !== undefined) fields.cadence_type = data.cadence_type;
  if (data.cadence_note !== undefined) fields.cadence_note = data.cadence_note;
  if (data.sort_order !== undefined) fields.sort_order = data.sort_order;
  if (data.is_active !== undefined) fields.is_active = data.is_active;
  if (data.content_version !== undefined) fields.content_version = data.content_version;
  if (data.estimated_minutes !== undefined) {
    if (data.estimated_minutes != null && data.estimated_minutes > 0) {
      fields.estimated_minutes = data.estimated_minutes;
    }
  }
  if (data.created_at !== undefined) fields.created_at = data.created_at;
  if (data.sop_role_id !== undefined) {
    fields.sop_role = data.sop_role_id ? [data.sop_role_id] : [];
  }
  if (data.department_id !== undefined) {
    fields.department = data.department_id ? [data.department_id] : [];
  }

  if (data.bumpVersion) {
    const existing = await getFunctionById(id);
    const current = existing?.content_version ?? 1;
    fields.content_version = current + 1;
  }

  const rec = await updateRecord<FunctionFields>(SOP_FUNCTIONS_TABLE, id, fields);
  return mapFunctionRecord(rec);
}

export async function deleteFunction(id: string): Promise<void> {
  await deleteRecord(SOP_FUNCTIONS_TABLE, id);
}

export async function reorderFunctions(orderedIds: string[]): Promise<void> {
  const updates = orderedIds.map((recordId, index) => ({
    id: recordId,
    fields: { sort_order: index + 1 },
  }));
  await batchUpdateRecords(SOP_FUNCTIONS_TABLE, updates);
}
