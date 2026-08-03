/**
 * Supabase backend for services/link-redirects.ts
 */
import {
  publicId,
  sbDeleteByPublicId,
  sbInsert,
  sbSelectAll,
  sbSelectByPublicId,
  sbUpdateByPublicId,
  type SbRow,
} from "@/lib/supabase-data";
import type { LinkRedirectRecord } from "@/types";
import type { CreateRedirectInput, UpdateRedirectInput } from "./link-redirects";

const TABLE = "link_redirects";

type Row = SbRow & {
  redirect_id?: string | null;
  page_id?: string | null;
  slug?: string | null;
  destination_url?: string | null;
  label?: string | null;
  click_count?: number | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function newRedirectId(): string {
  return `rd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function mapRow(row: Row): LinkRedirectRecord {
  return {
    id: publicId(row),
    redirect_id: row.redirect_id ?? "",
    page_id: row.page_id ?? "",
    slug: row.slug ?? "",
    destination_url: row.destination_url ?? "",
    label: row.label ?? "",
    click_count: typeof row.click_count === "number" ? row.click_count : 0,
    is_active: row.is_active !== false,
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
  };
}

export async function listRedirectsForPage(pageId: string): Promise<LinkRedirectRecord[]> {
  const pid = pageId.trim();
  if (!pid) return [];
  const rows = await sbSelectAll<Row>(TABLE);
  return rows
    .filter((r) => (r.page_id ?? "") === pid)
    .map(mapRow)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
}

export async function getRedirectById(recordId: string): Promise<LinkRedirectRecord | null> {
  const row = await sbSelectByPublicId<Row>(TABLE, recordId);
  return row ? mapRow(row) : null;
}

export async function getRedirectByPageAndSlug(
  pageId: string,
  slug: string,
  options?: { activeOnly?: boolean }
): Promise<LinkRedirectRecord | null> {
  const pid = pageId.trim();
  const normalized = slugify(slug);
  if (!pid || !normalized) return null;
  const rows = await sbSelectAll<Row>(TABLE);
  const hit = rows.find(
    (r) =>
      (r.page_id ?? "") === pid &&
      (r.slug ?? "").toLowerCase() === normalized &&
      (options?.activeOnly ? r.is_active === true : true)
  );
  return hit ? mapRow(hit) : null;
}

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
  const row = await sbInsert<Row>(TABLE, {
    redirect_id: newRedirectId(),
    page_id: pageId,
    slug,
    destination_url: destination,
    label: (input.label ?? slug).trim(),
    click_count: 0,
    is_active: input.is_active !== false,
    created_at: now,
    updated_at: now,
  });
  return mapRow(row);
}

export async function updateRedirect(
  recordId: string,
  input: UpdateRedirectInput
): Promise<LinkRedirectRecord> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
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
  const row = await sbUpdateByPublicId<Row>(TABLE, recordId, patch);
  return mapRow(row);
}

export async function deleteRedirect(recordId: string): Promise<void> {
  await sbDeleteByPublicId(TABLE, recordId);
}

export function incrementClickCount(recordId: string): void {
  void (async () => {
    try {
      const existing = await getRedirectById(recordId);
      if (!existing) return;
      await sbUpdateByPublicId<Row>(TABLE, recordId, {
        click_count: existing.click_count + 1,
        updated_at: new Date().toISOString(),
      });
    } catch {
      // fire-and-forget
    }
  })();
}
