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

export function SyncOFSubscribersButton({ ofAccountId, modelName }: SyncOFSubscribersButtonProps) {
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function onSync() {
    if (!ofAccountId.trim()) return;

    setLoading(true);
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

      setMessage(`✅ Sync complete — ${totalSynced} subscribers synced`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void onSync()}
        disabled={loading || !ofAccountId.trim()}
        className="inline-flex items-center justify-center rounded-lg border border-pink-400/40 bg-gradient-to-r from-pink-500 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_-8px_hsl(330_80%_55%/0.45)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {loading ? "Syncing…" : "Sync OF subscribers"}
      </button>
      {message ? <p className="text-sm text-emerald-200/90">{message}</p> : null}
      {error ? <p className="text-sm text-red-400/90">{error}</p> : null}
    </div>
  );
}
