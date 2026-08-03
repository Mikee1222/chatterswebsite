/**
 * Supabase backend for services/marketing.ts (DATA_BACKEND=supabase).
 * Public ids remain Airtable-shaped (airtable_id) during dual-run.
 */

import { joinPhoneFileLinks, parsePhoneFileLinks } from "@/lib/marketing-helpers";
import { deriveShadowbanReportType } from "@/lib/shadowban-helpers";
import {
  publicId,
  sbDeleteByPublicId,
  sbFirstLinkedAirtableId,
  sbInsert,
  sbSelectAll,
  sbSelectByPublicId,
  sbSelectEq,
  sbUpdateByPublicId,
  sbUuidsForAirtableIds,
  type SbRow,
} from "@/lib/supabase-data";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { resolveStorageUrl, uploadToPrivateStorage, urlsToAttachments } from "@/lib/supabase-signed-url";
import { listAllUsers } from "@/services/users";

// Local mirror of marketing.ts public types (avoid importing "use server" module).
export type SocialAccountStatus = "active" | "shadowbanned" | "banned";
export type ShadowbanReportStatus = "pending" | "approved" | "dismissed";

export type PhonePhoto = { url: string; filename?: string };

export type SocialAccount = {
  id: string;
  account_id: string;
  model_id: string;
  model_name: string;
  platform: string;
  account_link: string;
  username: string;
  account_type: "main" | "secondary";
  region: "USA" | "Greek" | "Global";
  assigned_va_id: string;
  assigned_va_name: string;
  notes: string;
  active: boolean;
  last_updated: string;
  created_at: string;
  account_status: SocialAccountStatus;
  shadowban_reported_at: string | null;
  shadowban_reported_by: string;
  shadowban_screenshot: { url: string }[];
  password: string;
  linked_phone_id: string;
  linked_phone_name: string;
};

export type Phone = {
  id: string;
  device_name: string;
  icloud_email: string;
  icloud_password: string;
  recovery_email: string;
  recovery_phone: string;
  assigned_va_id: string;
  assigned_va_name: string;
  phone_photos: PhonePhoto[];
  notes: string;
  file_links: string[];
  active: boolean;
  created_at: string;
  linked_account_count: number;
};

export type PhoneDetail = Phone & { linked_accounts: SocialAccount[] };

export type ShadowbanReport = {
  id: string;
  report_id: string;
  account_id: string;
  model_id: string;
  model_name: string;
  platform: string;
  username: string;
  reported_by_id: string;
  reported_by_name: string;
  reported_by_role: string;
  report_type: import("@/lib/shadowban-helpers").ShadowbanReportType;
  screenshot: { url: string }[];
  notes: string;
  status: ShadowbanReportStatus;
  reviewed_by: string;
  created_at: string;
  reviewed_at: string | null;
};

export type FunnelLink = {
  id: string;
  funnel_id: string;
  model_id: string;
  model_name: string;
  label: string;
  url: string;
  platform: string;
  region: "USA" | "Greek" | "Global";
  active: boolean;
  created_at: string;
};

export type MarketingPlatform = {
  id: string;
  platform_id: string;
  name: string;
  icon: string;
  color: string;
  active: boolean;
  sort_order: number;
};

const T_PLATFORMS = "marketing_platforms";
const T_ACCOUNTS = "model_social_accounts";
const T_FUNNELS = "model_funnel_links";
const T_SHADOWBAN = "shadowban_reports";
const T_PHONES = "marketing_phones";

type PlatformRow = SbRow & {
  platform_id?: string | null;
  name?: string | null;
  icon?: string | null;
  color?: string | null;
  active?: boolean | null;
  sort_order?: number | null;
  created_at?: string | null;
};

type AccountRow = SbRow & {
  account_id?: string | null;
  model_id?: string | null;
  model_name?: string | null;
  platform?: string | null;
  account_link?: string | null;
  username?: string | null;
  account_type?: string | null;
  region?: string | null;
  assigned_va_id?: string | null;
  assigned_va_name?: string | null;
  notes?: string | null;
  active?: boolean | null;
  last_updated?: string | null;
  created_at?: string | null;
  account_status?: string | null;
  shadowban_reported_at?: string | null;
  shadowban_reported_by?: string | null;
  shadowban_screenshot?: string[] | null;
  account_password?: string | null;
  linked_phone?: string[] | null;
};

