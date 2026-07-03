"use server";

import { createRecord, listAllRecords, updateRecord, type AirtableRecord } from "@/lib/airtable-server";

const TABLE_PLATFORMS = "marketing_platforms";
const TABLE_ACCOUNTS = "model_social_accounts";
const TABLE_FUNNELS = "model_funnel_links";
const TABLE_SHADOWBAN_REPORTS = "shadowban_reports";

export type SocialAccountStatus = "active" | "shadowbanned" | "banned";

export interface SocialAccount {
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
}

export type ShadowbanReportStatus = "pending" | "approved" | "dismissed";

/** What was reported for the account: a shadowban (limited reach) or a full ban. */
export type ShadowbanReportType = "shadowbanned" | "banned";

export interface ShadowbanReport {
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
  /** Derived from the report (report_type field or the notes prefix). Drives account_status on approval. */
  report_type: ShadowbanReportType;
  screenshot: { url: string }[];
  notes: string;
  status: ShadowbanReportStatus;
  reviewed_by: string;
  created_at: string;
  reviewed_at: string | null;
}

/**
 * Resolve the report type from an Airtable shadowban_reports row.
 * The submit route encodes the type in the notes prefix ("[Ban reported]" / "[Shadowban reported]"),
 * and (forward-compatible) may also set a dedicated `report_type` field.
 */
export function deriveShadowbanReportType(fields: {
  report_type?: unknown;
  notes?: unknown;
}): ShadowbanReportType {
  const rt = typeof fields.report_type === "string" ? fields.report_type.trim().toLowerCase() : "";
  if (rt === "banned") return "banned";
  if (rt === "shadowbanned") return "shadowbanned";
  const notes = typeof fields.notes === "string" ? fields.notes : "";
  return /^\s*\[ban reported\]/i.test(notes) ? "banned" : "shadowbanned";
}

export interface FunnelLink {
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
}

export interface MarketingPlatform {
  id: string;
  platform_id: string;
  name: string;
  icon: string;
  color: string;
  active: boolean;
  sort_order: number;
}

type AccountFields = {
  account_id?: string;
  model_id?: string;
  model_name?: string;
  platform?: string;
  account_link?: string;
  username?: string;
  account_type?: string;
  region?: string;
  assigned_va_id?: string;
  assigned_va_name?: string;
  notes?: string;
  active?: boolean;
  last_updated?: string;
  created_at?: string;
  account_status?: string;
  shadowban_reported_at?: string | null;
  shadowban_reported_by?: string;
  shadowban_screenshot?: unknown;
};

type ShadowbanReportFields = {
  report_id?: string;
  account_id?: string;
  model_id?: string;
  model_name?: string;
  platform?: string;
  username?: string;
  reported_by_id?: string;
  reported_by_name?: string;
  reported_by_role?: string;
  report_type?: string;
  screenshot?: unknown;
  notes?: string;
  status?: string;
  reviewed_by?: string;
  created_at?: string;
  reviewed_at?: string | null;
};

type FunnelFields = {
  funnel_id?: string;
  model_id?: string;
  model_name?: string;
  label?: string;
  url?: string;
  platform?: string;
  region?: string;
  active?: boolean;
  created_at?: string;
};

type PlatformFields = {
  platform_id?: string;
  name?: string;
  icon?: string;
  color?: string;
  active?: boolean;
  sort_order?: number;
  created_at?: string;
};

