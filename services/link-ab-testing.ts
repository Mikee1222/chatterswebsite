import { createHash } from "node:crypto";
import {
  createRecord,
  updateRecord,
  listAllRecords,
  deleteRecord,
  invalidateListRecordsReadCacheForTable,
} from "@/lib/airtable-server";
import {
  LINK_PAGES_TABLE,
  LINK_PAGE_BLOCKS_TABLE,
  LINK_AB_RESULTS_TABLE,
} from "@/lib/link-pages-schema";
import {
  getLinkPageById,
  getLinkPageByPageId,
  createLinkPage,
  updateLinkPage,
  upsertBlock,
  listBlocksForPage,
  invalidateLinkPagePublicCache,
} from "@/services/link-pages";
import { ymdInAthens } from "@/lib/link-page-analytics-utils";
import type {
  AbTestResults,
  AbVariantMetrics,
  LinkPageAbEventType,
  LinkPageAbVariant,
  LinkPageAbWinner,
  LinkPageRecord,
  LinkPageWithBlocks,
} from "@/types";

type AbResultFields = {
  event_id?: string;
  page_id?: string;
  variant?: string;
  event_type?: string;
  session_id?: string;
  block_id?: string;
  timestamp?: string;
};

type AbPageFields = {
  ab_test_enabled?: boolean;
  ab_variant_id?: string;
  ab_test_name?: string;
  ab_winner?: string;
  ab_started_at?: string;
  updated_at?: string;
};