type PhoneRow = SbRow & {
  device_name?: string | null;
  icloud_email?: string | null;
  icloud_password?: string | null;
  recovery_email?: string | null;
  recovery_phone?: string | null;
  assigned_va?: string[] | null;
  phone_photos?: string[] | null;
  notes?: string | null;
  active?: boolean | null;
  created_at?: string | null;
  file_links?: string | null;
};

type ShadowbanRow = SbRow & {
  report_id?: string | null;
  account_id?: string | null;
  model_id?: string | null;
  model_name?: string | null;
  platform?: string | null;
  username?: string | null;
  reported_by_id?: string | null;
  reported_by_name?: string | null;
  reported_by_role?: string | null;
  report_type?: string | null;
  screenshot?: string[] | null;
  notes?: string | null;
  status?: string | null;
  reviewed_by?: string | null;
  created_at?: string | null;
  reviewed_at?: string | null;
};

type FunnelRow = SbRow & {
  funnel_id?: string | null;
  model_id?: string | null;
  model_name?: string | null;
  label?: string | null;
  url?: string | null;
  platform?: string | null;
  region?: string | null;
  active?: boolean | null;
  created_at?: string | null;
};

function asAccountStatus(v: unknown): SocialAccountStatus {
  if (v === "shadowbanned" || v === "banned") return v;
  return "active";
}

function asShadowbanReportStatus(v: unknown): ShadowbanReportStatus {
  if (v === "approved" || v === "dismissed") return v;
  return "pending";
}

function mapPlatform(row: PlatformRow): MarketingPlatform {
  return {
    id: publicId(row),
    platform_id: row.platform_id ?? publicId(row),
    name: row.name ?? "",
    icon: row.icon ?? "",
    color: row.color ?? "#888888",
    active: row.active !== false,
    sort_order: typeof row.sort_order === "number" ? Number(row.sort_order) : Number(row.sort_order) || 0,
  };
}

async function mapAccount(row: AccountRow, phoneNameById?: Record<string, string>): Promise<SocialAccount> {
  const at = row.account_type === "secondary" ? "secondary" : "main";
  const reg = row.region === "USA" || row.region === "Greek" ? row.region : "Global";
  const linkedPhoneId = (await sbFirstLinkedAirtableId(T_PHONES, row.linked_phone)) ?? "";
  const screenshots = await urlsToAttachments(row.shadowban_screenshot);
  return {
    id: publicId(row),
    account_id: row.account_id ?? publicId(row),
    model_id: row.model_id ?? "",
    model_name: row.model_name ?? "",
    platform: row.platform ?? "",
    account_link: row.account_link ?? "",
    username: row.username ?? "",
    account_type: at,
    region: reg,
    assigned_va_id: row.assigned_va_id ?? "",
    assigned_va_name: row.assigned_va_name ?? "",
    notes: row.notes ?? "",
    active: row.active !== false,
    last_updated: row.last_updated ?? "",
    created_at: row.created_at ?? "",
    account_status: asAccountStatus(row.account_status),
    shadowban_reported_at: row.shadowban_reported_at ?? null,
    shadowban_reported_by: row.shadowban_reported_by ?? "",
    shadowban_screenshot: screenshots.map((a) => ({ url: a.url })),
    password: row.account_password ?? "",
    linked_phone_id: linkedPhoneId,
    linked_phone_name: linkedPhoneId ? (phoneNameById?.[linkedPhoneId] ?? "") : "",
  };
}