function airtableFormulaString(value: string): string {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function normalizeAttachmentUrls(raw: unknown): { url: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { url: string }[] = [];
  for (const row of raw) {
    if (row && typeof row === "object" && "url" in row && typeof (row as { url: unknown }).url === "string") {
      out.push({ url: (row as { url: string }).url });
    }
  }
  return out;
}

function asAccountStatus(v: unknown): SocialAccountStatus {
  if (v === "shadowbanned" || v === "banned") return v;
  return "active";
}

function asShadowbanReportStatus(v: unknown): ShadowbanReportStatus {
  if (v === "approved" || v === "dismissed") return v;
  return "pending";
}

function mapAccount(rec: AirtableRecord<AccountFields>): SocialAccount {
  const f = rec.fields ?? {};
  const at = f.account_type === "secondary" ? "secondary" : "main";
  const reg = f.region === "USA" || f.region === "Greek" ? f.region : "Global";
  return {
    id: rec.id,
    account_id: (f.account_id as string) ?? rec.id,
    model_id: (f.model_id as string) ?? "",
    model_name: (f.model_name as string) ?? "",
    platform: (f.platform as string) ?? "",
    account_link: (f.account_link as string) ?? "",
    username: (f.username as string) ?? "",
    account_type: at,
    region: reg,
    assigned_va_id: (f.assigned_va_id as string) ?? "",
    assigned_va_name: (f.assigned_va_name as string) ?? "",
    notes: (f.notes as string) ?? "",
    active: f.active !== false,
    last_updated: (f.last_updated as string) ?? "",
    created_at: (f.created_at as string) ?? "",
    account_status: asAccountStatus(f.account_status),
    shadowban_reported_at: (f.shadowban_reported_at as string | null) ?? null,
    shadowban_reported_by: (f.shadowban_reported_by as string) ?? "",
    shadowban_screenshot: normalizeAttachmentUrls(f.shadowban_screenshot),
  };
}

function mapShadowbanReport(rec: AirtableRecord<ShadowbanReportFields>): ShadowbanReport {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    report_id: (f.report_id as string) ?? rec.id,
    account_id: (f.account_id as string) ?? "",
    model_id: (f.model_id as string) ?? "",
    model_name: (f.model_name as string) ?? "",
    platform: (f.platform as string) ?? "",
    username: (f.username as string) ?? "",
    reported_by_id: (f.reported_by_id as string) ?? "",
    reported_by_name: (f.reported_by_name as string) ?? "",
    reported_by_role: (f.reported_by_role as string) ?? "",
    report_type: deriveShadowbanReportType(f),
    screenshot: normalizeAttachmentUrls(f.screenshot),
    notes: (f.notes as string) ?? "",
    status: asShadowbanReportStatus(f.status),
    reviewed_by: (f.reviewed_by as string) ?? "",
    created_at: (f.created_at as string) ?? "",
    reviewed_at: (f.reviewed_at as string | null) ?? null,
  };
}

function mapFunnel(rec: AirtableRecord<FunnelFields>): FunnelLink {
  const f = rec.fields ?? {};
  const reg = f.region === "USA" || f.region === "Greek" ? f.region : "Global";
  return {
    id: rec.id,
    funnel_id: (f.funnel_id as string) ?? rec.id,
    model_id: (f.model_id as string) ?? "",
    model_name: (f.model_name as string) ?? "",
    label: (f.label as string) ?? "",
    url: (f.url as string) ?? "",
    platform: (f.platform as string) ?? "",
    region: reg,
    active: f.active !== false,
    created_at: (f.created_at as string) ?? "",
  };
}

function mapPlatform(rec: AirtableRecord<PlatformFields>): MarketingPlatform {
  const f = rec.fields ?? {};
  return {
    id: rec.id,
    platform_id: (f.platform_id as string) ?? rec.id,
    name: (f.name as string) ?? "",
    icon: (f.icon as string) ?? "",
    color: (f.color as string) ?? "#888888",
    active: f.active !== false,
    sort_order: typeof f.sort_order === "number" ? f.sort_order : Number(f.sort_order) || 0,
  };
}

// Platforms
export async function getPlatforms(): Promise<MarketingPlatform[]> {
  const records = await listAllRecords<PlatformFields>(TABLE_PLATFORMS, {
    filterByFormula: `{active} = TRUE()`,
    sort: [{ field: "sort_order", direction: "asc" }],
  });
  return records.map(mapPlatform);
}

export async function getAllPlatforms(): Promise<MarketingPlatform[]> {
  const records = await listAllRecords<PlatformFields>(TABLE_PLATFORMS, {
    sort: [{ field: "sort_order", direction: "asc" }],
  });
  return records.map(mapPlatform);
}

