import { revalidateTag, unstable_cache } from "next/cache";
import {
  listRecords,
  listAllRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  invalidateListRecordsReadCacheForTable,
  type AirtableRecord,
} from "@/lib/airtable-server";
import {
  LINK_PAGES_TABLE,
  LINK_PAGE_BLOCKS_TABLE,
  LINK_PAGE_FIELDS,
  LINK_PAGE_BLOCK_FIELDS,
  LINK_PAGE_FONTS,
} from "@/lib/link-pages-schema";
import type {
  LinkPageRecord,
  LinkPageBlockRecord,
  LinkPageWithBlocks,
  LinkPageStatus,
  LinkPageBackgroundType,
  LinkPageTheme,
  LinkPageFont,
  LinkPageBlockType,
  LinkPageBlockStyle,
  LinkPageAbWinner,
} from "@/types";

type PageFields = {
  page_id?: string;
  model_id?: string;
  slug?: string;
  status?: string;
  title?: string;
  bio?: string;
  profile_photo_url?: string;
  background_type?: string;
  background_value?: string;
  theme?: string;
  primary_color?: string;
  accent_color?: string;
  font?: string;
  custom_domain?: string;
  show_powered_by?: boolean;
  meta_description?: string;
  verified?: boolean;
  ab_test_enabled?: boolean;
  ab_variant_id?: string;
  ab_test_name?: string;
  ab_winner?: string;
  ab_started_at?: string;
  meta_pixel_id?: string;
  tiktok_pixel_id?: string;
  cookie_notice_enabled?: boolean;
  cookie_notice_text?: string;
  created_at?: string;
  updated_at?: string;
};

type BlockFields = {
  block_id?: string;
  page_id?: string;
  block_type?: string;
  sort_order?: number;
  is_visible?: boolean;
  label?: string;
  url?: string;
  icon?: string;
  sublabel?: string;
  style?: string;
  platform?: string;
  custom_button_color?: string;
  photo_urls?: string;
  countdown_target?: string;
  heading_text?: string;
  created_at?: string;
  updated_at?: string;
};

function airtableText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  return String(value);
}

function airtableBool(value: unknown): boolean {
  return value === true || value === "true";
}