async function mapPhone(
  row: PhoneRow,
  vaNameById: Record<string, string>,
  linkedCount: number
): Promise<Phone> {
  const assignedVaId = (await sbFirstLinkedAirtableId("users", row.assigned_va)) ?? "";
  const photosRaw = await urlsToAttachments(row.phone_photos);
  const phone_photos: PhonePhoto[] = photosRaw.map((p) => ({
    url: p.url,
    ...(p.filename ? { filename: p.filename } : {}),
  }));
  return {
    id: publicId(row),
    device_name: row.device_name ?? "",
    icloud_email: row.icloud_email ?? "",
    icloud_password: row.icloud_password ?? "",
    recovery_email: row.recovery_email ?? "",
    recovery_phone: row.recovery_phone ?? "",
    assigned_va_id: assignedVaId,
    assigned_va_name: assignedVaId ? (vaNameById[assignedVaId] ?? "") : "",
    phone_photos,
    notes: row.notes ?? "",
    file_links: parsePhoneFileLinks(row.file_links),
    active: row.active !== false,
    created_at: row.created_at ?? "",
    linked_account_count: linkedCount,
  };
}

async function mapShadowbanReport(row: ShadowbanRow): Promise<ShadowbanReport> {
  const screenshots = await urlsToAttachments(row.screenshot);
  return {
    id: publicId(row),
    report_id: row.report_id ?? publicId(row),
    account_id: row.account_id ?? "",
    model_id: row.model_id ?? "",
    model_name: row.model_name ?? "",
    platform: row.platform ?? "",
    username: row.username ?? "",
    reported_by_id: row.reported_by_id ?? "",
    reported_by_name: row.reported_by_name ?? "",
    reported_by_role: row.reported_by_role ?? "",
    report_type: deriveShadowbanReportType({
      report_type: row.report_type ?? undefined,
      notes: row.notes ?? undefined,
    }),
    screenshot: screenshots.map((a) => ({ url: a.url })),
    notes: row.notes ?? "",
    status: asShadowbanReportStatus(row.status),
    reviewed_by: row.reviewed_by ?? "",
    created_at: row.created_at ?? "",
    reviewed_at: row.reviewed_at ?? null,
  };
}

function mapFunnel(row: FunnelRow): FunnelLink {
  const reg = row.region === "USA" || row.region === "Greek" ? row.region : "Global";
  return {
    id: publicId(row),
    funnel_id: row.funnel_id ?? publicId(row),
    model_id: row.model_id ?? "",
    model_name: row.model_name ?? "",
    label: row.label ?? "",
    url: row.url ?? "",
    platform: row.platform ?? "",
    region: reg,
    active: row.active !== false,
    created_at: row.created_at ?? "",
  };
}

async function buildPhoneNameById(): Promise<Record<string, string>> {
  const rows = await sbSelectAll<PhoneRow>(T_PHONES);
  const out: Record<string, string> = {};
  for (const row of rows) {
    const name = row.device_name ?? "";
    if (name) out[publicId(row)] = name;
  }
  return out;
}

async function buildVaNameById(): Promise<Record<string, string>> {
  const users = await listAllUsers();
  const out: Record<string, string> = {};
  for (const u of users) {
    out[u.id] = u.full_name?.trim() || u.email || u.id;
  }
  return out;
}

function countAccountsByPhoneId(accounts: SocialAccount[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const a of accounts) {
    if (!a.linked_phone_id) continue;
    counts[a.linked_phone_id] = (counts[a.linked_phone_id] ?? 0) + 1;
  }
  return counts;
}

