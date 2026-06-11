import { unstable_cache } from "next/cache";
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
  photo_urls?: string;
  countdown_target?: string;
  heading_text?: string;
  created_at?: string;
  updated_at?: string;
};

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
  const bgType = (["color", "gradient", "image"] as const).includes(f.background_type as LinkPageBackgroundType)
    ? (f.background_type as LinkPageBackgroundType)
    : "color";
  const theme = (["dark", "light", "minimal", "neon", "gold"] as const).includes(f.theme as LinkPageTheme)
    ? (f.theme as LinkPageTheme)
    : "dark";
  const font = (["modern", "elegant", "bold", "minimal"] as const).includes(f.font as LinkPageFont)
    ? (f.font as LinkPageFont)
    : "modern";
  return {
    id: rec.id,
    page_id: f.page_id ?? "",
    model_id: f.model_id ?? "",
    slug: f.slug ?? "",
    status,
    title: f.title ?? "",
    bio: f.bio ?? "",
    profile_photo_url: f.profile_photo_url ?? "",
    background_type: bgType,
    background_value: f.background_value ?? "#0a0a0a",
    theme,
    primary_color: f.primary_color ?? "#ec4899",
    accent_color: f.accent_color ?? "#a855f7",
    font,
    custom_domain: f.custom_domain ?? "",
    show_powered_by: f.show_powered_by === true,
    meta_description: f.meta_description ?? "",
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
  const style = (["default", "prominent", "subtle", "pill", "card"] as const).includes(f.style as LinkPageBlockStyle)
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
    photo_urls: parsePhotoUrls(f.photo_urls),
    countdown_target: f.countdown_target ?? null,
    heading_text: f.heading_text ?? "",
    created_at: f.created_at ?? rec.createdTime ?? "",
    updated_at: f.updated_at ?? "",
  };
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

async function fetchPageByFormula(formula: string): Promise<LinkPageRecord | null> {
  const { records } = await listRecords<PageFields>(LINK_PAGES_TABLE, {
    filterByFormula: formula,
    pageSize: 1,
    _caller: "link-pages",
  });
  const rec = records[0];
  return rec ? mapPage(rec) : null;
}

async function _getLinkPageBySlug(slug: string): Promise<LinkPageWithBlocks | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  const page = await fetchPageByFormula(`LOWER({slug})='${normalized.replace(/'/g, "\\'")}'`);
  if (!page) return null;
  const blocks = await listBlocksForPage(page.page_id);
  return { ...page, blocks: blocks.filter((b) => b.is_visible) };
}

export async function getLinkPageBySlug(slug: string): Promise<LinkPageWithBlocks | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  return unstable_cache(() => _getLinkPageBySlug(normalized), [`link-page-slug-${normalized}`], {
    revalidate: 30,
  })();
}

export async function getLinkPageByCustomDomain(domain: string): Promise<LinkPageRecord | null> {
  const normalized = domain.trim().toLowerCase().replace(/^www\./, "");
  if (!normalized) return null;
  return unstable_cache(
    () =>
      fetchPageByFormula(
        `AND(LOWER({custom_domain})='${normalized.replace(/'/g, "\\'")}', {status}='published')`
      ),
    [`link-page-domain-${normalized}`],
    { revalidate: 30 }
  )();
}

export async function listLinkPages(modelId?: string): Promise<LinkPageRecord[]> {
  const formula = modelId?.trim()
    ? `{model_id}='${modelId.trim().replace(/'/g, "\\'")}'`
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
  return fetchPageByFormula(`{page_id}='${pid.replace(/'/g, "\\'")}'`);
}

