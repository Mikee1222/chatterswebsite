"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Copy, Plus, RotateCcw, Send } from "lucide-react";
import { PostingBriefView } from "@/components/posting-brief-view";
import { useToast } from "@/contexts/toast-context";
import { winnerVideoLocalToast } from "@/components/winner-videos-shared";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { PostingBrief } from "@/services/posting-briefs";
import { DAILY_POSTING_TARGET } from "@/lib/winner-sourcing-helpers";

/** Posts marked posted today (local day), per placement/source — the VA's daily rhythm. */
function todayPostingCounts(briefs: PostingBrief[], modelId: string) {
  const today = new Date().toDateString();
  const c = { grid: 0, grid_proven: 0, grid_experimental: 0, trials: 0, outliers: 0 };
  for (const b of briefs) {
    if (modelId && b.model_id !== modelId) continue;
    for (const p of b.posts) {
      if (!p.posted_at || new Date(p.posted_at).toDateString() !== today) continue;
      if (p.placement === "trial") c.trials += 1;
      else {
        c.grid += 1;
        if (p.content_source === "proven") c.grid_proven += 1;
        if (p.content_source === "experimental") c.grid_experimental += 1;
      }
      if (p.outlier_status === "outlier" || p.outlier_status === "hot") c.outliers += 1;
    }
  }
  return c;
}

function postingProgressHint(b: PostingBrief): string {
  const total = b.posts.length;
  const posted = b.posts.filter((p) => !!p.posted_at).length;
  const base = `${b.content_type} · ${total} post${total === 1 ? "" : "s"}`;
  return total && posted ? `${base} · ${posted}/${total} posted` : base;
}
import {
  BriefBoardColumn,
  BriefCard,
  BriefCardSkeleton,
  BriefEmptyState,
  BriefFilterToolbar,
  BriefPageHeader,
  BriefStatsRow,
  computeBriefListStats,
  sortBriefsByUrgencyThenDeadline,
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_CARD,
  VA_FILTER_INPUT,
} from "@/components/briefs/shared";

type ModelOption = { id: string; model_name: string };

type Props = {
  initialBriefs: PostingBrief[];
  canManage: boolean;
  models: ModelOption[];
  modelNameById: Record<string, string>;
};

type SortMode = "urgency" | "title" | "account";

