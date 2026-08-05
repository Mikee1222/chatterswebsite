/**
 * Supabase backend for services/sops.ts (departments, roles, functions)
 */
import { normalizeAuthRoleSlugs } from "@/lib/sop-auth-roles";
import {
  firstMappedLinkedId,
  publicId,
  sbDeleteByPublicId,
  sbFirstLinkedAirtableId,
  sbInsert,
  sbResolveUuidToAirtableMap,
  sbSelectAll,
  sbSelectByPublicId,
  sbUpdateByPublicId,
  sbUuidsForAirtableIds,
  type SbRow,
} from "@/lib/supabase-data";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import type {
  CadenceType,
  SopAuthRole,
  SopColor,
  SopDepartment,
  SopFunction,
  SopRole,
  StandardType,
} from "@/types";

const DEPTS = "sop_departments";
const ROLES = "sop_roles";
const FUNCS = "sop_functions";

const SOP_COLORS: readonly SopColor[] = ["blue", "pink", "green", "orange", "purple", "gray"];
const CADENCE_TYPES: readonly CadenceType[] = ["daily", "weekly", "monthly"];
const STANDARD_TYPES: readonly StandardType[] = ["text", "file"];

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

function coerceCadenceType(v: unknown): CadenceType {
  const s = String(v ?? "").trim() as CadenceType;
  return CADENCE_TYPES.includes(s) ? s : "weekly";
}

function coerceStandardType(v: unknown): StandardType {
  const s = String(v ?? "").trim() as StandardType;
  return STANDARD_TYPES.includes(s) ? s : "text";
}

function coerceAuthRoles(v: unknown): SopAuthRole[] {
  if (!Array.isArray(v)) return [];
  return normalizeAuthRoleSlugs(v.filter((x): x is string => typeof x === "string"));
}

function coerceContentVersion(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(1, Math.floor(v));
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    if (Number.isFinite(n)) return Math.max(1, n);
  }
  return 1;
}

function genStableId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ── Departments ─────────────────────────────────────────────────────────────
type DeptRow = SbRow & {
  department_id?: string | null;
  name?: string | null;
  color?: string | null;
  sort_order?: number | string | null;
  is_active?: boolean | null;
  created_at?: string | null;
};

function mapDept(row: DeptRow): SopDepartment {
  return {
    id: publicId(row),
    department_id: String(row.department_id ?? ""),
    name: String(row.name ?? ""),
    color: coerceSopColor(row.color),
    sort_order: coerceSortOrder(row.sort_order),
    is_active: row.is_active !== false,
    created_at: row.created_at != null ? String(row.created_at) : undefined,
  };
}

export async function getAllSopDepartments(): Promise<SopDepartment[]> {
  const rows = await sbSelectAll<DeptRow>(DEPTS);
  return rows
    .map(mapDept)
    .filter((d) => d.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function getAllSopDepartmentsAdmin(): Promise<SopDepartment[]> {
  const rows = await sbSelectAll<DeptRow>(DEPTS);
  return rows.map(mapDept).sort((a, b) => a.sort_order - b.sort_order);
}

export async function createSopDepartment(
  data: Omit<SopDepartment, "id" | "department_id" | "created_at">
): Promise<SopDepartment> {
  const row = await sbInsert<DeptRow>(DEPTS, {
    department_id: genStableId("sop_dept"),
    name: data.name,
    color: data.color,
    sort_order: data.sort_order,
    is_active: data.is_active,
    created_at: new Date().toISOString(),
  });
  return mapDept(row);
}

export async function updateSopDepartment(
  id: string,
  data: Partial<Omit<SopDepartment, "id" | "department_id">>
): Promise<SopDepartment> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) patch.name = data.name;
  if (data.color !== undefined) patch.color = data.color;
  if (data.sort_order !== undefined) patch.sort_order = data.sort_order;
  if (data.is_active !== undefined) patch.is_active = data.is_active;
  if (data.created_at !== undefined) patch.created_at = data.created_at;
  const row = await sbUpdateByPublicId<DeptRow>(DEPTS, id, patch);
  return mapDept(row);
}

