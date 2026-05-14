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
  checked?: number;
  errors?: number;
  has_more?: boolean;
  next_offset?: number;
};

type SyncMode = "vip" | "all";

type StoredProgress = {
  offset: number;
  totalSynced: number;
  totalChecked: number;
  highValueOnly: boolean;
};

type PausedSnapshot = {
  offset: number;
  totalSynced: number;
  totalChecked: number;
  mode: SyncMode;
};

const RETRY_DELAY_MS = 2000;
const MAX_FETCH_ATTEMPTS = 3;

function progressKey(ofAccountId: string): string {
  return `sync_progress_${ofAccountId.trim()}`;
}

function loadStoredProgress(ofAccountId: string): StoredProgress | null {
  if (typeof window === "undefined" || !ofAccountId.trim()) return null;
  try {
    const raw = localStorage.getItem(progressKey(ofAccountId));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<StoredProgress>;
    if (
      typeof p.offset !== "number" ||
      !Number.isFinite(p.offset) ||
      p.offset < 0 ||
      typeof p.totalSynced !== "number" ||
      !Number.isFinite(p.totalSynced) ||
      p.totalSynced < 0
    ) {
      return null;
    }
    if (p.highValueOnly !== true && p.highValueOnly !== false) return null;
    const totalChecked =
      typeof p.totalChecked === "number" && Number.isFinite(p.totalChecked) && p.totalChecked >= 0
        ? Math.floor(p.totalChecked)
        : 0;
    return {
      offset: Math.floor(p.offset),
      totalSynced: Math.floor(p.totalSynced),
      totalChecked,
      highValueOnly: p.highValueOnly,
    };
  } catch {
    return null;
  }
}

function saveProgress(ofAccountId: string, p: StoredProgress): void {
  if (typeof window === "undefined" || !ofAccountId.trim()) return;
  try {
    localStorage.setItem(progressKey(ofAccountId), JSON.stringify(p));
  } catch {
    /* ignore quota / private mode */
  }
}