export async function getPlatforms(): Promise<MarketingPlatform[]> {
  const rows = await sbSelectAll<PlatformRow>(T_PLATFORMS);
  return rows
    .filter((r) => r.active !== false)
    .map(mapPlatform)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function getAllPlatforms(): Promise<MarketingPlatform[]> {
  const rows = await sbSelectAll<PlatformRow>(T_PLATFORMS);
  return rows.map(mapPlatform).sort((a, b) => a.sort_order - b.sort_order);
}

export async function createPlatform(data: Partial<MarketingPlatform>): Promise<MarketingPlatform> {
  const now = new Date().toISOString();
  const row = await sbInsert<PlatformRow>(T_PLATFORMS, {
    platform_id: `plt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: data.name ?? "",
    icon: data.icon ?? "",
    color: data.color ?? "#888888",
    active: true,
    sort_order: data.sort_order ?? 99,
    created_at: now,
  });
  return mapPlatform(row);
}

export async function updatePlatform(id: string, data: Partial<MarketingPlatform>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.icon !== undefined) patch.icon = data.icon;
  if (data.color !== undefined) patch.color = data.color;
  if (data.active !== undefined) patch.active = data.active;
  if (data.sort_order !== undefined) patch.sort_order = data.sort_order;
  if (Object.keys(patch).length === 0) return;
  await sbUpdateByPublicId(T_PLATFORMS, id, patch);
}

export async function getAllAccounts(): Promise<SocialAccount[]> {
  const [rows, phoneNameById] = await Promise.all([
    sbSelectAll<AccountRow>(T_ACCOUNTS),
    buildPhoneNameById(),
  ]);
  const mapped = await Promise.all(rows.map((r) => mapAccount(r, phoneNameById)));
  return mapped.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
}

export async function getAccountByAccountId(accountId: string): Promise<SocialAccount | null> {
  const aid = accountId.trim();
  if (!aid) return null;
  const rows = await sbSelectEq<AccountRow>(T_ACCOUNTS, "account_id", aid, "*", 1);
  if (!rows[0]) return null;
  const phoneNameById = await buildPhoneNameById();
  return mapAccount(rows[0], phoneNameById);
}

export async function getAccountsByModel(modelId: string): Promise<SocialAccount[]> {
  const mid = modelId.trim();
  if (!mid) return [];
  const rows = await sbSelectEq<AccountRow>(T_ACCOUNTS, "model_id", mid);
  const phoneNameById = await buildPhoneNameById();
  const mapped = await Promise.all(
    rows.filter((r) => r.active !== false).map((r) => mapAccount(r, phoneNameById))
  );
  return mapped.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
}

export async function getAccountsByVA(vaId: string): Promise<SocialAccount[]> {
  const vid = vaId.trim();
  if (!vid) return [];
  const rows = await sbSelectEq<AccountRow>(T_ACCOUNTS, "assigned_va_id", vid);
  const phoneNameById = await buildPhoneNameById();
  const mapped = await Promise.all(
    rows.filter((r) => r.active !== false).map((r) => mapAccount(r, phoneNameById))
  );
  return mapped.sort((a, b) => a.model_name.localeCompare(b.model_name));
}

export async function createAccount(data: Partial<SocialAccount>): Promise<SocialAccount> {
  const now = new Date().toISOString();
  const linkedPhone = data.linked_phone_id
    ? await sbUuidsForAirtableIds(T_PHONES, [data.linked_phone_id])
    : [];
  const row = await sbInsert<AccountRow>(T_ACCOUNTS, {
    account_id: `acc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    model_id: data.model_id,
    model_name: data.model_name,
    platform: data.platform,
    account_link: data.account_link,
    username: data.username,
    account_type: data.account_type ?? "main",
    region: data.region ?? "Global",
    assigned_va_id: data.assigned_va_id ?? "",
    assigned_va_name: data.assigned_va_name ?? "",
    notes: data.notes ?? "",
    active: true,
    account_status: data.account_status ?? "active",
    last_updated: now,
    created_at: now,
    ...(data.password ? { account_password: data.password } : {}),
    ...(linkedPhone.length ? { linked_phone: linkedPhone } : {}),
  });
  const phoneNameById = await buildPhoneNameById();
  return mapAccount(row, phoneNameById);
}

export async function updateAccount(id: string, data: Partial<SocialAccount>): Promise<void> {
  const patch: Record<string, unknown> = { last_updated: new Date().toISOString() };
  if (data.model_id !== undefined) patch.model_id = data.model_id;
  if (data.model_name !== undefined) patch.model_name = data.model_name;
  if (data.platform !== undefined) patch.platform = data.platform;
  if (data.account_link !== undefined) patch.account_link = data.account_link;
  if (data.username !== undefined) patch.username = data.username;
  if (data.account_type !== undefined) patch.account_type = data.account_type;
  if (data.region !== undefined) patch.region = data.region;
  if (data.assigned_va_id !== undefined) patch.assigned_va_id = data.assigned_va_id;
  if (data.assigned_va_name !== undefined) patch.assigned_va_name = data.assigned_va_name;
  if (data.notes !== undefined) patch.notes = data.notes;
  if (data.active !== undefined) patch.active = data.active;
  if (data.account_status !== undefined) patch.account_status = data.account_status;
  if (data.shadowban_reported_at !== undefined) patch.shadowban_reported_at = data.shadowban_reported_at;
  if (data.shadowban_reported_by !== undefined) patch.shadowban_reported_by = data.shadowban_reported_by;
  if (data.shadowban_screenshot !== undefined) {
    // Store durable tokens / https urls only (no Airtable attachment objects)
    patch.shadowban_screenshot = data.shadowban_screenshot.map((a) => a.url).filter(Boolean);
  }
  if (data.password !== undefined) patch.account_password = data.password;
  if (data.linked_phone_id !== undefined) {
    patch.linked_phone = data.linked_phone_id
      ? await sbUuidsForAirtableIds(T_PHONES, [data.linked_phone_id])
      : [];
  }
  await sbUpdateByPublicId(T_ACCOUNTS, id, patch);
}

export async function deleteAccount(id: string): Promise<void> {
  await sbUpdateByPublicId(T_ACCOUNTS, id, {
    active: false,
    last_updated: new Date().toISOString(),
  });
}

export async function getPhones(preloadedAccounts?: SocialAccount[]): Promise<Phone[]> {
  const [phoneRows, accounts, vaNameById] = await Promise.all([
    sbSelectAll<PhoneRow>(T_PHONES),
    preloadedAccounts ? Promise.resolve(preloadedAccounts) : getAllAccounts(),
    buildVaNameById(),
  ]);
  const counts = countAccountsByPhoneId(accounts);
  const mapped = await Promise.all(
    phoneRows.map((row) => mapPhone(row, vaNameById, counts[publicId(row)] ?? 0))
  );
  return mapped.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
}

export async function getPhonesByVA(vaId: string): Promise<Phone[]> {
  const id = vaId.trim();
  if (!id) return [];
  const phones = await getPhones();
  return phones.filter((phone) => phone.assigned_va_id === id);
}

export async function getPhoneDetail(phoneId: string): Promise<PhoneDetail | null> {
  const [row, accounts, vaNameById] = await Promise.all([
    sbSelectByPublicId<PhoneRow>(T_PHONES, phoneId),
    getAllAccounts(),
    buildVaNameById(),
  ]);
  if (!row) return null;
  const pid = publicId(row);
  const linked = accounts.filter((a) => a.linked_phone_id === pid);
  const phone = await mapPhone(row, vaNameById, linked.length);
  return { ...phone, linked_accounts: linked };
}

export async function createPhone(data: Partial<Phone>): Promise<Phone> {
  const now = new Date().toISOString();
  const assignedVa = data.assigned_va_id
    ? await sbUuidsForAirtableIds("users", [data.assigned_va_id])
    : [];
  const row = await sbInsert<PhoneRow>(T_PHONES, {
    device_name: data.device_name ?? "",
    icloud_email: data.icloud_email ?? "",
    icloud_password: data.icloud_password ?? "",
    recovery_email: data.recovery_email ?? "",
    recovery_phone: data.recovery_phone ?? "",
    notes: data.notes ?? "",
    active: data.active !== false,
    created_at: now,
    ...(data.file_links !== undefined ? { file_links: joinPhoneFileLinks(data.file_links) } : {}),
    ...(assignedVa.length ? { assigned_va: assignedVa } : {}),
  });
  const vaNameById = await buildVaNameById();
  return mapPhone(row, vaNameById, 0);
}

export async function updatePhone(id: string, data: Partial<Phone>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (data.device_name !== undefined) patch.device_name = data.device_name;
  if (data.icloud_email !== undefined) patch.icloud_email = data.icloud_email;
  if (data.icloud_password !== undefined) patch.icloud_password = data.icloud_password;
  if (data.recovery_email !== undefined) patch.recovery_email = data.recovery_email;
  if (data.recovery_phone !== undefined) patch.recovery_phone = data.recovery_phone;
  if (data.notes !== undefined) patch.notes = data.notes;
  if (data.file_links !== undefined) patch.file_links = joinPhoneFileLinks(data.file_links);
  if (data.active !== undefined) patch.active = data.active;
  if (data.assigned_va_id !== undefined) {
    patch.assigned_va = data.assigned_va_id
      ? await sbUuidsForAirtableIds("users", [data.assigned_va_id])
      : [];
  }
  if (Object.keys(patch).length === 0) return;
  await sbUpdateByPublicId(T_PHONES, id, patch);
}

export async function uploadPhonePhotos(
  phoneId: string,
  files: Array<{ name: string; type: string; bytes: Uint8Array }>
): Promise<void> {
  const row = await sbSelectByPublicId<PhoneRow>(T_PHONES, phoneId);
  if (!row) throw new Error("Phone not found");
  const existing = [...(row.phone_photos ?? [])];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file.bytes.byteLength) continue;
    const ext = (file.name.split(".").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "");
    const token = await uploadToPrivateStorage({
      bucket: "attachments",
      objectPath: `marketing_phones/${row.airtable_id || row.id}/phone_photos/${Date.now()}_${i}.${ext}`,
      bytes: file.bytes,
      contentType: file.type || "image/jpeg",
    });
    existing.push(token);
  }
  await sbUpdateByPublicId(T_PHONES, phoneId, { phone_photos: existing });
}