async function countDepartmentLinks(
  departmentId: string
): Promise<{ roles: number; functions: number }> {
  const deptId = departmentId.trim();
  const [roles, fnRows] = await Promise.all([
    getAllSopRolesAdmin(),
    sbSelectAll<FnRow>(FUNCS),
  ]);
  const roleCount = roles.filter((r) => r.department_id === deptId).length;
  const fnCount = await Promise.all(
    fnRows.map(async (f) => (await sbFirstLinkedAirtableId(DEPTS, f.department)) === deptId)
  );
  const functionCount = fnCount.filter(Boolean).length;
  return { roles: roleCount, functions: functionCount };
}

export async function getDepartmentDeleteImpact(
  departmentId: string
): Promise<{ roles: number; functions: number; blocked: boolean }> {
  const { roles, functions } = await countDepartmentLinks(departmentId);
  return { roles, functions, blocked: roles > 0 || functions > 0 };
}

export async function deleteSopDepartment(id: string): Promise<void> {
  const { roles, functions } = await countDepartmentLinks(id);
  if (roles > 0 || functions > 0) {
    const parts: string[] = [];
    if (roles > 0) parts.push(`${roles} role${roles === 1 ? "" : "s"}`);
    if (functions > 0) parts.push(`${functions} function${functions === 1 ? "" : "s"}`);
    const err = new Error(`Department in use by ${parts.join(" and ")}`);
    err.name = "SopDeleteBlockedError";
    throw err;
  }
  await sbDeleteByPublicId(DEPTS, id);
}

export async function reorderDepartments(orderedIds: string[]): Promise<void> {
  const sb = getSupabaseServiceClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const rid = orderedIds[i];
    const col = rid.startsWith("rec") ? "airtable_id" : "id";
    await sb.from(DEPTS).update({ sort_order: i + 1, updated_at: new Date().toISOString() }).eq(col, rid);
  }
}

// ── Roles ───────────────────────────────────────────────────────────────────
type RoleRow = SbRow & {
  role_id?: string | null;
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  department?: string[] | null;
  auth_roles?: string[] | null;
  assigned_users?: string[] | null;
  academy_mode?: boolean | null;
  sort_order?: number | string | null;
  is_active?: boolean | null;
  created_at?: string | null;
};

async function mapRoles(rows: RoleRow[]): Promise<SopRole[]> {
  if (!rows.length) return [];
  const deptAt = await sbResolveUuidToAirtableMap(DEPTS, rows.map((r) => r.department));
  return rows.map((row) => ({
    id: publicId(row),
    role_id: String(row.role_id ?? ""),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    description: String(row.description ?? ""),
    icon: String(row.icon ?? ""),
    color: coerceSopColor(row.color),
    department_id: firstMappedLinkedId(row.department, deptAt),
    auth_roles: coerceAuthRoles(row.auth_roles),
    assigned_user_ids: Array.isArray(row.assigned_users) ? row.assigned_users.map(String) : [],
    academy_mode: row.academy_mode === true,
    sort_order: coerceSortOrder(row.sort_order),
    is_active: row.is_active !== false,
    created_at: row.created_at != null ? String(row.created_at) : undefined,
  }));
}

async function mapRole(row: RoleRow): Promise<SopRole> {
  const [mapped] = await mapRoles([row]);
  return mapped!;
}

export async function getAllSopRoles(): Promise<SopRole[]> {
  const rows = await sbSelectAll<RoleRow>(ROLES);
  const mapped = await mapRoles(rows);
  return mapped.filter((r) => r.is_active).sort((a, b) => a.sort_order - b.sort_order);
}

export async function getAllSopRolesAdmin(): Promise<SopRole[]> {
  const rows = await sbSelectAll<RoleRow>(ROLES);
  const mapped = await mapRoles(rows);
  return mapped.sort((a, b) => a.sort_order - b.sort_order);
}

export async function getSopRoleById(recordId: string): Promise<SopRole | null> {
  const id = recordId.trim();
  if (!id) return null;
  const row = await sbSelectByPublicId<RoleRow>(ROLES, id);
  return row ? mapRole(row) : null;
}

