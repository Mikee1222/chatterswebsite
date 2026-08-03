/**
 * Supabase backend for services/link-ab-testing.ts
 *
 * Notes: For dual-run correctness, link-pages CRUD calls delegate to the
 * dual-backed link-pages module (which is Airtable READ or Supabase based on
 * DATA_BACKEND). This file only writes A/B result events directly into the
 * Supabase `link_ab_results` table.
 */
import {
  publicId,
  sbInsert,
  sbSelectAll,
  sbSelectByPublicId,
  sbUpdateByPublicId,
  type SbRow,
} from "@/lib/supabase-data";
import { ymdInAthens } from "@/lib/link-page-analytics-utils";
import type {
  AbTestResults,
  LinkPageAbEventType,
  LinkPageAbVariant,
  LinkPageRecord,
  LinkPageWithBlocks,
} from "@/types";
import { calculateWinner } from "./link-ab-testing";
import {
  archiveLinkPage,
  createLinkPage,
  getLinkPageById,
  getLinkPageByPageId,
  invalidateLinkPagePublicCache,
  listBlocksForPage,
  updateLinkPage,
  upsertBlock,
} from "@/services/link-pages";

const PAGES_TABLE = "link_pages";
const BLOCKS_TABLE = "link_page_blocks";
const AB_TABLE = "link_ab_results";

type AbRow = SbRow & {
  event_id?: string | null;
  page_id?: string | null;
  variant?: string | null;
  event_type?: string | null;
  session_id?: string | null;
  block_id?: string | null;
  timestamp?: string | null;
};