function escapeFormulaString(s: string): string {
  return s.replace(/"/g, '""');
}

function newAbEventId(): string {
  return `abe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseVariant(raw: string | undefined): LinkPageAbVariant {
  return raw === "b" ? "b" : "a";
}

function parseAbEventType(raw: string | undefined): LinkPageAbEventType {
  return raw === "click" ? "click" : "view";
}

/** Deterministic 50/50 split by session + control page id. */
export function getAbVariantForSession(sessionId: string, controlPageId: string): LinkPageAbVariant {
  const hash = createHash("sha256").update(`${sessionId}:${controlPageId}`).digest("hex");
  const bucket = parseInt(hash.slice(0, 8), 16);
  return bucket % 2 === 0 ? "a" : "b";
}

export type AbTrackContext = {
  pageId: string;
  variant: LinkPageAbVariant;
  eventType: LinkPageAbEventType;
  sessionId: string;
  blockId?: string;
};

/** Fire-and-forget A/B event write. */
export function trackAbEvent(ctx: AbTrackContext): void {
  if (!ctx.pageId || !ctx.sessionId) return;
  const now = new Date().toISOString();
  void createRecord<AbResultFields>(LINK_AB_RESULTS_TABLE, {
    event_id: newAbEventId(),
    page_id: ctx.pageId.trim(),
    variant: ctx.variant,
    event_type: ctx.eventType,
    session_id: ctx.sessionId.trim(),
    block_id: ctx.blockId?.trim() ?? "",
    timestamp: now,
  }).catch((err) => {
    console.error("[link-ab-testing] trackAbEvent failed:", err);
  });
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t *
      Math.exp(-ax * ax));
  return sign * y;
}

function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function chiSquare2x2(aSuccess: number, aFail: number, bSuccess: number, bFail: number): number {
  const n = aSuccess + aFail + bSuccess + bFail;
  if (n === 0) return 0;
  const denom = (aSuccess + aFail) * (bSuccess + bFail) * (aSuccess + bSuccess) * (aFail + bFail);
  if (denom === 0) return 0;
  const num = n * Math.pow(aSuccess * bFail - aFail * bSuccess, 2);
  return num / denom;
}

function chiSquareConfidence(aSuccess: number, aFail: number, bSuccess: number, bFail: number): number {
  const chi2 = chiSquare2x2(aSuccess, aFail, bSuccess, bFail);
  if (chi2 <= 0) return 0;
  const pValue = 2 * (1 - normalCdf(Math.sqrt(chi2)));
  return Math.round(Math.max(0, Math.min(100, (1 - pValue) * 100)));
}

export function calculateWinner(
  variantA: AbVariantMetrics,
  variantB: AbVariantMetrics
): LinkPageAbVariant | null {
  const totalSessions = variantA.sessions + variantB.sessions;
  const ctrDiff = Math.abs(variantA.ctr - variantB.ctr);

  const aNoClick = Math.max(0, variantA.sessions - variantA.sessionsWithClicks);
  const bNoClick = Math.max(0, variantB.sessions - variantB.sessionsWithClicks);
  const confidence = chiSquareConfidence(
    variantA.sessionsWithClicks,
    aNoClick,
    variantB.sessionsWithClicks,
    bNoClick
  );

  if (totalSessions > 100 && ctrDiff > 0.05) {
    return variantA.ctr >= variantB.ctr ? "a" : "b";
  }
  if (confidence >= 95 && variantA.ctr !== variantB.ctr) {
    return variantA.ctr > variantB.ctr ? "a" : "b";
  }
  return null;
}

function aggregateMetrics(
  events: Array<{ variant: LinkPageAbVariant; event_type: LinkPageAbEventType; session_id: string }>
): { a: AbVariantMetrics; b: AbVariantMetrics } {
  const viewSessions: Record<LinkPageAbVariant, Set<string>> = { a: new Set(), b: new Set() };
  const clickSessions: Record<LinkPageAbVariant, Set<string>> = { a: new Set(), b: new Set() };
  let viewsA = 0;
  let viewsB = 0;
  let clicksA = 0;
  let clicksB = 0;

  for (const ev of events) {
    const sid = ev.session_id.trim();
    if (!sid) continue;
    if (ev.event_type === "view") {
      viewSessions[ev.variant].add(sid);
      if (ev.variant === "a") viewsA++;
      else viewsB++;
    } else {
      clickSessions[ev.variant].add(sid);
      if (ev.variant === "a") clicksA++;
      else clicksB++;
    }
  }

  function build(variant: LinkPageAbVariant, views: number, clicks: number): AbVariantMetrics {
    const sessions = viewSessions[variant].size;
    const sessionsWithClicks = [...clickSessions[variant]].filter((s) => viewSessions[variant].has(s)).length;
    const ctr = sessions > 0 ? sessionsWithClicks / sessions : 0;
    return { variant, views, clicks, sessions, sessionsWithClicks, ctr };
  }

  return {
    a: build("a", viewsA, clicksA),
    b: build("b", viewsB, clicksB),
  };
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
  const records = await listAllRecords<AbResultFields>(LINK_AB_RESULTS_TABLE, {
    filterByFormula: `{page_id}="${escapeFormulaString(controlPageId)}"`,
    _caller: "link-ab-results",
  });

  const events = records.map((rec) => ({
    variant: parseVariant(rec.fields.variant),
    event_type: parseAbEventType(rec.fields.event_type),
    session_id: rec.fields.session_id ?? "",
    timestamp: rec.fields.timestamp ?? "",
  }));

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

async function updateAbFields(recordId: string, patch: Partial<AbPageFields>): Promise<void> {
  await updateRecord<AbPageFields>(LINK_PAGES_TABLE, recordId, {
    ...patch,
    updated_at: new Date().toISOString(),
  });
  invalidateListRecordsReadCacheForTable(LINK_PAGES_TABLE);
}

/** Full page + blocks clone for variant B. */
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
    await deleteRecord(LINK_PAGE_BLOCKS_TABLE, block.id);
  }

  const variantBlocks = variant.blocks.sort((a, b) => a.sort_order - b.sort_order);
  for (let i = 0; i < variantBlocks.length; i++) {
    const b = variantBlocks[i];
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

  invalidateListRecordsReadCacheForTable(LINK_PAGE_BLOCKS_TABLE);
}

export async function declareWinner(
  controlRecordId: string,
  winner: LinkPageAbVariant
): Promise<LinkPageRecord> {
  const control = await getLinkPageById(controlRecordId);
  if (!control) throw new Error("Page not found");
  if (!control.ab_variant_id) throw new Error("No variant configured");

  if (winner === "b") {
    await copyVariantContentToControl(control, control.ab_variant_id);
  }

  await updateAbFields(controlRecordId, {
    ab_test_enabled: false,
    ab_winner: winner,
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