export async function getSopRoleBySlug(slug: string): Promise<SopRole | null> {
  const s = slug.trim();
  if (!s) return null;
  const rows = await sbSelectAll<RoleRow>(ROLES);
  const hit = rows.find((r) => String(r.slug ?? "").trim() === s);
  return hit ? mapRole(hit) : null;
}

export async function createSopRole(
  data: Omit<SopRole, "id" | "role_id" | "created_at">
): Promise<SopRole> {
  const auth_roles = normalizeAuthRoleSlugs(data.auth_roles);
  const deptUuids =
    data.department_id ? await sbUuidsForAirtableIds(DEPTS, [data.department_id]) : [];
  const row = await sbInsert<RoleRow>(ROLES, {
    role_id: genStableId("sop_role"),
    name: data.name,
    slug: data.slug,
    description: data.description,
    icon: data.icon,
    color: data.color,
    department: deptUuids,
    auth_roles,
    academy_mode: data.academy_mode,
    assigned_users: data.assigned_user_ids ?? [],
    sort_order: data.sort_order,
    is_active: data.is_active,
    created_at: new Date().toISOString(),
  });
  return mapRole(row);
}

export async function updateSopRole(
  id: string,
  data: Partial<Omit<SopRole, "id" | "role_id">>
): Promise<SopRole> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) patch.name = data.name;
  if (data.slug !== undefined) patch.slug = data.slug;
  if (data.description !== undefined) patch.description = data.description;
  if (data.icon !== undefined) patch.icon = data.icon;
  if (data.color !== undefined) patch.color = data.color;
  if (data.auth_roles !== undefined) patch.auth_roles = normalizeAuthRoleSlugs(data.auth_roles);
  if (data.academy_mode !== undefined) patch.academy_mode = data.academy_mode;
  if (data.sort_order !== undefined) patch.sort_order = data.sort_order;
  if (data.is_active !== undefined) patch.is_active = data.is_active;
  if (data.created_at !== undefined) patch.created_at = data.created_at;
  if (data.assigned_user_ids !== undefined) patch.assigned_users = data.assigned_user_ids;
  if (data.department_id !== undefined) {
    patch.department = data.department_id
      ? await sbUuidsForAirtableIds(DEPTS, [data.department_id])
      : [];
  }
  const row = await sbUpdateByPublicId<RoleRow>(ROLES, id, patch);
  return mapRole(row);
}

export async function getRoleDeleteImpact(roleId: string): Promise<{
  functions: number;
  progress: number;
  signoffs: number;
  feedback: number;
  quiz_questions: number;
}> {
  const id = roleId.trim();
  const { countProgressByRole } = await import("@/services/sop-progress");
  const { countSignoffsByRole } = await import("@/services/sop-signoff");
  const { countFeedbackByRole } = await import("@/services/sop-feedback");
  const { countQuizQuestionsByFunction } = await import("@/services/sop-quiz");
  const [functions, progress, signoffs, feedback] = await Promise.all([
    getFunctionsByRoleAdmin(id),
    countProgressByRole(id),
    countSignoffsByRole(id),
    countFeedbackByRole(id),
  ]);
  let quiz_questions = 0;
  for (const fn of functions) quiz_questions += await countQuizQuestionsByFunction(fn.id);
  return { functions: functions.length, progress, signoffs, feedback, quiz_questions };
}

export async function deleteSopRole(id: string): Promise<void> {
  const roleId = id.trim();
  const { deleteProgressByRole } = await import("@/services/sop-progress");
  const { deleteSignoffsByRole } = await import("@/services/sop-signoff");
  const { deleteFeedbackByRole } = await import("@/services/sop-feedback");
  const functions = await getFunctionsByRoleAdmin(roleId);
  for (const fn of functions) await deleteFunction(fn.id);
  await deleteProgressByRole(roleId);
  await deleteSignoffsByRole(roleId);
  await deleteFeedbackByRole(roleId);
  await sbDeleteByPublicId(ROLES, roleId);
}

