"use client";

import * as React from "react";

type SyncOFSubscribersButtonProps = {
  ofAccountId: string;
  modelName: string;
};

type ChunkJson = {
  success?: boolean;
  error?: string;
  synced?: number;
  errors?: number;
  has_more?: boolean;
  next_offset?: number;
};

type SyncMode = "vip" | "all";

export function SyncOFSubscribersButton({ ofAccountId, modelName }: SyncOFSubscribersButtonProps) {
  const [loadingMode, setLoadingMode] = React.useState<SyncMode | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loading = loadingMode !== null;

  async function runChunkedSync(mode: SyncMode) {
    if (!ofAccountId.trim()) return;
    const highValueOnly = mode === "vip";

    setLoadingMode(mode);
    setMessage(null);
    setError(null);

    let offset = 0;
    let totalSynced = 0;
    let hasMore = true;

    try {
      setMessage("Syncing... (0 synced so far)");
      while (hasMore) {
        const res = await fetch("/api/admin/sync-of-subscribers", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ofAccountId: ofAccountId.trim(),
            modelName: modelName.trim(),
            offset,
            highValueOnly,
          }),
        });

        const json = (await res.json().catch(() => ({}))) as ChunkJson;
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? "Sync failed");
        }

        totalSynced += typeof json.synced === "number" ? json.synced : 0;
        setMessage(`Syncing... (${totalSynced} synced so far)`);
        hasMore = Boolean(json.has_more);
        offset = typeof json.next_offset === "number" ? json.next_offset : offset + 100;

        if (hasMore) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      if (mode === "vip") {
        setMessage(`✅ VIP sync complete — ${totalSynced} subscribers synced ($500+)`);
      } else {
        setMessage(`✅ Sync complete — ${totalSynced} subscribers synced ($10+)`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setLoadingMode(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void runChunkedSync("vip")}
          disabled={loading || !ofAccountId.trim()}
          className="inline-flex items-center justify-center rounded-lg border border-amber-400/45 bg-gradient-to-r from-amber-500/90 to-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-[0_0_20px_-8px_rgba(245,158,11,0.4)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {loadingMode === "vip" ? "Syncing…" : "Sync VIP (>$500)"}
        </button>
        <button
          type="button"
          onClick={() => void runChunkedSync("all")}
          disabled={loading || !ofAccountId.trim()}
          className="inline-flex items-center justify-center rounded-lg border border-pink-400/40 bg-gradient-to-r from-pink-500 to-fuchsia-600 px-3 py-2 text-sm font-semibold text-white shadow-[0_0_24px_-8px_hsl(330_80%_55%/0.45)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {loadingMode === "all" ? "Syncing…" : "Sync all"}
        </button>
      </div>
      {message ? <p className="text-sm text-emerald-200/90">{message}</p> : null}
      {error ? <p className="text-sm text-red-400/90">{error}</p> : null}
    </div>
  );
}