function newAbEventId(): string {
  return `abe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseVariant(raw: string | null | undefined): LinkPageAbVariant {
  return raw === "b" ? "b" : "a";
}

function parseAbEventType(raw: string | null | undefined): LinkPageAbEventType {
  return raw === "click" ? "click" : "view";
}

/** Fire-and-forget A/B event write. */
export function trackAbEvent(ctx: {
  pageId: string;
  variant: LinkPageAbVariant;
  eventType: LinkPageAbEventType;
  sessionId: string;
  blockId?: string;
}): void {
  if (!ctx.pageId || !ctx.sessionId) return;
  const now = new Date().toISOString();
  void sbInsert<AbRow>(AB_TABLE, {
    event_id: newAbEventId(),
    page_id: ctx.pageId.trim(),
    variant: ctx.variant,
    event_type: ctx.eventType,
    session_id: ctx.sessionId.trim(),
    block_id: ctx.blockId?.trim() ?? "",
    timestamp: now,
  }).catch((err) => {
    console.error("[link-ab-testing/supabase] trackAbEvent failed:", err);
  });
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax));
  return sign * y;
}
function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}
function chiSquareConfidence(aSuccess: number, aFail: number, bSuccess: number, bFail: number): number {
  const n = aSuccess + aFail + bSuccess + bFail;
  if (n === 0) return 0;
  const denom = (aSuccess + aFail) * (bSuccess + bFail) * (aSuccess + bSuccess) * (aFail + bFail);
  if (denom === 0) return 0;
  const num = n * Math.pow(aSuccess * bFail - aFail * bSuccess, 2);
  const chi2 = num / denom;
  if (chi2 <= 0) return 0;
  const pValue = 2 * (1 - normalCdf(Math.sqrt(chi2)));
  return Math.round(Math.max(0, Math.min(100, (1 - pValue) * 100)));
}

type MetricsPair = { a: AbTestResults["variantA"]; b: AbTestResults["variantB"] };

function aggregateMetrics(
  events: Array<{ variant: LinkPageAbVariant; event_type: LinkPageAbEventType; session_id: string }>
): MetricsPair {
  const viewSessions: Record<LinkPageAbVariant, Set<string>> = { a: new Set(), b: new Set() };
  const clickSessions: Record<LinkPageAbVariant, Set<string>> = { a: new Set(), b: new Set() };
  let clicksA = 0;
  let clicksB = 0;
  for (const ev of events) {
    const sid = ev.session_id.trim();
    if (!sid) continue;
    if (ev.event_type === "view") viewSessions[ev.variant].add(sid);
    else {
      clickSessions[ev.variant].add(sid);
      if (ev.variant === "a") clicksA++;
      else clicksB++;
    }
  }
  const build = (variant: LinkPageAbVariant, clicks: number) => {
    const sessions = viewSessions[variant].size;
    const sessionsWithClicks = [...clickSessions[variant]].filter((s) => viewSessions[variant].has(s)).length;
    const ctr = sessions > 0 ? sessionsWithClicks / sessions : 0;
    return { variant, views: sessions, clicks, sessions, sessionsWithClicks, ctr };
  };
  return { a: build("a", clicksA), b: build("b", clicksB) };
}

function viewsByDayFromEvents(
  events: Array<{ variant: LinkPageAbVariant; event_type: LinkPageAbEventType; timestamp: string }>
): AbTestResults["viewsByDay"] {
  const byDay = new Map<string, { a: number; b: number }>();
  for (const ev of events) {
    if (ev.event_type !== "view" || !ev.timestamp) continue;
    const day = ymdInAthens(ev.timestamp);
    const row = byDay.get(day) ?? { a: 0, b: 0 };
    row[ev.variant]++;
    byDay.set(day, row);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }));
}

export async function getAbTestResults(page: LinkPageRecord): Promise<AbTestResults> {
  const controlPageId = page.page_id;
  const rows = await sbSelectAll<AbRow>(AB_TABLE).catch(() => []);
  const matching = rows.filter((r) => (r.page_id ?? "") === controlPageId);

  const startedAtMs = page.ab_started_at ? Date.parse(page.ab_started_at) : NaN;
  const testStopped = !page.ab_test_enabled && page.ab_winner !== "none";
  const stoppedAtMs = testStopped && page.updated_at ? Date.parse(page.updated_at) : NaN;

  const events = matching
    .map((r) => ({
      variant: parseVariant(r.variant),
      event_type: parseAbEventType(r.event_type),
      session_id: r.session_id ?? "",
      timestamp: r.timestamp ?? "",
    }))
    .filter((ev) => {
      if (!ev.timestamp) return false;
      const ts = Date.parse(ev.timestamp);
      if (Number.isFinite(startedAtMs) && ts < startedAtMs) return false;
      if (Number.isFinite(stoppedAtMs) && ts > stoppedAtMs) return false;
      return true;
    });

  const { a: variantA, b: variantB } = aggregateMetrics(events);
  const aNoClick = Math.max(0, variantA.sessions - variantA.sessionsWithClicks);
  const bNoClick = Math.max(0, variantB.sessions - variantB.sessionsWithClicks);
  const confidence = chiSquareConfidence(
    variantA.sessionsWithClicks,
    aNoClick,
    variantB.sessionsWithClicks,
    bNoClick
  );

  return {
    pageId: controlPageId,
    testName: page.ab_test_name || "A/B Test",
    enabled: page.ab_test_enabled,
    winner: page.ab_winner,
    startedAt: page.ab_started_at,
    variantPageId: page.ab_variant_id,
    variantA,
    variantB,
    confidence,
    suggestedWinner: calculateWinner(variantA, variantB),
    viewsByDay: viewsByDayFromEvents(events),
  };
}

async function updateAbFields(recordId: string, patch: Record<string, unknown>): Promise<void> {
  await sbUpdateByPublicId(PAGES_TABLE, recordId, { ...patch, updated_at: new Date().toISOString() });
}

export async function createAbVariantPage(controlRecordId: string): Promise<LinkPageRecord> {
  const source = await getLinkPageById(controlRecordId);
  if (!source) throw new Error("Page not found");
  const copy = await createLinkPage({
    model_id: source.model_id,
    title: `${source.title} (Variant B)`,
    slug: `${source.slug}-variant-b`,
  });
  await updateLinkPage(copy.id, {
    bio: source.bio,
    profile_photo_url: source.profile_photo_url,
    background_type: source.background_type,
    background_value: source.background_value,
    theme: source.theme,
    primary_color: source.primary_color,
    accent_color: source.accent_color,
    font: source.font,
    meta_description: source.meta_description,
    verified: source.verified,
    show_powered_by: source.show_powered_by,
  });
  const blocks = source.blocks.sort((a, b) => a.sort_order - b.sort_order);
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

export async function startAbTest(
  controlRecordId: string,
  testName: string
): Promise<{ page: LinkPageRecord; variantPageId: string }> {
  const control = await getLinkPageById(controlRecordId);
  if (!control) throw new Error("Page not found");
  if (control.status !== "published") throw new Error("Page must be published to start an A/B test");

  let variantPageId = control.ab_variant_id?.trim() ?? "";
  if (!variantPageId) {
    const variant = await createAbVariantPage(controlRecordId);
    variantPageId = variant.page_id;
  }

  await updateAbFields(controlRecordId, {
    ab_test_enabled: true,
    ab_variant_id: variantPageId,
    ab_test_name: testName.trim() || "A/B Test",
    ab_winner: "none",
    ab_started_at: new Date().toISOString(),
  });

  invalidateLinkPagePublicCache(control);
  const updated = await getLinkPageById(controlRecordId);
  if (!updated) throw new Error("Failed to reload page");
  return { page: updated, variantPageId };
}

export async function stopAbTest(controlRecordId: string): Promise<LinkPageRecord> {
  const control = await getLinkPageById(controlRecordId);
  if (!control) throw new Error("Page not found");
  await updateAbFields(controlRecordId, { ab_test_enabled: false });
  invalidateLinkPagePublicCache(control);
  const updated = await getLinkPageById(controlRecordId);
  if (!updated) throw new Error("Failed to reload page");
  return updated;
}

async function copyVariantContentToControl(
  control: LinkPageWithBlocks,
  variantPageId: string
): Promise<void> {
  const variantMeta = await getLinkPageByPageId(variantPageId);
  if (!variantMeta) throw new Error("Variant page not found");
  const variant = await getLinkPageById(variantMeta.id);
  if (!variant) throw new Error("Variant page not found");

  await updateLinkPage(control.id, {
    bio: variant.bio,
    profile_photo_url: variant.profile_photo_url,
    background_type: variant.background_type,
    background_value: variant.background_value,
    theme: variant.theme,
    primary_color: variant.primary_color,
    accent_color: variant.accent_color,
    font: variant.font,
    meta_description: variant.meta_description,
    verified: variant.verified,
    show_powered_by: variant.show_powered_by,
  });

  const existingBlocks = await listBlocksForPage(control.page_id);
  for (const block of existingBlocks) {
    await (async () => {
      const row = await sbSelectByPublicId(BLOCKS_TABLE, block.id);
      if (!row) return;
      await sbUpdateByPublicId(BLOCKS_TABLE, block.id, { updated_at: new Date().toISOString() }).catch(() => {});
    })();
  }
  // Use canonical delete API via link-pages-supabase for consistency
  const { deleteBlock } = await import("./link-pages-supabase");
  for (const block of existingBlocks) {
    await deleteBlock(block.id).catch(() => {});
  }

  const variantBlocks = variant.blocks.sort((a, b) => a.sort_order - b.sort_order);
  for (let i = 0; i < variantBlocks.length; i++) {
    const b = variantBlocks[i]!;
    await upsertBlock(null, {
      page_id: control.page_id,
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
}

export async function declareWinner(
  controlRecordId: string,
  winner: LinkPageAbVariant
): Promise<LinkPageRecord> {
  const control = await getLinkPageById(controlRecordId);
  if (!control) throw new Error("Page not found");
  if (!control.ab_variant_id) throw new Error("No variant configured");
  const variantPageId = control.ab_variant_id;

  if (winner === "b") {
    await copyVariantContentToControl(control, variantPageId);
  }

  const variantMeta = await getLinkPageByPageId(variantPageId);
  if (variantMeta) await archiveLinkPage(variantMeta.id);

  await updateAbFields(controlRecordId, {
    ab_test_enabled: false,
    ab_winner: winner,
    ab_variant_id: "",
    ab_started_at: "",
  });

  invalidateLinkPagePublicCache(control);
  const updated = await getLinkPageById(controlRecordId);
  if (!updated) throw new Error("Failed to reload page");
  return updated;
}

export async function getAbVariantPageWithBlocks(
  variantPageId: string
): Promise<LinkPageWithBlocks | null> {
  const page = await getLinkPageByPageId(variantPageId);
  if (!page) return null;
  const full = await getLinkPageById(page.id);
  return full;
}

// Suppress unused-symbol warnings for helpers imported for signature compatibility.
void publicId;