export async function reorderRoles(orderedIds: string[]): Promise<void> {
  const sb = getSupabaseServiceClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const rid = orderedIds[i];
    const col = rid.startsWith("rec") ? "airtable_id" : "id";
    await sb.from(ROLES).update({ sort_order: i + 1, updated_at: new Date().toISOString() }).eq(col, rid);
  }
}

// ── Functions ───────────────────────────────────────────────────────────────
type FnRow = SbRow & {
  function_id?: string | null;
  sop_role?: string[] | null;
  name?: string | null;
  department?: string[] | null;
  kpi?: string | null;
  standard_type?: string | null;
  sop_content?: string | null;
  sop_file_url?: string | null;
  sop_file_name?: string | null;
  loom_url?: string | null;
  cadence_type?: string | null;
  cadence_note?: string | null;
  sort_order?: number | string | null;
  is_active?: boolean | null;
  content_version?: number | string | null;
  created_at?: string | null;
};

async function mapFns(rows: FnRow[]): Promise<SopFunction[]> {
  if (!rows.length) return [];
  const [roleAt, deptAt] = await Promise.all([
    sbResolveUuidToAirtableMap(ROLES, rows.map((r) => r.sop_role)),
    sbResolveUuidToAirtableMap(DEPTS, rows.map((r) => r.department)),
  ]);
  const { resolveStorageUrl } = await import("@/lib/supabase-signed-url");
  return Promise.all(
    rows.map(async (row) => ({
      id: publicId(row),
      function_id: String(row.function_id ?? ""),
      sop_role_id: firstMappedLinkedId(row.sop_role, roleAt),
      name: String(row.name ?? ""),
      department_id: firstMappedLinkedId(row.department, deptAt),
      kpi: String(row.kpi ?? ""),
      standard_type: coerceStandardType(row.standard_type),
      sop_content: String(row.sop_content ?? ""),
      sop_file_url: await resolveStorageUrl(String(row.sop_file_url ?? "")),
      sop_file_name: String(row.sop_file_name ?? ""),
      loom_url: String(row.loom_url ?? ""),
      cadence_type: coerceCadenceType(row.cadence_type),
      cadence_note: String(row.cadence_note ?? ""),
      sort_order: coerceSortOrder(row.sort_order),
      is_active: row.is_active !== false,
      content_version: coerceContentVersion(row.content_version),
      created_at: row.created_at != null ? String(row.created_at) : undefined,
    }))
  );
}

async function mapFn(row: FnRow): Promise<SopFunction> {
  const [mapped] = await mapFns([row]);
  return mapped!;
}

export async function getFunctionById(recordId: string): Promise<SopFunction | null> {
  const id = recordId.trim();
  if (!id) return null;
  const row = await sbSelectByPublicId<FnRow>(FUNCS, id);
  return row ? mapFn(row) : null;
}

