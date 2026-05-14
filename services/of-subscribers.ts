const THE_ONLY_API_BASE = "https://theonlyapi.com/api";
const THE_ONLY_API_KEY = process.env.THE_ONLY_API_KEY ?? "";

export type OFSubscriber = {
  of_user_id: number;
  username: string;
  display_name: string;
  subscribed_at: string;
  expires_at: string;
  total_spent: number;
};

export type OFSubscriberCategory =
  | "whale" // total_spent >= 1000
  | "vip" // total_spent >= 200
  | "high_spender" // total_spent >= 100
  | "medium" // total_spent >= 30
  | "freeloader" // total_spent < 30
  | "new"; // subscribed less than 7 days ago

export function categorizeSubscriber(sub: OFSubscriber): OFSubscriberCategory {
  const daysSinceSubscribed = (Date.now() - new Date(sub.subscribed_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceSubscribed < 7) return "new";
  if (sub.total_spent >= 1000) return "whale";
  if (sub.total_spent >= 200) return "vip";
  if (sub.total_spent >= 100) return "high_spender";
  if (sub.total_spent >= 30) return "medium";
  return "freeloader";
}

export function parseSubscriber(raw: Record<string, unknown>): OFSubscriber {
  const spent = Number(raw.total_spent);
  return {
    of_user_id: typeof raw.of_user_id === "number" ? raw.of_user_id : Number(raw.of_user_id),
    username: String(raw.username ?? ""),
    display_name: String(raw.display_name ?? ""),
    subscribed_at: String(raw.subscribed_at ?? ""),
    expires_at: String(raw.expires_at ?? ""),
    total_spent: Number.isFinite(spent) ? spent : 0,
  };
}

export async function getSubscribersForModel(
  ofUserId: string,
  limit = 100,
  offset = 0
): Promise<{ subscribers: OFSubscriber[]; has_more: boolean }> {
  if (!ofUserId || !THE_ONLY_API_KEY) return { subscribers: [], has_more: false };

  const res = await fetch(
    `${THE_ONLY_API_BASE}/of_list_subscribers?of_user_id=${encodeURIComponent(ofUserId)}&limit=${limit}&offset=${offset}&type=all`,
    {
      headers: { Authorization: `Bearer ${THE_ONLY_API_KEY}` },
      next: { revalidate: 300 },
    }
  );

  if (!res.ok) return { subscribers: [], has_more: false };

  const data = (await res.json()) as {
    subscribers?: Record<string, unknown>[];
    page?: { has_more?: boolean };
  };

  const subscribers = (data.subscribers ?? []).map((row) => parseSubscriber(row));
  return {
    subscribers,
    has_more: data.page?.has_more ?? false,
  };
}

export async function getAllSubscribersForModel(ofUserId: string): Promise<OFSubscriber[]> {
  const all: OFSubscriber[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const { subscribers, has_more } = await getSubscribersForModel(ofUserId, 100, offset);
    all.push(...subscribers);
    hasMore = has_more;
    offset += 100;
    if (subscribers.length === 0) break;
  }
  return all;
}