function clearProgress(ofAccountId: string): void {
  if (typeof window === "undefined" || !ofAccountId.trim()) return;
  try {
    localStorage.removeItem(progressKey(ofAccountId));
  } catch {
    /* ignore */
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableFailure(err: unknown, res: Response | null): boolean {
  if (res) {
    if (res.status >= 500 && res.status <= 504) return true;
    if (res.status === 0) return true;
  }
  if (err instanceof TypeError) {
    const m = String(err.message || "").toLowerCase();
    if (m.includes("fetch") || m.includes("network") || m.includes("failed")) return true;
  }
  if (err instanceof DOMException && err.name === "AbortError") return false;
  if (err instanceof DOMException) {
    const n = err.name || "";
    if (n === "NetworkError" || n === "TimeoutError") return true;
  }
  return false;
}

async function fetchSyncChunkWithRetries(
  ofAccountId: string,
  modelName: string,
  offset: number,
  highValueOnly: boolean
): Promise<ChunkJson> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < MAX_FETCH_ATTEMPTS; attempt += 1) {
    let res: Response | null = null;
    try {
      res = await fetch("/api/admin/sync-of-subscribers", {
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

      const text = await res.text();
      let json: ChunkJson = {};
      try {
        json = text ? (JSON.parse(text) as ChunkJson) : {};
      } catch {
        json = {};
      }

      if (!res.ok || !json.success) {
        const msg = json.error ?? `Sync failed (${res.status})`;
        if (isRetryableFailure(new Error(msg), res) && attempt < MAX_FETCH_ATTEMPTS - 1) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        throw new Error(msg);
      }

      return json;
    } catch (e) {
      lastErr = e;
      if (attempt < MAX_FETCH_ATTEMPTS - 1 && isRetryableFailure(e, res)) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      throw e instanceof Error ? e : new Error("Sync failed.");
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Sync failed after retries.");
}

export function SyncOFSubscribersButton({ ofAccountId, modelName }: SyncOFSubscribersButtonProps) {
  const [loadingMode, setLoadingMode] = React.useState<SyncMode | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pausedSnapshot, setPausedSnapshot] = React.useState<PausedSnapshot | null>(null);
  const [storageResume, setStorageResume] = React.useState<StoredProgress | null>(null);

  const loading = loadingMode !== null;

  React.useEffect(() => {
    if (!ofAccountId.trim()) {
      setStorageResume(null);
      return;
    }
    setStorageResume(loadStoredProgress(ofAccountId));
  }, [ofAccountId]);

  async function runChunkedSync(
    mode: SyncMode,
    resume?: { offset: number; totalSynced: number; totalChecked: number }
  ): Promise<void> {
    if (!ofAccountId.trim()) return;
    const highValueOnly = mode === "vip";
    const freshStart = !resume;

    if (freshStart) {
      clearProgress(ofAccountId);
      setStorageResume(null);
    }

    setPausedSnapshot(null);
    setLoadingMode(mode);
    setMessage(null);
    setError(null);

    let offset = resume?.offset ?? 0;
    let totalSynced = resume?.totalSynced ?? 0;
    let totalChecked = resume?.totalChecked ?? 0;
    let hasMore = true;

    try {
      setMessage(`Syncing... (${totalSynced} saved, ${totalChecked} checked so far)`);
      while (hasMore) {
        let json: ChunkJson;
        try {
          json = await fetchSyncChunkWithRetries(ofAccountId, modelName, offset, highValueOnly);
        } catch (e) {
          setPausedSnapshot({ offset, totalSynced, totalChecked, mode });
          setError(null);
          setMessage(`Sync paused at ${totalSynced} synced — tap to resume`);
          return;
        }

        totalSynced += typeof json.synced === "number" ? json.synced : 0;
        totalChecked += typeof json.checked === "number" ? json.checked : 0;
        hasMore = Boolean(json.has_more);
        offset = typeof json.next_offset === "number" ? json.next_offset : offset + 100;

        saveProgress(ofAccountId, { offset, totalSynced, totalChecked, highValueOnly });
        setStorageResume({ offset, totalSynced, totalChecked, highValueOnly });
        setMessage(`Syncing... (${totalSynced} saved, ${totalChecked} checked so far)`);

        if (hasMore) {
          await sleep(500);
        }
      }

      clearProgress(ofAccountId);
      setStorageResume(null);
      setPausedSnapshot(null);

      if (mode === "vip") {
        setMessage(`✅ VIP sync complete — ${totalSynced} saved to Airtable (${totalChecked} checked)`);
      } else {
        setMessage(`✅ Sync complete — ${totalSynced} saved to Airtable (${totalChecked} checked)`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setLoadingMode(null);
    }
  }

  function resumeFromPaused() {
    if (!pausedSnapshot || !ofAccountId.trim()) return;
    void runChunkedSync(pausedSnapshot.mode, {
      offset: pausedSnapshot.offset,
      totalSynced: pausedSnapshot.totalSynced,
      totalChecked: pausedSnapshot.totalChecked,
    });
  }

  function resumeFromStorage() {
    const p = storageResume;
    if (!p || !ofAccountId.trim()) return;
    const mode: SyncMode = p.highValueOnly ? "vip" : "all";
    void runChunkedSync(mode, {
      offset: p.offset,
      totalSynced: p.totalSynced,
      totalChecked: p.totalChecked,
    });
  }

  const showStorageResume =
    storageResume != null &&
    (storageResume.totalSynced > 0 || storageResume.totalChecked > 0 || storageResume.offset > 0) &&
    pausedSnapshot === null &&
    !loading;

  return (
    <div className="space-y-2">
      {showStorageResume ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2">
          <p className="text-xs text-sky-100/90">
            Resume sync ({storageResume.totalSynced} saved, {storageResume.totalChecked} checked)
          </p>
          <button
            type="button"
            onClick={() => void resumeFromStorage()}
            disabled={loading || !ofAccountId.trim()}
            className="rounded-md border border-sky-400/50 bg-sky-500/25 px-2.5 py-1 text-xs font-semibold text-sky-50 hover:bg-sky-500/35 disabled:opacity-40"
          >
            Resume
          </button>
        </div>
      ) : null}

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

      {pausedSnapshot ? (
        <button
          type="button"
          onClick={() => resumeFromPaused()}
          disabled={loading || !ofAccountId.trim()}
          className="rounded-lg border border-white/15 bg-white/[0.08] px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/[0.12] disabled:opacity-40"
        >
          Resume
        </button>
      ) : null}
    </div>
  );
}