export async function unlinkAccountFromPhone(accountId: string): Promise<void> {
  await sbUpdateByPublicId(T_ACCOUNTS, accountId, {
    linked_phone: [],
    last_updated: new Date().toISOString(),
  });
}

export async function deletePhone(id: string): Promise<void> {
  const accounts = await getAllAccounts();
  const linked = accounts.filter((a) => a.linked_phone_id === id);
  await Promise.all(linked.map((a) => unlinkAccountFromPhone(a.id)));
  await sbDeleteByPublicId(T_PHONES, id);
}

export async function getPendingShadowbanReports(): Promise<ShadowbanReport[]> {
  const rows = await sbSelectEq<ShadowbanRow>(T_SHADOWBAN, "status", "pending");
  const mapped = await Promise.all(rows.map(mapShadowbanReport));
  return mapped.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
}

export async function getAllShadowbanReports(): Promise<ShadowbanReport[]> {
  const rows = await sbSelectAll<ShadowbanRow>(T_SHADOWBAN);
  const mapped = await Promise.all(rows.map(mapShadowbanReport));
  return mapped.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
}

export async function getShadowbanReportById(id: string): Promise<ShadowbanReport | null> {
  const row = await sbSelectByPublicId<ShadowbanRow>(T_SHADOWBAN, id);
  if (!row) return null;
  return mapShadowbanReport(row);
}