export async function getFunctionsByRole(roleRecordId: string): Promise<SopFunction[]> {
  const id = roleRecordId.trim();
  if (!id) return [];
  const rows = await sbSelectAll<FnRow>(FUNCS);
  const mapped = await mapFns(rows);
  return mapped
    .filter((f) => f.is_active && f.sop_role_id === id)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function getFunctionsByRoleAdmin(roleRecordId: string): Promise<SopFunction[]> {
  const id = roleRecordId.trim();
  if (!id) return [];
  const rows = await sbSelectAll<FnRow>(FUNCS);
  const mapped = await mapFns(rows);
  return mapped.filter((f) => f.sop_role_id === id).sort((a, b) => a.sort_order - b.sort_order);
}

async function departmentUuidsFromRoleId(roleAirtableId: string): Promise<string[]> {
  const role = await getSopRoleById(roleAirtableId);
  const deptId = role?.department_id?.trim() ?? "";
  return deptId ? sbUuidsForAirtableIds(DEPTS, [deptId]) : [];
}

export async function createFunction(
  data: Omit<SopFunction, "id" | "function_id" | "created_at" | "department_id"> & {
    department_id?: string;
  }
): Promise<SopFunction> {
  const [roleUuids, deptUuids] = await Promise.all([
    data.sop_role_id ? sbUuidsForAirtableIds(ROLES, [data.sop_role_id]) : Promise.resolve([]),
    departmentUuidsFromRoleId(data.sop_role_id ?? ""),
  ]);
  const row = await sbInsert<FnRow>(FUNCS, {
    function_id: genStableId("sop_fn"),
    sop_role: roleUuids,
    name: data.name,
    department: deptUuids,
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
  });
  return mapFn(row);
}

export type UpdateFunctionOptions = Partial<Omit<SopFunction, "id" | "function_id">> & {
  bumpVersion?: boolean;
};

export async function updateFunction(id: string, data: UpdateFunctionOptions): Promise<SopFunction> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) patch.name = data.name;
  if (data.kpi !== undefined) patch.kpi = data.kpi;
  if (data.standard_type !== undefined) patch.standard_type = data.standard_type;
  if (data.sop_content !== undefined) patch.sop_content = data.sop_content;
  if (data.sop_file_url !== undefined) patch.sop_file_url = data.sop_file_url;
  if (data.sop_file_name !== undefined) patch.sop_file_name = data.sop_file_name;
  if (data.loom_url !== undefined) patch.loom_url = data.loom_url;
  if (data.cadence_type !== undefined) patch.cadence_type = data.cadence_type;
  if (data.cadence_note !== undefined) patch.cadence_note = data.cadence_note;
  if (data.sort_order !== undefined) patch.sort_order = data.sort_order;
  if (data.is_active !== undefined) patch.is_active = data.is_active;
  if (data.content_version !== undefined) patch.content_version = data.content_version;
  if (data.created_at !== undefined) patch.created_at = data.created_at;
  if (data.sop_role_id !== undefined) {
    patch.sop_role = data.sop_role_id ? await sbUuidsForAirtableIds(ROLES, [data.sop_role_id]) : [];
  }
  const roleIdForDept =
    data.sop_role_id !== undefined
      ? data.sop_role_id
      : ((await getFunctionById(id))?.sop_role_id ?? "");
  patch.department = await departmentUuidsFromRoleId(roleIdForDept);

  if (data.bumpVersion) {
    const existing = await getFunctionById(id);
    const current = existing?.content_version ?? 1;
    patch.content_version = current + 1;
  }
  const row = await sbUpdateByPublicId<FnRow>(FUNCS, id, patch);
  return mapFn(row);
}

export async function getFunctionDeleteImpact(functionId: string): Promise<{
  functions: number;
  progress: number;
  signoffs: number;
  feedback: number;
  quiz_questions: number;
}> {
  const id = functionId.trim();
  const { countProgressByFunction } = await import("@/services/sop-progress");
  const { countFeedbackByFunction } = await import("@/services/sop-feedback");
  const { countQuizQuestionsByFunction } = await import("@/services/sop-quiz");
  const [progress, feedback, quiz_questions] = await Promise.all([
    countProgressByFunction(id),
    countFeedbackByFunction(id),
    countQuizQuestionsByFunction(id),
  ]);
  return { functions: 0, progress, signoffs: 0, feedback, quiz_questions };
}

export async function deleteFunction(id: string): Promise<void> {
  const functionId = id.trim();
  const { deleteProgressByFunction } = await import("@/services/sop-progress");
  const { deleteFeedbackByFunction } = await import("@/services/sop-feedback");
  const { deleteQuizQuestionsByFunction } = await import("@/services/sop-quiz");
  await deleteQuizQuestionsByFunction(functionId);
  await deleteProgressByFunction(functionId);
  await deleteFeedbackByFunction(functionId);
  await sbDeleteByPublicId(FUNCS, functionId);
}

export async function reorderFunctions(orderedIds: string[]): Promise<void> {
  const sb = getSupabaseServiceClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const rid = orderedIds[i];
    const col = rid.startsWith("rec") ? "airtable_id" : "id";
    await sb.from(FUNCS).update({ sort_order: i + 1, updated_at: new Date().toISOString() }).eq(col, rid);
  }
}
