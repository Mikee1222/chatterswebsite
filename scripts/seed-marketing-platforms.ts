#!/usr/bin/env npx tsx
/**
 * Seed default rows into `marketing_platforms` (Data API).
 * Run after: npx tsx scripts/create-marketing-tables.ts
 *
 * Usage:
 *   npx tsx scripts/seed-marketing-platforms.ts
 */

import "dotenv/config";

const PLATFORMS: Array<{
  platform_id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
}> = [
  { platform_id: "instagram", name: "Instagram", icon: "📸", color: "#E1306C", sort_order: 1 },
  { platform_id: "facebook", name: "Facebook", icon: "👥", color: "#1877F2", sort_order: 2 },
  { platform_id: "tiktok", name: "TikTok", icon: "🎵", color: "#000000", sort_order: 3 },
  { platform_id: "twitter", name: "Twitter", icon: "🐦", color: "#1DA1F2", sort_order: 4 },
  { platform_id: "youtube", name: "YouTube", icon: "▶️", color: "#FF0000", sort_order: 5 },
  { platform_id: "snapchat", name: "Snapchat", icon: "👻", color: "#FFFC00", sort_order: 6 },
];

async function dataFetch(path: string, init?: RequestInit): Promise<Response> {
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();
  const token = process.env.AIRTABLE_TOKEN?.trim();
  if (!baseId || !token) throw new Error("Missing AIRTABLE_BASE_ID or AIRTABLE_TOKEN");
  return fetch(`https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

async function listExistingPlatformIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  let offset: string | undefined;
  do {
    const q = new URLSearchParams({ pageSize: "100" });
    q.append("fields[]", "platform_id");
    if (offset) q.set("offset", offset);
    const res = await dataFetch(`marketing_platforms?${q.toString()}`);
    if (!res.ok) throw new Error(`List marketing_platforms failed (${res.status}): ${await res.text()}`);
    const data = (await res.json()) as { records?: Array<{ fields?: { platform_id?: string } }>; offset?: string };
    for (const r of data.records ?? []) {
      const pid = r.fields?.platform_id?.trim();
      if (pid) ids.add(pid.toLowerCase());
    }
    offset = data.offset;
  } while (offset);
  return ids;
}

async function main(): Promise<void> {
  const createdAt = new Date().toISOString();
  const existing = await listExistingPlatformIds();

  const toCreate = PLATFORMS.filter((p) => !existing.has(p.platform_id.toLowerCase()));
  if (toCreate.length === 0) {
    console.log("[seed-marketing-platforms] All default platforms already present. Nothing to do.");
    return;
  }

  const records = toCreate.map((p) => ({
    fields: {
      platform_id: p.platform_id,
      name: p.name,
      icon: p.icon,
      color: p.color,
      active: true,
      sort_order: p.sort_order,
      created_at: createdAt,
    },
  }));

  const res = await dataFetch("marketing_platforms", {
    method: "POST",
    body: JSON.stringify({ records, typecast: true }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(JSON.stringify(data, null, 2));
    throw new Error(`Create records failed (${res.status})`);
  }
  console.log(`[seed-marketing-platforms] Created ${toCreate.length} row(s).`, (data as { records?: unknown[] }).records?.length ?? "");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
