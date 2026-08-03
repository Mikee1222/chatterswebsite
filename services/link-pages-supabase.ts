/**
 * Supabase backend for services/link-pages.ts
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
import { LINK_PAGE_FONTS } from "@/lib/link-pages-schema";
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
import type { CreateLinkPageInput, UpdateLinkPageInput, UpsertBlockInput } from "./link-pages";

const PAGES_TABLE = "link_pages";
const BLOCKS_TABLE = "link_page_blocks";

type PageRow = SbRow & {
  page_id?: string | null;
  model_id?: string | null;
  slug?: string | null;
  status?: string | null;
  title?: string | null;
  bio?: string | null;
  profile_photo_url?: string | null;
  background_type?: string | null;
  background_value?: string | null;
  theme?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  font?: string | null;
  custom_domain?: string | null;
  show_powered_by?: boolean | null;
  meta_description?: string | null;
  verified?: boolean | null;
  ab_test_enabled?: boolean | null;
  ab_variant_id?: string | null;
  ab_test_name?: string | null;
  ab_winner?: string | null;
  ab_started_at?: string | null;
  meta_pixel_id?: string | null;
  tiktok_pixel_id?: string | null;
  cookie_notice_enabled?: boolean | null;
  cookie_notice_text?: string | null;
  bio_color?: string | null;
  name_color?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type BlockRow = SbRow & {
  block_id?: string | null;
  page_id?: string | null;
  block_type?: string | null;
  sort_order?: number | null;
  is_visible?: boolean | null;
  label?: string | null;
  url?: string | null;
  icon?: string | null;
  sublabel?: string | null;
  style?: string | null;
  platform?: string | null;
  custom_button_color?: string | null;
  photo_urls?: string | null;
  countdown_target?: string | null;
  heading_text?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function parsePhotoUrls(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.filter((u): u is string => typeof u === "string");
  } catch {
    return raw.split("\n").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function serializePhotoUrls(urls: string[] | undefined): string {
  return JSON.stringify(urls ?? []);
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function newPageId(): string {
  return `lp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function newBlockId(): string {
  return `blk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function mapPage(row: PageRow): LinkPageRecord {
  const statusRaw = row.status ?? "";
  const status = (["draft", "published", "archived"] as const).includes(statusRaw as LinkPageStatus)
    ? (statusRaw as LinkPageStatus)
    : "draft";
  const bgTypeRaw = row.background_type ?? "";
  const bgType = (
    ["color", "gradient", "gradient_preset", "pattern", "image", "animated"] as const
  ).includes(bgTypeRaw as LinkPageBackgroundType)
    ? (bgTypeRaw as LinkPageBackgroundType)
    : "color";
  const themeRaw = row.theme ?? "";
  const theme = (["dark", "light", "minimal", "neon", "gold"] as const).includes(themeRaw as LinkPageTheme)
    ? (themeRaw as LinkPageTheme)
    : "dark";
  const fontRaw = row.font ?? "";
  const font = (LINK_PAGE_FONTS as readonly string[]).includes(fontRaw) ? (fontRaw as LinkPageFont) : "modern";
  const winnerRaw = row.ab_winner ?? "";
  const winner: LinkPageAbWinner = (["none", "a", "b"] as const).includes(winnerRaw as LinkPageAbWinner)
    ? (winnerRaw as LinkPageAbWinner)
    : "none";
  return {
    id: publicId(row),
    page_id: row.page_id ?? "",
    model_id: row.model_id ?? "",
    slug: row.slug ?? "",
    status,
    title: row.title ?? "",
    bio: row.bio ?? "",
    profile_photo_url: row.profile_photo_url ?? "",
    background_type: bgType,
    background_value: row.background_value ?? "#0a0a0a",
    theme,
    primary_color: row.primary_color ?? "#ec4899",
    accent_color: row.accent_color ?? "#a855f7",
    font,
    custom_domain: row.custom_domain ?? "",
    show_powered_by: row.show_powered_by === true,
    meta_description: row.meta_description ?? "",
    verified: row.verified === true,
    ab_test_enabled: row.ab_test_enabled === true,
    ab_variant_id: row.ab_variant_id ?? "",
    ab_test_name: row.ab_test_name ?? "",
    ab_winner: winner,
    ab_started_at: row.ab_started_at ?? null,
    meta_pixel_id: row.meta_pixel_id ?? "",
    tiktok_pixel_id: row.tiktok_pixel_id ?? "",
    cookie_notice_enabled: row.cookie_notice_enabled === true,
    cookie_notice_text: row.cookie_notice_text ?? "",
    bio_color: row.bio_color ?? "",
    name_color: row.name_color ?? "",
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
  };
}

function mapBlock(row: BlockRow): LinkPageBlockRecord {
  const blockTypeRaw = row.block_type ?? "";
  const blockType = (
    ["link", "bio_text", "photo_grid", "countdown", "social_bar", "spacer", "heading"] as const
  ).includes(blockTypeRaw as LinkPageBlockType)
    ? (blockTypeRaw as LinkPageBlockType)
    : "link";
  const validStyles = [
    "default", "prominent", "subtle", "glass", "glass_dark", "outline", "minimal", "pill", "card",
  ] as const;
  const styleRaw = row.style ?? "";
  const style = validStyles.includes(styleRaw as LinkPageBlockStyle)
    ? (styleRaw as LinkPageBlockStyle)
    : "default";
  return {
    id: publicId(row),
    block_id: row.block_id ?? "",
    page_id: row.page_id ?? "",
    block_type: blockType,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
    is_visible: row.is_visible !== false,
    label: row.label ?? "",
    url: row.url ?? "",
    icon: row.icon ?? "",
    sublabel: row.sublabel ?? "",
    style,
    platform: row.platform ?? "",
    custom_button_color: row.custom_button_color ?? "",
    photo_urls: parsePhotoUrls(row.photo_urls),
    countdown_target: row.countdown_target ?? null,
    heading_text: row.heading_text ?? "",
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
  };
}

function dedupeBlocksByBlockId(blocks: LinkPageBlockRecord[]): LinkPageBlockRecord[] {
  const byKey = new Map<string, LinkPageBlockRecord>();
  for (const block of blocks) {
    const key = block.block_id || block.id;
    const existing = byKey.get(key);
    if (!existing || block.updated_at > existing.updated_at) byKey.set(key, block);
  }
  return [...byKey.values()].sort((a, b) => a.sort_order - b.sort_order);
}

async function fetchBlocksForPage(pageId: string): Promise<LinkPageBlockRecord[]> {
  const pid = pageId.trim();
  if (!pid) return [];
  const rows = await sbSelectAll<BlockRow>(BLOCKS_TABLE);
  const filtered = rows.filter((r) => (r.page_id ?? "") === pid);
  return dedupeBlocksByBlockId(filtered.map(mapBlock));
}

export function invalidateLinkPagePublicCache(
  _page: Pick<LinkPageRecord, "slug" | "custom_domain" | "page_id">
): void {
  // No-op in Supabase mode; caching is Airtable-only.
}

export async function getLinkPageBySlugFresh(slug: string): Promise<LinkPageWithBlocks | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  const rows = await sbSelectAll<PageRow>(PAGES_TABLE);
  const row = rows.find((r) => (r.slug ?? "").toLowerCase() === normalized);
  if (!row) return null;
  const page = mapPage(row);
  const blocks = await fetchBlocksForPage(page.page_id);
  return { ...page, blocks: blocks.filter((b) => b.is_visible) };
}

export async function getLinkPageWithBlocksByPageIdFresh(pageId: string): Promise<LinkPageWithBlocks | null> {
  const pid = pageId.trim();
  if (!pid) return null;
  const rows = await sbSelectAll<PageRow>(PAGES_TABLE);
  const row = rows.find((r) => (r.page_id ?? "") === pid);
  if (!row) return null;
  const page = mapPage(row);
  const blocks = await fetchBlocksForPage(pid);
  return { ...page, blocks: blocks.filter((b) => b.is_visible) };
}

export async function getLinkPageBySlug(slug: string): Promise<LinkPageWithBlocks | null> {
  return getLinkPageBySlugFresh(slug);
}

export async function getLinkPageByCustomDomainFresh(domain: string): Promise<LinkPageRecord | null> {
  const raw = domain.trim().toLowerCase().split(":")[0] ?? "";
  if (!raw) return null;
  const apex = raw.replace(/^www\./, "");
  const variants = new Set([raw, apex, `www.${apex}`]);
  const rows = await sbSelectAll<PageRow>(PAGES_TABLE);
  const row = rows.find((r) => (r.status ?? "") === "published" && variants.has((r.custom_domain ?? "").toLowerCase()));
  return row ? mapPage(row) : null;
}

export async function getLinkPageByCustomDomain(domain: string): Promise<LinkPageRecord | null> {
  return getLinkPageByCustomDomainFresh(domain);
}

export async function listLinkPages(modelId?: string): Promise<LinkPageRecord[]> {
  const rows = await sbSelectAll<PageRow>(PAGES_TABLE);
  const mid = modelId?.trim() ?? "";
  const filtered = mid ? rows.filter((r) => (r.model_id ?? "") === mid) : rows;
  return filtered.map(mapPage).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

export async function getLinkPageById(recordId: string): Promise<LinkPageWithBlocks | null> {
  const id = recordId.trim();
  if (!id) return null;
  const row = await sbSelectByPublicId<PageRow>(PAGES_TABLE, id);
  if (!row) return null;
  const page = mapPage(row);
  const blocks = await fetchBlocksForPage(page.page_id);
  return { ...page, blocks };
}

export async function getLinkPageByPageId(pageId: string): Promise<LinkPageRecord | null> {
  const pid = pageId.trim();
  if (!pid) return null;
  const rows = await sbSelectAll<PageRow>(PAGES_TABLE);
  const row = rows.find((r) => (r.page_id ?? "") === pid);
  return row ? mapPage(row) : null;
}

export async function getLinkPageBlocksFresh(pageId: string): Promise<LinkPageBlockRecord[]> {
  return fetchBlocksForPage(pageId);
}

export async function listBlocksForPage(pageId: string): Promise<LinkPageBlockRecord[]> {
  return fetchBlocksForPage(pageId);
}

export async function createLinkPage(input: CreateLinkPageInput = {}): Promise<LinkPageRecord> {
  const now = new Date().toISOString();
  const pageId = newPageId();
  const title = (input.title ?? "Untitled page").trim() || "Untitled page";
  let slug = slugify(input.slug ?? title);
  if (!slug) slug = `page-${pageId.slice(0, 8)}`;

  const existing = await sbSelectAll<PageRow>(PAGES_TABLE);
  if (existing.some((r) => (r.slug ?? "").toLowerCase() === slug)) {
    slug = `${slug}-${pageId.slice(0, 6)}`;
  }

  const row = await sbInsert<PageRow>(PAGES_TABLE, {
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
  });
  return mapPage(row);
}

export async function updateLinkPage(recordId: string, input: UpdateLinkPageInput): Promise<LinkPageRecord> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
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
  if (input.bio_color !== undefined) patch.bio_color = input.bio_color.trim();
  if (input.name_color !== undefined) patch.name_color = input.name_color.trim();
  if (input.ab_variant_id !== undefined) patch.ab_variant_id = input.ab_variant_id;
  const row = await sbUpdateByPublicId<PageRow>(PAGES_TABLE, recordId, patch);
  return mapPage(row);
}

export async function deleteLinkPage(recordId: string): Promise<void> {
  const page = await getLinkPageById(recordId);
  if (page?.page_id) {
    const blocks = await fetchBlocksForPage(page.page_id);
    for (const b of blocks) {
      await sbDeleteByPublicId(BLOCKS_TABLE, b.id).catch(() => {});
    }
  }
  await sbDeleteByPublicId(PAGES_TABLE, recordId);
}

export async function publishLinkPage(recordId: string): Promise<LinkPageRecord> {
  const row = await sbUpdateByPublicId<PageRow>(PAGES_TABLE, recordId, {
    status: "published",
    updated_at: new Date().toISOString(),
  });
  return mapPage(row);
}

export async function archiveLinkPage(recordId: string): Promise<LinkPageRecord> {
  const row = await sbUpdateByPublicId<PageRow>(PAGES_TABLE, recordId, {
    status: "archived",
    updated_at: new Date().toISOString(),
  });
  return mapPage(row);
}

export async function unpublishLinkPage(recordId: string): Promise<LinkPageRecord> {
  const row = await sbUpdateByPublicId<PageRow>(PAGES_TABLE, recordId, {
    status: "draft",
    updated_at: new Date().toISOString(),
  });
  return mapPage(row);
}

export async function upsertBlock(
  recordId: string | null,
  input: UpsertBlockInput
): Promise<LinkPageBlockRecord> {
  const now = new Date().toISOString();

  if (recordId) {
    const patch: Record<string, unknown> = { updated_at: now };
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
    if (input.countdown_target !== undefined) patch.countdown_target = input.countdown_target ?? null;
    if (input.heading_text !== undefined) patch.heading_text = input.heading_text;
    const row = await sbUpdateByPublicId<BlockRow>(BLOCKS_TABLE, recordId, patch);
    return mapBlock(row);
  }

  if (!input.page_id?.trim()) throw new Error("page_id is required");
  if (!input.block_type) throw new Error("block_type is required");
  const pageId = input.page_id.trim();
  const blockId = input.block_id?.trim() || newBlockId();
  const row = await sbInsert<BlockRow>(BLOCKS_TABLE, {
    block_id: blockId,
    page_id: pageId,
    block_type: input.block_type,
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
    countdown_target: input.countdown_target ?? null,
    heading_text: input.heading_text ?? "",
    created_at: now,
    updated_at: now,
  });
  return mapBlock(row);
}

export async function deleteBlock(recordId: string): Promise<void> {
  await sbDeleteByPublicId(BLOCKS_TABLE, recordId).catch(() => {});
}

export async function reorderBlocks(
  pageId: string,
  orderedBlockRecordIds: string[]
): Promise<LinkPageBlockRecord[]> {
  const blocks = await fetchBlocksForPage(pageId);
  const byId = new Map(blocks.map((b) => [b.id, b]));
  for (let i = 0; i < orderedBlockRecordIds.length; i++) {
    const id = orderedBlockRecordIds[i]!;
    if (!byId.has(id)) continue;
    await sbUpdateByPublicId<BlockRow>(BLOCKS_TABLE, id, {
      sort_order: i,
      updated_at: new Date().toISOString(),
    }).catch(() => {});
  }
  return fetchBlocksForPage(pageId);
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
    const b = blocks[i]!;
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

export async function getBlockById(recordId: string): Promise<LinkPageBlockRecord | null> {
  const row = await sbSelectByPublicId<BlockRow>(BLOCKS_TABLE, recordId);
  return row ? mapBlock(row) : null;
}
