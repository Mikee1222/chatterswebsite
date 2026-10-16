"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Copy, Filter, Loader2, Plus, RotateCcw } from "lucide-react";
import { PostingBriefView } from "@/components/posting-brief-view";
import { useToast } from "@/contexts/toast-context";
import { winnerVideoLocalToast } from "@/components/winner-videos-shared";
import { ROUTES } from "@/lib/routes";
import {
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_CARD,
  VA_FILTER_INPUT,
} from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import type { PostingBrief } from "@/services/posting-briefs";

type ModelOption = { id: string; model_name: string };

type Props = {
  initialBriefs: PostingBrief[];
  canManage: boolean;
  models: ModelOption[];
  modelNameById: Record<string, string>;
};

export function PostingBriefsClient({
  initialBriefs,
  canManage,
  models,
  modelNameById,
}: Props) {
  const router = useRouter();
  const { addToast } = useToast();
  const [briefs, setBriefs] = React.useState(initialBriefs);
  const [status, setStatus] = React.useState<"active" | "archived" | "all">("active");
  const [modelFilter, setModelFilter] = React.useState("");
  const [accountFilter, setAccountFilter] = React.useState("");
  const [urgentOnly, setUrgentOnly] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(
    initialBriefs[0]?.id ?? null,
  );
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const selected = briefs.find((b) => b.id === selectedId) ?? null;

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", status);
      if (modelFilter) params.set("model_id", modelFilter);
      if (accountFilter.trim()) params.set("account", accountFilter.trim());
      if (urgentOnly) params.set("priority", "urgent");
      const res = await fetch(`/api/posting-briefs?${params.toString()}`);
      const data = (await res.json()) as { briefs?: PostingBrief[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setBriefs(data.briefs ?? []);
      setSelectedId((prev) => {
        const list = data.briefs ?? [];
        if (prev && list.some((b) => b.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (e) {
      addToast(
        winnerVideoLocalToast(
          `pb-load-${Date.now()}`,
          "Could not load briefs",
          e instanceof Error ? e.message : "Try again",
          "high",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [status, modelFilter, accountFilter, urgentOnly, addToast]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, PostingBrief[]>();
    for (const b of briefs) {
      const key = `${b.model_id}::${b.account_handle || "—"}`;
      const list = map.get(key) ?? [];
      list.push(b);
      map.set(key, list);
    }
    return [...map.entries()].map(([key, items]) => {
      const first = items[0];
      return {
        key,
        modelId: first.model_id,
        modelName: modelNameById[first.model_id] || first.model_id || "Model",
        account: first.account_handle || "—",
        items,
      };
    });
  }, [briefs, modelNameById]);

  const setStatusFor = async (id: string, next: "active" | "archived") => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/posting-briefs/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed");
      addToast(
        winnerVideoLocalToast(
          `pb-status-${Date.now()}`,
          next === "archived" ? "Archived" : "Restored",
          next === "archived" ? "Brief archived" : "Brief set to active",
          "normal",
        ),
      );
      await reload();
    } catch (e) {
      addToast(
        winnerVideoLocalToast(
          `pb-status-e-${Date.now()}`,
          "Update failed",
          e instanceof Error ? e.message : "Try again",
          "high",
        ),
      );
    } finally {
      setBusyId(null);
    }
  };

  const duplicate = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/posting-briefs/${encodeURIComponent(id)}/duplicate`, {
        method: "POST",
      });
      const data = (await res.json()) as { brief?: PostingBrief; error?: string };
      if (!res.ok || !data.brief) throw new Error(data.error || "Failed");
      addToast(
        winnerVideoLocalToast(`pb-dup-${Date.now()}`, "Duplicated", "Brief copied", "normal"),
      );
      router.push(ROUTES.postingBriefEdit(data.brief.id));
    } catch (e) {
      addToast(
        winnerVideoLocalToast(
          `pb-dup-e-${Date.now()}`,
          "Duplicate failed",
          e instanceof Error ? e.message : "Try again",
          "high",
        ),
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-[#D4AF8C]/15 bg-gradient-to-br from-[#151315] via-[#0D0B0D] to-[#120810] px-5 py-7 md:px-7">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#FF1493]/10 blur-3xl" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D4AF8C]/70">
              Content pipeline
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Posting Briefs
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/50">
              {canManage
                ? "Create structured posting instructions for Marketing Executives."
                : "Read-only briefs for your assigned models — copy captions exactly."}
            </p>
          </div>
          {canManage ? (
            <Link href={ROUTES.postingBriefNew} className={cn(VA_BTN_PRIMARY, "inline-flex min-h-11 items-center gap-2 px-4")}>
              <Plus className="h-4 w-4" />
              New brief
            </Link>
          ) : null}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
        <Filter className="h-4 w-4 text-white/35" aria-hidden />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className={cn(VA_FILTER_INPUT, "min-w-[8rem]")}
        >
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </select>
        <select
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          className={cn(VA_FILTER_INPUT, "min-w-[10rem]")}
        >
          <option value="">All models</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.model_name}
            </option>
          ))}
        </select>
        <input
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
          placeholder="Account…"
          className={cn(VA_FILTER_INPUT, "min-w-[8rem] flex-1")}
        />
        <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/60">
          <input
            type="checkbox"
            checked={urgentOnly}
            onChange={(e) => setUrgentOnly(e.target.checked)}
            className="rounded border-white/20"
          />
          Urgent only
        </label>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-white/45">
          <Loader2 className="h-5 w-5 animate-spin text-[#D4AF8C]/70" />
          Loading…
        </div>
      ) : !briefs.length ? (
        <div className={cn(VA_CARD, "px-6 py-14 text-center")}>
          <p className="text-sm text-white/45">No posting briefs match these filters.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div className="space-y-4">
            {grouped.map((group) => (
              <div key={group.key} className="space-y-2">
                <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                  {group.modelName}
                  <span className="text-white/25"> · </span>
                  {group.account.startsWith("@") || group.account === "—"
                    ? group.account
                    : `@${group.account}`}
                </p>
                {group.items.map((b) => {
                  const active = b.id === selectedId;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedId(b.id)}
                      className={cn(
                        "w-full rounded-2xl border px-4 py-3 text-left transition",
                        active
                          ? "border-[#D4AF8C]/40 bg-[#D4AF8C]/10"
                          : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.14]",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-white/90">{b.title}</p>
                        {b.priority === "urgent" ? (
                          <span className="shrink-0 rounded-full border border-rose-400/35 bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-200">
                            Urgent
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-white/40">
                        {b.content_type} · {b.posts.length} post{b.posts.length === 1 ? "" : "s"}
                        {b.status === "archived" ? " · archived" : ""}
                      </p>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="min-w-0">
            {selected ? (
              <div className="space-y-4">
                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={ROUTES.postingBriefEdit(selected.id)}
                      className={cn(VA_BTN_PRIMARY, "min-h-11 px-4")}
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === selected.id}
                      onClick={() => void duplicate(selected.id)}
                      className={cn(VA_BTN_SECONDARY, "inline-flex min-h-11 items-center gap-2 px-4")}
                    >
                      <Copy className="h-4 w-4" />
                      Duplicate
                    </button>
                    {selected.status === "active" ? (
                      <button
                        type="button"
                        disabled={busyId === selected.id}
                        onClick={() => void setStatusFor(selected.id, "archived")}
                        className={cn(VA_BTN_SECONDARY, "inline-flex min-h-11 items-center gap-2 px-4")}
                      >
                        <Archive className="h-4 w-4" />
                        Archive
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === selected.id}
                        onClick={() => void setStatusFor(selected.id, "active")}
                        className={cn(VA_BTN_SECONDARY, "inline-flex min-h-11 items-center gap-2 px-4")}
                      >
                        <RotateCcw className="h-4 w-4" />
                        Unarchive
                      </button>
                    )}
                    <Link
                      href={ROUTES.postingBrief(selected.id)}
                      className={cn(VA_BTN_SECONDARY, "min-h-11 px-4")}
                    >
                      Open
                    </Link>
                  </div>
                ) : null}
                <PostingBriefView
                  brief={selected}
                  modelName={modelNameById[selected.model_id] || selected.model_id}
                />
              </div>
            ) : (
              <div className={cn(VA_CARD, "px-6 py-14 text-center text-sm text-white/40")}>
                Select a brief
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