export async function getShadowbanReportsByVA(vaId: string): Promise<ShadowbanReport[]> {
  const vid = vaId.trim();
  if (!vid) return [];
  const rows = await sbSelectEq<ShadowbanRow>(T_SHADOWBAN, "reported_by_id", vid);
  const mapped = await Promise.all(rows.map(mapShadowbanReport));
  return mapped.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
}

export async function createShadowbanReport(
  data: Partial<ShadowbanReport> & { screenshot?: { url: string }[] }
): Promise<ShadowbanReport> {
  const now = new Date().toISOString();
  const reportId = `sbr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const screenshotUrls = (data.screenshot ?? []).map((a) => a.url).filter(Boolean);
  const row = await sbInsert<ShadowbanRow>(T_SHADOWBAN, {
    report_id: reportId,
    account_id: data.account_id ?? "",
    model_id: data.model_id ?? "",
    model_name: data.model_name ?? "",
    platform: data.platform ?? "",
    username: data.username ?? "",
    reported_by_id: data.reported_by_id ?? "",
    reported_by_name: data.reported_by_name ?? "",
    reported_by_role: data.reported_by_role ?? "",
    notes: data.notes ?? "",
    status: "pending",
    created_at: now,
    ...(screenshotUrls.length ? { screenshot: screenshotUrls } : {}),
  });
  return mapShadowbanReport(row);
}

export async function getPendingLiftedReportAccountIds(): Promise<Set<string>> {
  const rows = await sbSelectEq<ShadowbanRow>(T_SHADOWBAN, "status", "pending");
  const out = new Set<string>();
  for (const row of rows) {
    if (
      deriveShadowbanReportType({
        report_type: row.report_type ?? undefined,
        notes: row.notes ?? undefined,
      }) !== "lifted"
    ) {
      continue;
    }
    const accountId = String(row.account_id ?? "").trim();
    if (accountId) out.add(accountId);
  }
  return out;
}

export async function hasPendingLiftedReport(accountId: string): Promise<boolean> {
  const aid = accountId.trim();
  if (!aid) return false;
  const sb = getSupabaseServiceClient();
  const { data, error } = await sb
    .from(T_SHADOWBAN)
    .select("report_type, notes, account_id, status")
    .eq("status", "pending")
    .eq("account_id", aid);
  if (error) throw new Error(`hasPendingLiftedReport: ${error.message}`);
  return (data ?? []).some((row) =>
    deriveShadowbanReportType({
      report_type: (row as ShadowbanRow).report_type ?? undefined,
      notes: (row as ShadowbanRow).notes ?? undefined,
    }) === "lifted"
  );
}

export async function updateShadowbanReport(id: string, data: Partial<ShadowbanReport>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (data.status !== undefined) patch.status = data.status;
  if (data.reviewed_by !== undefined) patch.reviewed_by = data.reviewed_by;
  if (data.reviewed_at !== undefined) patch.reviewed_at = data.reviewed_at;
  if (Object.keys(patch).length === 0) return;
  await sbUpdateByPublicId(T_SHADOWBAN, id, patch);
}

export async function deleteShadowbanReport(id: string): Promise<void> {
  await sbDeleteByPublicId(T_SHADOWBAN, id);
}

export async function getAllFunnels(): Promise<FunnelLink[]> {
  const rows = await sbSelectAll<FunnelRow>(T_FUNNELS);
  return rows
    .map(mapFunnel)
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
}

export async function getFunnelsByModel(modelId: string): Promise<FunnelLink[]> {
  const mid = modelId.trim();
  if (!mid) return [];
  const rows = await sbSelectEq<FunnelRow>(T_FUNNELS, "model_id", mid);
  return rows.filter((r) => r.active !== false).map(mapFunnel);
}

export async function createFunnel(data: Partial<FunnelLink>): Promise<FunnelLink> {
  const row = await sbInsert<FunnelRow>(T_FUNNELS, {
    funnel_id: `fnl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    model_id: data.model_id,
    model_name: data.model_name,
    label: data.label,
    url: data.url,
    platform: data.platform ?? "",
    region: data.region ?? "Global",
    active: true,
    created_at: new Date().toISOString(),
  });
  return mapFunnel(row);
}

export async function updateFunnel(id: string, data: Partial<FunnelLink>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (data.model_id !== undefined) patch.model_id = data.model_id;
  if (data.model_name !== undefined) patch.model_name = data.model_name;
  if (data.label !== undefined) patch.label = data.label;
  if (data.url !== undefined) patch.url = data.url;
  if (data.platform !== undefined) patch.platform = data.platform;
  if (data.region !== undefined) patch.region = data.region;
  if (data.active !== undefined) patch.active = data.active;
  if (Object.keys(patch).length === 0) return;
  await sbUpdateByPublicId(T_FUNNELS, id, patch);
}

export async function deleteFunnel(id: string): Promise<void> {
  await sbUpdateByPublicId(T_FUNNELS, id, { active: false });
}

/** Re-export for callers that need a single signed URL (e.g. API proxies). */
export { resolveStorageUrl };