export function PostingBriefsClient({
  initialBriefs,
  canManage,
  models,
  modelNameById,
}: Props) {
  const router = useRouter();
  const { addToast } = useToast();
  const [briefs, setBriefs] = React.useState(initialBriefs);
  const [status, setStatus] = React.useState<"active" | "draft" | "archived" | "all">("active");
  const [modelFilter, setModelFilter] = React.useState("");
  const [accountFilter, setAccountFilter] = React.useState("");
  const [urgentOnly, setUrgentOnly] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [sortMode, setSortMode] = React.useState<SortMode>("urgency");
  const [viewMode, setViewMode] = React.useState<"list" | "board">("list");
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

  const filtered = React.useMemo(() => {
    let list = briefs;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (b) =>
          (b.title || "").toLowerCase().includes(q) ||
          (b.account_handle || "").toLowerCase().includes(q),
      );
    }
    if (sortMode === "urgency") {
      list = sortBriefsByUrgencyThenDeadline(
        list.map((b) => ({ ...b, deadline_at: null })),
      );
    } else if (sortMode === "title") {
      list = [...list].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } else {
      list = [...list].sort((a, b) =>
        (a.account_handle || "").localeCompare(b.account_handle || ""),
      );
    }
    return list;
  }, [briefs, search, sortMode]);

  const today = React.useMemo(() => todayPostingCounts(briefs, modelFilter), [briefs, modelFilter]);

  const stats = React.useMemo(() => {
    const base = computeBriefListStats(
      briefs.map((b) => ({
        ...b,
        deadline_at: null as string | null,
      })),
      {
        isActive: (b) => b.status === "active",
      },
    );
    return {
      ...base,
      active: briefs.filter((b) => b.status === "active").length,
      urgent: briefs.filter((b) => b.status === "active" && b.priority === "urgent").length,
    };
  }, [briefs]);

  const setStatusFor = async (id: string, next: "active" | "archived", from?: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/posting-briefs/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed");
      const published = next === "active" && from === "draft";
      addToast(
        winnerVideoLocalToast(
          `pb-status-${Date.now()}`,
          next === "archived" ? "Archived" : published ? "Published" : "Restored",
          next === "archived"
            ? "Brief archived"
            : published
              ? "Brief published — assigned VAs notified"
              : "Brief set to active",
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

  const chips = [
    modelFilter
      ? {
          key: "model",
          label: models.find((m) => m.id === modelFilter)?.model_name || "Model",
          clear: () => setModelFilter(""),
        }
      : null,
    accountFilter.trim()
      ? {
          key: "account",
          label: `Account: ${accountFilter.trim()}`,
          clear: () => setAccountFilter(""),
        }
      : null,
    status !== "active"
      ? { key: "status", label: `Status: ${status}`, clear: () => setStatus("active") }
      : null,
    urgentOnly ? { key: "urgent", label: "Urgent", clear: () => setUrgentOnly(false) } : null,
    search.trim()
      ? { key: "search", label: `“${search.trim()}”`, clear: () => setSearch("") }
      : null,
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  const filterControls = (
    <>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">
          Status
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className={cn(VA_FILTER_INPUT, "min-h-11")}
        >
          <option value="active">Active</option>
          {canManage ? <option value="draft">Draft</option> : null}
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">
          Model
        </label>
        <select
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          className={cn(VA_FILTER_INPUT, "min-h-11")}
        >
          <option value="">All models</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.model_name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">
          Account
        </label>
        <input
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
          placeholder="Account…"
          className={cn(VA_FILTER_INPUT, "min-h-11 min-w-[8rem]")}
        />
      </div>
      <label className="inline-flex min-h-11 items-center gap-2 text-sm text-white/70">
        <input
          type="checkbox"
          checked={urgentOnly}
          onChange={(e) => setUrgentOnly(e.target.checked)}
          className="h-5 w-5 rounded border-white/20"
        />
        Urgent only
      </label>
    </>
  );

  return (
    <div className="space-y-6">
      <BriefPageHeader
        eyebrow="Content pipeline"
        title="Posting Briefs"
        description={
          canManage
            ? "Create structured posting instructions for Marketing Executives."
            : "Read-only briefs for your assigned models — copy captions exactly."
        }
        action={
          canManage ? (
            <Link
              href={ROUTES.postingBriefNew}
              className={cn(VA_BTN_PRIMARY, "inline-flex min-h-11 items-center gap-2 px-4")}
            >
              <Plus className="h-4 w-4" />
              New brief
            </Link>
          ) : null
        }
      />

      <BriefStatsRow
        stats={[
          { label: "Active", value: stats.active, accent: "champagne" },
          { label: "Urgent", value: stats.urgent, accent: "pink" },
          {
            label: "Total shown",
            value: filtered.length,
            accent: "emerald",
            tooltip: "Briefs matching current filters",
          },
          {
            label: `Grid today / ${DAILY_POSTING_TARGET.grid}`,
            value: today.grid,
            accent: "champagne",
            tooltip: `Originals posted to the grid today${modelFilter ? "" : " (all models — pick a model for the per-model rhythm)"}: ${today.grid_proven} proven / ${DAILY_POSTING_TARGET.grid_proven}, ${today.grid_experimental} experimental / ${DAILY_POSTING_TARGET.grid_experimental}`,
          },
          {
            label: `Trials today / ${DAILY_POSTING_TARGET.trials}`,
            value: today.trials,
            accent: "pink",
            tooltip: "Variations posted to trials today (2 per original)",
          },
          {
            label: "Outliers today",
            value: today.outliers,
            accent: "emerald",
            tooltip: "Posts whose 24h check came back ≥ 2.5× the feed average",
          },
        ]}
      />

      <BriefFilterToolbar
        search={search}
        onSearchChange={setSearch}
        chips={chips}
        onClearAll={() => {
          setSearch("");
          setModelFilter("");
          setAccountFilter("");
          setUrgentOnly(false);
          setStatus("active");
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showBoard={canManage}
        filterControls={filterControls}
        sortControl={
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">
              Sort
            </label>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className={cn(VA_FILTER_INPUT, "min-h-11")}
            >
              <option value="urgency">Urgent first</option>
              <option value="title">Title</option>
              <option value="account">Account</option>
            </select>
          </div>
        }
      />

      {loading && !briefs.length ? (
        <BriefCardSkeleton />
      ) : viewMode === "board" && canManage ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {(
            [
              { id: "draft", label: "Draft" },
              { id: "active", label: "Active" },
              { id: "archived", label: "Archived" },
            ] as const
          ).map((col) => {
            const items = filtered.filter((b) => b.status === col.id);
            return (
              <BriefBoardColumn key={col.id} title={col.label} count={items.length}>
                {items.map((b) => (
                  <BriefCard
                    key={b.id}
                    selected={selectedId === b.id}
                    onClick={() => setSelectedId(b.id)}
                    title={b.title}
                    modelName={modelNameById[b.model_id]}
                    priority={b.priority}
                    status={b.status}
                    progressHint={postingProgressHint(b)}
                  />
                ))}
              </BriefBoardColumn>
            );
          })}
        </div>
      ) : !filtered.length ? (
        <BriefEmptyState title="No posting briefs match these filters." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div className="space-y-2">
            {filtered.map((b) => (
              <BriefCard
                key={b.id}
                selected={selectedId === b.id}
                onClick={() => setSelectedId(b.id)}
                title={b.title}
                modelName={
                  `${modelNameById[b.model_id] || b.model_id}${
                    b.account_handle
                      ? ` · ${b.account_handle.startsWith("@") ? b.account_handle : `@${b.account_handle}`}`
                      : ""
                  }`
                }
                priority={b.priority}
                status={b.status}
                progressHint={postingProgressHint(b)}
              />
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
                      className={cn(
                        VA_BTN_SECONDARY,
                        "inline-flex min-h-11 items-center gap-2 px-4",
                      )}
                    >
                      <Copy className="h-4 w-4" />
                      Duplicate
                    </button>
                    {selected.status === "active" ? (
                      <button
                        type="button"
                        disabled={busyId === selected.id}
                        onClick={() => void setStatusFor(selected.id, "archived")}
                        className={cn(
                          VA_BTN_SECONDARY,
                          "inline-flex min-h-11 items-center gap-2 px-4",
                        )}
                      >
                        <Archive className="h-4 w-4" />
                        Archive
                      </button>
                    ) : selected.status === "draft" ? (
                      <button
                        type="button"
                        disabled={busyId === selected.id}
                        onClick={() => void setStatusFor(selected.id, "active", "draft")}
                        className={cn(
                          VA_BTN_PRIMARY,
                          "inline-flex min-h-11 items-center gap-2 px-4",
                        )}
                        title="Make it visible to the assigned VAs and notify them"
                      >
                        <Send className="h-4 w-4" />
                        Publish
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === selected.id}
                        onClick={() => void setStatusFor(selected.id, "active")}
                        className={cn(
                          VA_BTN_SECONDARY,
                          "inline-flex min-h-11 items-center gap-2 px-4",
                        )}
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
                  onBriefChange={(fresh) =>
                    setBriefs((prev) => prev.map((b) => (b.id === fresh.id ? fresh : b)))
                  }
                />
              </div>
            ) : (
              <BriefEmptyState title="Select a brief" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