function parsePhotoUrls(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.filter((u): u is string => typeof u === "string");
  } catch {
    return raw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function serializePhotoUrls(urls: string[] | undefined): string {
  return JSON.stringify(urls ?? []);
}

function mapPage(rec: AirtableRecord<PageFields>): LinkPageRecord {
  const f = rec.fields;
  const status = (["draft", "published", "archived"] as const).includes(f.status as LinkPageStatus)
    ? (f.status as LinkPageStatus)
    : "draft";
  const bgType = (
    [
      "color",
      "gradient",
      "gradient_preset",
      "pattern",
      "image",
      "animated",
    ] as const
  ).includes(f.background_type as LinkPageBackgroundType)
    ? (f.background_type as LinkPageBackgroundType)
    : "color";
  const theme = (["dark", "light", "minimal", "neon", "gold"] as const).includes(f.theme as LinkPageTheme)
    ? (f.theme as LinkPageTheme)
    : "dark";
  const font = (LINK_PAGE_FONTS as readonly string[]).includes(f.font ?? "")
    ? (f.font as LinkPageFont)
    : "modern";
  return {
    id: rec.id,
    page_id: f.page_id ?? "",
    model_id: f.model_id ?? "",
    slug: f.slug ?? "",
    status,
    title: f.title ?? "",
    bio: airtableText(f.bio),
    profile_photo_url: f.profile_photo_url ?? "",
    background_type: bgType,
    background_value: airtableText(f.background_value, "#0a0a0a"),
    theme,
    primary_color: f.primary_color ?? "#ec4899",
    accent_color: f.accent_color ?? "#a855f7",
    font,
    custom_domain: airtableText(f.custom_domain),
    show_powered_by: airtableBool(f.show_powered_by),
    meta_description: airtableText(f.meta_description),
    verified: airtableBool(f.verified),
    ab_test_enabled: airtableBool(f.ab_test_enabled),
    ab_variant_id: airtableText(f.ab_variant_id),
    ab_test_name: airtableText(f.ab_test_name),
    ab_winner: (["none", "a", "b"] as const).includes(f.ab_winner as LinkPageAbWinner)
      ? (f.ab_winner as LinkPageAbWinner)
      : "none",
    ab_started_at: f.ab_started_at ?? null,
    meta_pixel_id: airtableText(f.meta_pixel_id),
    tiktok_pixel_id: airtableText(f.tiktok_pixel_id),
    cookie_notice_enabled: airtableBool(f.cookie_notice_enabled),
    cookie_notice_text: airtableText(f.cookie_notice_text),
    created_at: f.created_at ?? rec.createdTime ?? "",
    updated_at: f.updated_at ?? "",
  };
}

function mapBlock(rec: AirtableRecord<BlockFields>): LinkPageBlockRecord {
  const f = rec.fields;
  const blockType = (
    ["link", "bio_text", "photo_grid", "countdown", "social_bar", "spacer", "heading"] as const
  ).includes(f.block_type as LinkPageBlockType)
    ? (f.block_type as LinkPageBlockType)
    : "link";
  const validStyles = [
    "default",
    "prominent",
    "subtle",
    "glass",
    "glass_dark",
    "outline",
    "minimal",
    "pill",
    "card",
  ] as const;
  const style = validStyles.includes(f.style as LinkPageBlockStyle)
    ? (f.style as LinkPageBlockStyle)
    : "default";
  return {
    id: rec.id,
    block_id: f.block_id ?? "",
    page_id: f.page_id ?? "",
    block_type: blockType,
    sort_order: typeof f.sort_order === "number" ? f.sort_order : 0,
    is_visible: f.is_visible !== false,
    label: f.label ?? "",
    url: f.url ?? "",
    icon: f.icon ?? "",
    sublabel: f.sublabel ?? "",
    style,
    platform: f.platform ?? "",
    custom_button_color: f.custom_button_color ?? "",
    photo_urls: parsePhotoUrls(f.photo_urls),
    countdown_target: f.countdown_target ?? null,
    heading_text: f.heading_text ?? "",
    created_at: f.created_at ?? rec.createdTime ?? "",
    updated_at: f.updated_at ?? "",
  };
}

function escapeFormulaString(s: string): string {
  return s.replace(/"/g, '""');
}

function linkPageSlugTag(slug: string): string {
  return `link-page-slug-${slug.trim().toLowerCase()}`;
}

function linkPageDomainTag(domain: string): string {
  return `link-page-domain-${domain.trim().toLowerCase().replace(/^www\./, "")}`;
}

function linkPageBlocksTag(pageId: string): string {
  return `link-page-blocks-${pageId.trim()}`;
}

export function invalidateLinkPagePublicCache(
  page: Pick<LinkPageRecord, "slug" | "custom_domain" | "page_id">
): void {
  if (page.slug) revalidateTag(linkPageSlugTag(page.slug));
  if (page.custom_domain) revalidateTag(linkPageDomainTag(page.custom_domain));
  if (page.page_id) revalidateTag(linkPageBlocksTag(page.page_id));
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function bumpUpdatedAt(patch: Partial<PageFields | BlockFields>): Partial<PageFields | BlockFields> {
  return { ...patch, updated_at: new Date().toISOString() };
}

function newPageId(): string {
  return `lp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function newBlockId(): string {
  return `blk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function fetchPageByFormula(
  formula: string,
  options?: { skipCache?: boolean }
): Promise<LinkPageRecord | null> {
  const { records } = await listRecords<PageFields>(LINK_PAGES_TABLE, {
    filterByFormula: formula,
    pageSize: 1,
    _caller: "link-pages",
    skipCache: options?.skipCache,
  });
  const rec = records[0];
  return rec ? mapPage(rec) : null;
}

async function loadLinkPageBySlug(
  slug: string,
  options?: { skipCache?: boolean }
): Promise<LinkPageWithBlocks | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  const page = await fetchPageByFormula(`LOWER({slug})="${escapeFormulaString(normalized)}"`, options);
  if (!page) return null;
  const blocks = options?.skipCache
    ? await fetchBlocksForPage(page.page_id, options)
    : await listBlocksForPage(page.page_id);
  return { ...page, blocks: blocks.filter((b) => b.is_visible) };
}

/** Uncached read for public link pages — always hits Airtable. */
export async function getLinkPageBySlugFresh(slug: string): Promise<LinkPageWithBlocks | null> {
  return loadLinkPageBySlug(slug, { skipCache: true });
}

/** Uncached page + blocks by logical page_id (for A/B variant B). */
export async function getLinkPageWithBlocksByPageIdFresh(pageId: string): Promise<LinkPageWithBlocks | null> {
  const pid = pageId.trim();
  if (!pid) return null;
  const page = await fetchPageByFormula(`{page_id}="${escapeFormulaString(pid)}"`, { skipCache: true });
  if (!page) return null;
  const blocks = await fetchBlocksForPage(pid, { skipCache: true });
  return { ...page, blocks: blocks.filter((b) => b.is_visible) };
}

/** Next.js Data Cache TTL for admin/middleware cached reads (not used on public pages). */
const LINK_PAGE_PUBLIC_CACHE_SECONDS = 120;

export async function getLinkPageBySlug(slug: string): Promise<LinkPageWithBlocks | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  const tag = linkPageSlugTag(normalized);
  return unstable_cache(() => loadLinkPageBySlug(normalized), [tag], {
    revalidate: LINK_PAGE_PUBLIC_CACHE_SECONDS,
    tags: [tag],
  })();
}

function customDomainLookupFormula(domain: string): { formula: string; normalizedDomain: string } | null {
  const raw = domain.trim().toLowerCase().split(":")[0] ?? "";
  if (!raw) return null;
  const normalizedDomain = raw.replace(/^www\./, "");
  if (!normalizedDomain) return null;

  // Canonical Airtable value is apex only (e.g. sofiapetritsi.com — no www prefix).
  const lookupVariants = Array.from(new Set([raw, normalizedDomain, `www.${normalizedDomain}`]));
  const domainMatches = lookupVariants
    .map((d) => `LOWER({custom_domain})="${escapeFormulaString(d)}"`)
    .join(",");
  return { formula: `AND({status}="published", OR(${domainMatches}))`, normalizedDomain };
}

async function loadLinkPageByCustomDomain(
  domain: string,
  options?: { skipCache?: boolean }
): Promise<LinkPageRecord | null> {
  const lookup = customDomainLookupFormula(domain);
  if (!lookup) return null;
  return fetchPageByFormula(lookup.formula, options);
}

/** Uncached read for middleware (Edge) — unstable_cache is not available there. */
export async function getLinkPageByCustomDomainFresh(domain: string): Promise<LinkPageRecord | null> {
  console.log("[custom-domain] looking for:", domain);
  const result = await loadLinkPageByCustomDomain(domain, { skipCache: true });
  console.log("[custom-domain] result:", result);
  return result;
}

export async function getLinkPageByCustomDomain(domain: string): Promise<LinkPageRecord | null> {
  console.log("[custom-domain] looking for:", domain);
  const lookup = customDomainLookupFormula(domain);
  if (!lookup) {
    console.log("[custom-domain] result:", null);
    return null;
  }

  const tag = linkPageDomainTag(lookup.normalizedDomain);
  const result = await unstable_cache(
    () => loadLinkPageByCustomDomain(domain),
    [tag, lookup.normalizedDomain],
    { revalidate: 30, tags: [tag] }
  )();
  console.log("[custom-domain] result:", result);
  return result;
}

export async function listLinkPages(modelId?: string): Promise<LinkPageRecord[]> {
  const formula = modelId?.trim()
    ? `{model_id}="${escapeFormulaString(modelId.trim())}"`
    : undefined;
  const records = await listAllRecords<PageFields>(LINK_PAGES_TABLE, {
    filterByFormula: formula,
    sort: [{ field: LINK_PAGE_FIELDS.updated_at, direction: "desc" }],
    _caller: "link-pages-list",
  });
  return records.map(mapPage);
}

export async function getLinkPageById(recordId: string): Promise<LinkPageWithBlocks | null> {
  const id = recordId.trim();
  if (!id) return null;
  try {
    const rec = await getRecord<PageFields>(LINK_PAGES_TABLE, id);
    const page = mapPage(rec);
    const blocks = await listBlocksForPage(page.page_id);
    return { ...page, blocks };
  } catch {
    return null;
  }
}

export async function getLinkPageByPageId(pageId: string): Promise<LinkPageRecord | null> {
  const pid = pageId.trim();
  if (!pid) return null;
  return fetchPageByFormula(`{page_id}="${escapeFormulaString(pid)}"`);
}

function dedupeBlocksByBlockId(blocks: LinkPageBlockRecord[]): LinkPageBlockRecord[] {
  const byKey = new Map<string, LinkPageBlockRecord>();
  for (const block of blocks) {
    const key = block.block_id || block.id;
    const existing = byKey.get(key);
    if (!existing || block.updated_at > existing.updated_at) {
      byKey.set(key, block);
    }
  }
  return [...byKey.values()].sort((a, b) => a.sort_order - b.sort_order);
}

async function fetchBlocksForPage(
  pageId: string,
  options?: { skipCache?: boolean }
): Promise<LinkPageBlockRecord[]> {
  const records = await listAllRecords<BlockFields>(LINK_PAGE_BLOCKS_TABLE, {
    filterByFormula: `{page_id}="${escapeFormulaString(pageId)}"`,
    sort: [{ field: LINK_PAGE_BLOCK_FIELDS.sort_order, direction: "asc" }],
    _caller: "link-page-blocks",
    skipCache: options?.skipCache,
  });
  return dedupeBlocksByBlockId(records.map(mapBlock));
}

/** Uncached block list for public link pages — always hits Airtable. */
export async function getLinkPageBlocksFresh(pageId: string): Promise<LinkPageBlockRecord[]> {
  return fetchBlocksForPage(pageId, { skipCache: true });
}

export async function listBlocksForPage(pageId: string): Promise<LinkPageBlockRecord[]> {
  const pid = pageId.trim();
  if (!pid) return [];
  const tag = linkPageBlocksTag(pid);
  return unstable_cache(() => fetchBlocksForPage(pid), [tag], {
    revalidate: LINK_PAGE_PUBLIC_CACHE_SECONDS,
    tags: [tag],
  })();
}

export type CreateLinkPageInput = {
  model_id?: string;
  title?: string;
  slug?: string;
};

export async function createLinkPage(input: CreateLinkPageInput = {}): Promise<LinkPageRecord> {
  const now = new Date().toISOString();
  const pageId = newPageId();
  const title = (input.title ?? "Untitled page").trim() || "Untitled page";
  let slug = slugify(input.slug ?? title);
  if (!slug) slug = `page-${pageId.slice(0, 8)}`;

  const existing = await fetchPageByFormula(`LOWER({slug})="${escapeFormulaString(slug)}"`);
  if (existing) slug = `${slug}-${pageId.slice(0, 6)}`;

  const fields: PageFields = {
    page_id: pageId,
    model_id: input.model_id?.trim() ?? "",
    slug,
    status: "draft",
    title,
    bio: "",
    profile_photo_url: "",
    background_type: "color",
    background_value: "#0a0a0a",
    theme: "dark",
    primary_color: "#ec4899",
    accent_color: "#a855f7",
    font: "modern",
    custom_domain: "",
    show_powered_by: false,
    meta_description: "",
    verified: false,
    meta_pixel_id: "",
    tiktok_pixel_id: "",
    cookie_notice_enabled: true,
    cookie_notice_text: "",
    created_at: now,
    updated_at: now,
  };

  const rec = await createRecord<PageFields>(LINK_PAGES_TABLE, fields);
  invalidateListRecordsReadCacheForTable(LINK_PAGES_TABLE);
  return mapPage(rec);
}

export type UpdateLinkPageInput = Partial<
  Pick<
    LinkPageRecord,
    | "model_id"
    | "slug"
    | "title"
    | "bio"
    | "profile_photo_url"
    | "background_type"
    | "background_value"
    | "theme"
    | "primary_color"
    | "accent_color"
    | "font"
    | "custom_domain"
    | "show_powered_by"
    | "meta_description"
    | "verified"
    | "meta_pixel_id"
    | "tiktok_pixel_id"
    | "cookie_notice_enabled"
    | "cookie_notice_text"
  >
>;

export async function updateLinkPage(recordId: string, input: UpdateLinkPageInput): Promise<LinkPageRecord> {
  const previous = await getLinkPageById(recordId);
  const patch: Partial<PageFields> = {};
  if (input.model_id !== undefined) patch.model_id = input.model_id;
  if (input.slug !== undefined) patch.slug = slugify(input.slug) || input.slug;
  if (input.title !== undefined) patch.title = input.title;
  if (input.bio !== undefined) patch.bio = input.bio;
  if (input.profile_photo_url !== undefined) patch.profile_photo_url = input.profile_photo_url;
  if (input.background_type !== undefined) patch.background_type = input.background_type;
  if (input.background_value !== undefined) patch.background_value = input.background_value;
  if (input.theme !== undefined) patch.theme = input.theme;
  if (input.primary_color !== undefined) patch.primary_color = input.primary_color;
  if (input.accent_color !== undefined) patch.accent_color = input.accent_color;
  if (input.font !== undefined) patch.font = input.font;
  if (input.custom_domain !== undefined) patch.custom_domain = input.custom_domain.trim().toLowerCase();
  if (input.show_powered_by !== undefined) patch.show_powered_by = input.show_powered_by;
  if (input.meta_description !== undefined) patch.meta_description = input.meta_description;
  if (input.verified !== undefined) patch.verified = input.verified;
  if (input.meta_pixel_id !== undefined) patch.meta_pixel_id = input.meta_pixel_id.trim();
  if (input.tiktok_pixel_id !== undefined) patch.tiktok_pixel_id = input.tiktok_pixel_id.trim();
  if (input.cookie_notice_enabled !== undefined) patch.cookie_notice_enabled = input.cookie_notice_enabled;
  if (input.cookie_notice_text !== undefined) patch.cookie_notice_text = input.cookie_notice_text;

  const rec = await updateRecord<PageFields>(LINK_PAGES_TABLE, recordId, bumpUpdatedAt(patch));
  invalidateListRecordsReadCacheForTable(LINK_PAGES_TABLE);
  const page = mapPage(rec);
  if (previous) invalidateLinkPagePublicCache(previous);
  invalidateLinkPagePublicCache(page);
  return page;
}

export async function deleteLinkPage(recordId: string): Promise<void> {
  const page = await getLinkPageById(recordId);
  if (page) {
    const blocks = await listAllRecords<BlockFields>(LINK_PAGE_BLOCKS_TABLE, {
      filterByFormula: `{page_id}="${escapeFormulaString(page.page_id)}"`,
      _caller: "link-page-delete-blocks",
    });
    for (const b of blocks) {
      await deleteRecord(LINK_PAGE_BLOCKS_TABLE, b.id);
    }
  }
  if (page) invalidateLinkPagePublicCache(page);
  await deleteRecord(LINK_PAGES_TABLE, recordId);
  invalidateListRecordsReadCacheForTable(LINK_PAGES_TABLE);
  invalidateListRecordsReadCacheForTable(LINK_PAGE_BLOCKS_TABLE);
}

export async function publishLinkPage(recordId: string): Promise<LinkPageRecord> {
  const rec = await updateRecord<PageFields>(
    LINK_PAGES_TABLE,
    recordId,
    bumpUpdatedAt({ status: "published" })
  );
  invalidateListRecordsReadCacheForTable(LINK_PAGES_TABLE);
  const page = mapPage(rec);
  invalidateLinkPagePublicCache(page);
  return page;
}

export async function archiveLinkPage(recordId: string): Promise<LinkPageRecord> {
  const rec = await updateRecord<PageFields>(
    LINK_PAGES_TABLE,
    recordId,
    bumpUpdatedAt({ status: "archived" })
  );
  invalidateListRecordsReadCacheForTable(LINK_PAGES_TABLE);
  const page = mapPage(rec);
  invalidateLinkPagePublicCache(page);
  return page;
}

export async function unpublishLinkPage(recordId: string): Promise<LinkPageRecord> {
  const rec = await updateRecord<PageFields>(
    LINK_PAGES_TABLE,
    recordId,
    bumpUpdatedAt({ status: "draft" })
  );
  invalidateListRecordsReadCacheForTable(LINK_PAGES_TABLE);
  const page = mapPage(rec);
  invalidateLinkPagePublicCache(page);
  return page;
}

export type UpsertBlockInput = {
  block_id?: string;
  page_id?: string;
  block_type?: LinkPageBlockType;
  sort_order?: number;
  is_visible?: boolean;
  label?: string;
  url?: string;
  icon?: string;
  sublabel?: string;
  style?: LinkPageBlockStyle;
  platform?: string;
  custom_button_color?: string;
  photo_urls?: string[];
  countdown_target?: string | null;
  heading_text?: string;
};

function blockFieldsFromInput(input: UpsertBlockInput, blockId: string, pageId: string): BlockFields {
  const now = new Date().toISOString();
  return {
    block_id: blockId,
    page_id: pageId,
    block_type: input.block_type ?? "link",
    sort_order: input.sort_order ?? 0,
    is_visible: input.is_visible !== false,
    label: input.label ?? "",
    url: input.url ?? "",
    icon: input.icon ?? "",
    sublabel: input.sublabel ?? "",
    style: input.style ?? "default",
    platform: input.platform ?? "",
    custom_button_color: input.custom_button_color ?? "",
    photo_urls: serializePhotoUrls(input.photo_urls),
    countdown_target: input.countdown_target ?? undefined,
    heading_text: input.heading_text ?? "",
    updated_at: now,
  };
}

function partialBlockPatch(input: UpsertBlockInput): Partial<BlockFields> {
  const patch: Partial<BlockFields> = {};
  if (input.block_type !== undefined) patch.block_type = input.block_type;
  if (input.sort_order !== undefined) patch.sort_order = input.sort_order;
  if (input.is_visible !== undefined) patch.is_visible = input.is_visible;
  if (input.label !== undefined) patch.label = input.label;
  if (input.url !== undefined) patch.url = input.url;
  if (input.icon !== undefined) patch.icon = input.icon;
  if (input.sublabel !== undefined) patch.sublabel = input.sublabel;
  if (input.style !== undefined) patch.style = input.style;
  if (input.platform !== undefined) patch.platform = input.platform;
  if (input.custom_button_color !== undefined) patch.custom_button_color = input.custom_button_color;
  if (input.photo_urls !== undefined) patch.photo_urls = serializePhotoUrls(input.photo_urls);
  if (input.countdown_target !== undefined) patch.countdown_target = input.countdown_target ?? undefined;
  if (input.heading_text !== undefined) patch.heading_text = input.heading_text;
  return patch;
}

export async function upsertBlock(
  recordId: string | null,
  input: UpsertBlockInput
): Promise<LinkPageBlockRecord> {
  const now = new Date().toISOString();

  let rec: AirtableRecord<BlockFields>;
  let pageId = input.page_id?.trim() ?? "";

  if (recordId) {
    const existing = await getRecord<BlockFields>(LINK_PAGE_BLOCKS_TABLE, recordId);
    pageId = pageId || (existing.fields.page_id ?? "");
    const patch = partialBlockPatch(input);
    if (Object.keys(patch).length === 0) {
      return mapBlock(existing);
    }
    rec = await updateRecord<BlockFields>(LINK_PAGE_BLOCKS_TABLE, recordId, bumpUpdatedAt(patch));
  } else {
    if (!input.page_id?.trim()) throw new Error("page_id is required");
    if (!input.block_type) throw new Error("block_type is required");
    pageId = input.page_id.trim();
    const blockId = input.block_id?.trim() || newBlockId();
    const fields = blockFieldsFromInput(input, blockId, pageId);
    rec = await createRecord<BlockFields>(LINK_PAGE_BLOCKS_TABLE, { ...fields, created_at: now });
  }

  invalidateListRecordsReadCacheForTable(LINK_PAGE_BLOCKS_TABLE);
  const page = await getLinkPageByPageId(pageId);
  if (page) invalidateLinkPagePublicCache(page);
  return mapBlock(rec);
}

export async function deleteBlock(recordId: string): Promise<void> {
  try {
    const rec = await getRecord<BlockFields>(LINK_PAGE_BLOCKS_TABLE, recordId);
    const page = await getLinkPageByPageId(rec.fields.page_id ?? "");
    if (page) invalidateLinkPagePublicCache(page);
  } catch {
    // block may already be gone
  }
  await deleteRecord(LINK_PAGE_BLOCKS_TABLE, recordId);
  invalidateListRecordsReadCacheForTable(LINK_PAGE_BLOCKS_TABLE);
}

export async function reorderBlocks(
  pageId: string,
  orderedBlockRecordIds: string[]
): Promise<LinkPageBlockRecord[]> {
  const blocks = await listBlocksForPage(pageId);
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const updates: Promise<AirtableRecord<BlockFields>>[] = [];

  orderedBlockRecordIds.forEach((id, index) => {
    const block = byId.get(id);
    if (!block) return;
    updates.push(
      updateRecord<BlockFields>(LINK_PAGE_BLOCKS_TABLE, id, bumpUpdatedAt({ sort_order: index }))
    );
  });

  await Promise.all(updates);
  invalidateListRecordsReadCacheForTable(LINK_PAGE_BLOCKS_TABLE);
  const page = await getLinkPageByPageId(pageId);
  if (page) invalidateLinkPagePublicCache(page);
  return listBlocksForPage(pageId);
}

export async function duplicateLinkPage(recordId: string): Promise<LinkPageRecord> {
  const source = await getLinkPageById(recordId);
  if (!source) throw new Error("Page not found");
  const copy = await createLinkPage({
    model_id: source.model_id,
    title: `${source.title} (copy)`,
    slug: `${source.slug}-copy`,
  });
  const blocks = source.blocks;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    await upsertBlock(null, {
      page_id: copy.page_id,
      block_type: b.block_type,
      sort_order: i,
      is_visible: b.is_visible,
      label: b.label,
      url: b.url,
      icon: b.icon,
      sublabel: b.sublabel,
      style: b.style,
      platform: b.platform,
      custom_button_color: b.custom_button_color,
      photo_urls: b.photo_urls,
      countdown_target: b.countdown_target,
      heading_text: b.heading_text,
    });
  }
  return copy;
}
