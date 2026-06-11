import {
  listAllRecords,
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  invalidateListRecordsReadCacheForTable,
  type AirtableRecord,
} from "@/lib/airtable-server";
import { LINK_REDIRECTS_TABLE, LINK_REDIRECT_FIELDS } from "@/lib/link-redirects-schema";
import type { LinkRedirectRecord } from "@/types";

type RedirectFields = {
  redirect_id?: string;
  page_id?: string;
  slug?: string;
  destination_url?: string;
  label?: string;
  click_count?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

function escapeFormulaString(s: string): string {
  return s.replace(/"/g, '""');
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function bumpUpdatedAt(patch: Partial<RedirectFields>): Partial<RedirectFields> {
  return { ...patch, updated_at: new Date().toISOString() };
}

function newRedirectId(): string {
  return `rd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function mapRedirect(rec: AirtableRecord<RedirectFields>): LinkRedirectRecord {
  const f = rec.fields;
  return {
    id: rec.id,
    redirect_id: f.redirect_id ?? "",
    page_id: f.page_id ?? "",
    slug: f.slug ?? "",
    destination_url: f.destination_url ?? "",
    label: f.label ?? "",
    click_count: typeof f.click_count === "number" ? f.click_count : 0,
    is_active: f.is_active !== false,
    created_at: f.created_at ?? rec.createdTime ?? "",
    updated_at: f.updated_at ?? "",
  };
}

export async function listRedirectsForPage(pageId: string): Promise<LinkRedirectRecord[]> {
  const pid = pageId.trim();
  if (!pid) return [];
  const records = await listAllRecords<RedirectFields>(LINK_REDIRECTS_TABLE, {
    filterByFormula: `{page_id}="${escapeFormulaString(pid)}"`,
    sort: [{ field: LINK_REDIRECT_FIELDS.created_at, direction: "asc" }],
    _caller: "link-redirects-list",
  });
  return records.map(mapRedirect);
}

export async function getRedirectById(recordId: string): Promise<LinkRedirectRecord | null> {
  const id = recordId.trim();
  if (!id) return null;
  try {
    const rec = await getRecord<RedirectFields>(LINK_REDIRECTS_TABLE, id);
    return mapRedirect(rec);
  } catch {
    return null;
  }
}

export async function getRedirectByPageAndSlug(
  pageId: string,
  slug: string,
  options?: { activeOnly?: boolean }
): Promise<LinkRedirectRecord | null> {
  const pid = pageId.trim();
  const normalized = slugify(slug);
  if (!pid || !normalized) return null;

  const activeClause = options?.activeOnly ? `, {is_active}=TRUE()` : "";
  const formula = `AND({page_id}="${escapeFormulaString(pid)}", LOWER({slug})="${escapeFormulaString(normalized)}"${activeClause})`;

  const { records } = await listRecords<RedirectFields>(LINK_REDIRECTS_TABLE, {
    filterByFormula: formula,
    pageSize: 1,
    _caller: "link-redirect-by-slug",
  });
  const rec = records[0];
  return rec ? mapRedirect(rec) : null;
}

export type CreateRedirectInput = {
  page_id: string;
  slug?: string;
  destination_url: string;
  label?: string;
  is_active?: boolean;
};

export async function createRedirect(input: CreateRedirectInput): Promise<LinkRedirectRecord> {
  const pageId = input.page_id.trim();
  if (!pageId) throw new Error("page_id is required");
  const destination = input.destination_url.trim();
  if (!destination) throw new Error("destination_url is required");

  let slug = slugify(input.slug ?? input.label ?? "link");
  if (!slug) slug = `r-${newRedirectId().slice(0, 8)}`;

  const existing = await getRedirectByPageAndSlug(pageId, slug);
  if (existing) slug = `${slug}-${newRedirectId().slice(0, 6)}`;

  const now = new Date().toISOString();
  const redirectId = newRedirectId();
  const fields: RedirectFields = {
    redirect_id: redirectId,
    page_id: pageId,
    slug,
    destination_url: destination,
    label: (input.label ?? slug).trim(),
    click_count: 0,
    is_active: input.is_active !== false,
    created_at: now,
    updated_at: now,
  };

  const rec = await createRecord<RedirectFields>(LINK_REDIRECTS_TABLE, fields);
  invalidateListRecordsReadCacheForTable(LINK_REDIRECTS_TABLE);
  return mapRedirect(rec);
}

export type UpdateRedirectInput = Partial<
  Pick<LinkRedirectRecord, "slug" | "destination_url" | "label" | "is_active">
>;

export async function updateRedirect(recordId: string, input: UpdateRedirectInput): Promise<LinkRedirectRecord> {
  const patch: Partial<RedirectFields> = {};
  if (input.slug !== undefined) {
    const next = slugify(input.slug);
    if (!next) throw new Error("Invalid slug");
    patch.slug = next;
  }
  if (input.destination_url !== undefined) {
    const url = input.destination_url.trim();
    if (!url) throw new Error("destination_url is required");
    patch.destination_url = url;
  }
  if (input.label !== undefined) patch.label = input.label;
  if (input.is_active !== undefined) patch.is_active = input.is_active;

  if (Object.keys(patch).length === 0) {
    const existing = await getRedirectById(recordId);
    if (!existing) throw new Error("Redirect not found");
    return existing;
  }

  const rec = await updateRecord<RedirectFields>(LINK_REDIRECTS_TABLE, recordId, bumpUpdatedAt(patch));
  invalidateListRecordsReadCacheForTable(LINK_REDIRECTS_TABLE);
  return mapRedirect(rec);
}

export async function deleteRedirect(recordId: string): Promise<void> {
  await deleteRecord(LINK_REDIRECTS_TABLE, recordId);
  invalidateListRecordsReadCacheForTable(LINK_REDIRECTS_TABLE);
}

/** Fire-and-forget click counter — never throws. */
export function incrementClickCount(recordId: string): void {
  void (async () => {
    try {
      const rec = await getRecord<RedirectFields>(LINK_REDIRECTS_TABLE, recordId);
      const current = typeof rec.fields.click_count === "number" ? rec.fields.click_count : 0;
      await updateRecord<RedirectFields>(
        LINK_REDIRECTS_TABLE,
        recordId,
        bumpUpdatedAt({ click_count: current + 1 })
      );
      invalidateListRecordsReadCacheForTable(LINK_REDIRECTS_TABLE);
    } catch {
      // fire-and-forget
    }
  })();
}