export async function createPlatform(data: Partial<MarketingPlatform>): Promise<MarketingPlatform> {
  const now = new Date().toISOString();
  const rec = await createRecord<PlatformFields>(TABLE_PLATFORMS, {
    platform_id: `plt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: data.name ?? "",
    icon: data.icon ?? "",
    color: data.color ?? "#888888",
    active: true,
    sort_order: data.sort_order ?? 99,
    created_at: now,
  });
  return mapPlatform(rec);
}

export async function updatePlatform(id: string, data: Partial<MarketingPlatform>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.icon !== undefined) patch.icon = data.icon;
  if (data.color !== undefined) patch.color = data.color;
  if (data.active !== undefined) patch.active = data.active;
  if (data.sort_order !== undefined) patch.sort_order = data.sort_order;
  if (Object.keys(patch).length === 0) return;
  await updateRecord(TABLE_PLATFORMS, id, patch);
}

// Social Accounts
export async function getAllAccounts(): Promise<SocialAccount[]> {
  const records = await listAllRecords<AccountFields>(TABLE_ACCOUNTS, {
    sort: [{ field: "created_at", direction: "desc" }],
  });
  return records.map(mapAccount);
}

export async function getAccountsByModel(modelId: string): Promise<SocialAccount[]> {
  const mid = airtableFormulaString(modelId);
  const records = await listAllRecords<AccountFields>(TABLE_ACCOUNTS, {
    filterByFormula: `AND({model_id} = "${mid}", {active} = TRUE())`,
    sort: [{ field: "created_at", direction: "asc" }],
  });
  return records.map(mapAccount);
}

export async function getAccountsByVA(vaId: string): Promise<SocialAccount[]> {
  const vid = airtableFormulaString(vaId);
  const records = await listAllRecords<AccountFields>(TABLE_ACCOUNTS, {
    filterByFormula: `AND({assigned_va_id} = "${vid}", {active} = TRUE())`,
    sort: [{ field: "model_name", direction: "asc" }],
  });
  return records.map(mapAccount);
}

export async function createAccount(data: Partial<SocialAccount>): Promise<SocialAccount> {
  const now = new Date().toISOString();
  const rec = await createRecord<AccountFields>(TABLE_ACCOUNTS, {
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
  });
  return mapAccount(rec);
}

export async function updateAccount(id: string, data: Partial<SocialAccount>): Promise<void> {
  const patch: Record<string, unknown> = {
    last_updated: new Date().toISOString(),
  };
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
  if (data.shadowban_screenshot !== undefined) patch.shadowban_screenshot = data.shadowban_screenshot;
  await updateRecord(TABLE_ACCOUNTS, id, patch);
}

/** Pending reports only (e.g. badges, focused queues). */
export async function getPendingShadowbanReports(): Promise<ShadowbanReport[]> {
  const records = await listAllRecords<ShadowbanReportFields>(TABLE_SHADOWBAN_REPORTS, {
    filterByFormula: `{status} = "pending"`,
    sort: [{ field: "created_at", direction: "desc" }],
  });
  return records.map(mapShadowbanReport);
}

export async function getAllShadowbanReports(): Promise<ShadowbanReport[]> {
  const records = await listAllRecords<ShadowbanReportFields>(TABLE_SHADOWBAN_REPORTS, {
    sort: [{ field: "created_at", direction: "desc" }],
  });
  return records.map(mapShadowbanReport);
}

export async function createShadowbanReport(
  data: Partial<ShadowbanReport> & { screenshot?: { url: string }[] },
): Promise<ShadowbanReport> {
  const now = new Date().toISOString();
  const reportId = `sbr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const rec = await createRecord<ShadowbanReportFields>(TABLE_SHADOWBAN_REPORTS, {
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
    ...(data.screenshot && data.screenshot.length > 0 ? { screenshot: data.screenshot } : {}),
  });
  return mapShadowbanReport(rec);
}

export async function updateShadowbanReport(id: string, data: Partial<ShadowbanReport>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (data.status !== undefined) patch.status = data.status;
  if (data.reviewed_by !== undefined) patch.reviewed_by = data.reviewed_by;
  if (data.reviewed_at !== undefined) patch.reviewed_at = data.reviewed_at;
  if (Object.keys(patch).length === 0) return;
  await updateRecord(TABLE_SHADOWBAN_REPORTS, id, patch);
}

export async function deleteAccount(id: string): Promise<void> {
  await updateRecord(TABLE_ACCOUNTS, id, { active: false, last_updated: new Date().toISOString() });
}

// Funnel Links
export async function getAllFunnels(): Promise<FunnelLink[]> {
  const records = await listAllRecords<FunnelFields>(TABLE_FUNNELS, {
    sort: [{ field: "created_at", direction: "desc" }],
  });
  return records.map(mapFunnel);
}

export async function getFunnelsByModel(modelId: string): Promise<FunnelLink[]> {
  const mid = airtableFormulaString(modelId);
  const records = await listAllRecords<FunnelFields>(TABLE_FUNNELS, {
    filterByFormula: `AND({model_id} = "${mid}", {active} = TRUE())`,
  });
  return records.map(mapFunnel);
}

export async function createFunnel(data: Partial<FunnelLink>): Promise<FunnelLink> {
  const rec = await createRecord<FunnelFields>(TABLE_FUNNELS, {
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
  return mapFunnel(rec);
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
  await updateRecord(TABLE_FUNNELS, id, patch);
}

export async function deleteFunnel(id: string): Promise<void> {
  await updateRecord(TABLE_FUNNELS, id, { active: false });
}