export async function listBlocksForPage(pageId: string): Promise<LinkPageBlockRecord[]> {
  const pid = pageId.trim();
  if (!pid) return [];
  const records = await listAllRecords<BlockFields>(LINK_PAGE_BLOCKS_TABLE, {
    filterByFormula: `{page_id}='${pid.replace(/'/g, "\\'")}'`,
    sort: [{ field: LINK_PAGE_BLOCK_FIELDS.sort_order, direction: "asc" }],
    _caller: "link-page-blocks",
  });
  return records.map(mapBlock);
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

  const existing = await fetchPageByFormula(`LOWER({slug})='${slug.replace(/'/g, "\\'")}'`);
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
  >
>;

export async function updateLinkPage(recordId: string, input: UpdateLinkPageInput): Promise<LinkPageRecord> {
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

  const rec = await updateRecord<PageFields>(LINK_PAGES_TABLE, recordId, bumpUpdatedAt(patch));
  invalidateListRecordsReadCacheForTable(LINK_PAGES_TABLE);
  return mapPage(rec);
}

export async function deleteLinkPage(recordId: string): Promise<void> {
  const page = await getLinkPageById(recordId);
  if (page) {
    const blocks = await listAllRecords<BlockFields>(LINK_PAGE_BLOCKS_TABLE, {
      filterByFormula: `{page_id}='${page.page_id.replace(/'/g, "\\'")}'`,
      _caller: "link-page-delete-blocks",
    });
    for (const b of blocks) {
      await deleteRecord(LINK_PAGE_BLOCKS_TABLE, b.id);
    }
  }
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
  return mapPage(rec);
}

export async function archiveLinkPage(recordId: string): Promise<LinkPageRecord> {
  const rec = await updateRecord<PageFields>(
    LINK_PAGES_TABLE,
    recordId,
    bumpUpdatedAt({ status: "archived" })
  );
  invalidateListRecordsReadCacheForTable(LINK_PAGES_TABLE);
  return mapPage(rec);
}

export async function unpublishLinkPage(recordId: string): Promise<LinkPageRecord> {
  const rec = await updateRecord<PageFields>(
    LINK_PAGES_TABLE,
    recordId,
    bumpUpdatedAt({ status: "draft" })
  );
  invalidateListRecordsReadCacheForTable(LINK_PAGES_TABLE);
  return mapPage(rec);
}

export type UpsertBlockInput = {
  block_id?: string;
  page_id: string;
  block_type: LinkPageBlockType;
  sort_order?: number;
  is_visible?: boolean;
  label?: string;
  url?: string;
  icon?: string;
  sublabel?: string;
  style?: LinkPageBlockStyle;
  photo_urls?: string[];
  countdown_target?: string | null;
  heading_text?: string;
};

export async function upsertBlock(
  recordId: string | null,
  input: UpsertBlockInput
): Promise<LinkPageBlockRecord> {
  const now = new Date().toISOString();
  const blockId = input.block_id?.trim() || newBlockId();
  const fields: BlockFields = {
    block_id: blockId,
    page_id: input.page_id,
    block_type: input.block_type,
    sort_order: input.sort_order ?? 0,
    is_visible: input.is_visible !== false,
    label: input.label ?? "",
    url: input.url ?? "",
    icon: input.icon ?? "",
    sublabel: input.sublabel ?? "",
    style: input.style ?? "default",
    photo_urls: serializePhotoUrls(input.photo_urls),
    countdown_target: input.countdown_target ?? undefined,
    heading_text: input.heading_text ?? "",
    updated_at: now,
  };

  let rec: AirtableRecord<BlockFields>;
  if (recordId) {
    rec = await updateRecord<BlockFields>(LINK_PAGE_BLOCKS_TABLE, recordId, bumpUpdatedAt(fields));
  } else {
    rec = await createRecord<BlockFields>(LINK_PAGE_BLOCKS_TABLE, { ...fields, created_at: now });
  }
  invalidateListRecordsReadCacheForTable(LINK_PAGE_BLOCKS_TABLE);
  return mapBlock(rec);
}

export async function deleteBlock(recordId: string): Promise<void> {
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
      photo_urls: b.photo_urls,
      countdown_target: b.countdown_target,
      heading_text: b.heading_text,
    });
  }
  return copy;
}
