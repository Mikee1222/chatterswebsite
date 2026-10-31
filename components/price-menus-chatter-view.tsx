"use client";

import * as React from "react";
import { Copy, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { rowNegLabel, rowNormalLabel, spenderLabel, SPENDER_ORDER } from "@/lib/price-display";
import type { PriceMenu, PriceMenuRow, PriceMenuSpecial } from "@/services/price-menus";
import type { SpenderTier } from "@/services/pricing";

type ModelOption = { id: string; model_name: string };

export function PriceMenusChatterView({
  models,
  defaultModelId,
  specials,
}: {
  models: ModelOption[];
  defaultModelId?: string | null;
  specials: PriceMenuSpecial[];
}) {
  const [modelId, setModelId] = React.useState(
    defaultModelId || models[0]?.id || ""
  );
  const [menu, setMenu] = React.useState<PriceMenu | null>(null);
  const [rows, setRows] = React.useState<PriceMenuRow[]>([]);
  const [menuSpecials, setMenuSpecials] = React.useState<PriceMenuSpecial[]>(specials);
  const [loading, setLoading] = React.useState(false);
  const [spender, setSpender] = React.useState<SpenderTier>("high");
  const [q, setQ] = React.useState("");

  const filteredModels = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return models;
    return models.filter((m) => m.model_name.toLowerCase().includes(needle));
  }, [models, q]);

  React.useEffect(() => {
    if (!modelId) {
      setMenu(null);
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/price-menus/by-model/${encodeURIComponent(modelId)}`)
      .then(async (res) => {
        const data = (await res.json()) as {
          menu: PriceMenu | null;
          rows: PriceMenuRow[];
          specials: PriceMenuSpecial[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "Failed");
        if (cancelled) return;
        setMenu(data.menu);
        setRows(data.rows ?? []);
        setMenuSpecials(data.specials?.length ? data.specials : specials);
        const present = new Set((data.rows ?? []).map((r) => r.spender_tier));
        const first = SPENDER_ORDER.find((s) => present.has(s));
        if (first) setSpender(first as SpenderTier);
      })
      .catch((e) => {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Load failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [modelId, specials]);

  const tierRows = React.useMemo(
    () =>
      rows
        .filter((r) => r.spender_tier === spender)
        .sort((a, b) => a.sort_order - b.sort_order || a.level - b.level),
    [rows, spender]
  );

  const availableSpenders = React.useMemo(() => {
    const present = new Set(rows.map((r) => r.spender_tier));
    const list = SPENDER_ORDER.filter((s) => present.has(s));
    return list.length ? list : SPENDER_ORDER;
  }, [rows]);

  const copyPrice = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
      active
        ? "border-amber-400/50 bg-amber-500/20 text-amber-50"
        : "border-white/10 bg-white/5 text-white/55"
    );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent p-4 backdrop-blur-xl">
        <label className="text-[11px] font-bold uppercase tracking-wider text-white/40">
          Model
        </label>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter models"
            className="mb-2 w-full rounded-xl border border-white/10 bg-black/30 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-amber-500/40"
          />
        </div>
        <select
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-base font-medium text-white outline-none focus:border-amber-500/40"
        >
          {filteredModels.length === 0 ? (
            <option value="">No models</option>
          ) : (
            filteredModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.model_name}
              </option>
            ))
          )}
        </select>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-white/40">Loading menu…</p>
      ) : !menu ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-14 text-center">
          <p className="text-sm font-medium text-white/70">No price menu linked</p>
          <p className="mt-1 text-xs text-white/40">
            Ask a manager to assign this model to a Greece or USA menu.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-white">{menu.name}</h2>
            <span
              className={cn(
                "rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase",
                menu.market === "greece"
                  ? "border-sky-500/30 bg-sky-500/15 text-sky-200"
                  : "border-violet-500/30 bg-violet-500/15 text-violet-200"
              )}
            >
              {menu.market === "greece" ? "Greece" : "USA"}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {availableSpenders.map((s) => (
              <button
                key={s}
                type="button"
                className={chip(spender === s)}
                onClick={() => setSpender(s as SpenderTier)}
              >
                {spenderLabel(s)}
              </button>
            ))}
          </div>

          <ul className="space-y-2">
            {tierRows.map((row) => {
              const normal = rowNormalLabel(row);
              const neg = rowNegLabel(row);
              return (
                <li
                  key={row.id}
                  className="rounded-2xl border border-white/10 bg-black/30 p-3 backdrop-blur-xl"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                        Level {row.level}
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums text-white">
                        {normal}
                      </p>
                      <p className="mt-0.5 text-sm text-white/55">
                        Neg:{" "}
                        {neg.toUpperCase() === "TW" ? (
                          <span className="rounded border border-white/15 bg-white/8 px-1 text-[11px] font-semibold uppercase text-white/45">
                            TW
                          </span>
                        ) : (
                          neg || "—"
                        )}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-white/65">
                        {row.description}
                      </p>
                      {row.notes ? (
                        <p className="mt-1 text-xs text-white/40">{row.notes}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyPrice(normal)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-amber-500/35 bg-amber-500/15 px-3 py-2.5 text-xs font-semibold text-amber-50 active:scale-[0.98]"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-white/45">
              Specials
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {menuSpecials.map((s) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.06] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-white">{s.label}</p>
                      <p className="mt-1 text-sm tabular-nums text-white/80">
                        {rowNormalLabel({
                          id: s.id,
                          menu_id: "",
                          spender_tier: "high",
                          level: 1,
                          price_min: s.price_min,
                          price_max: s.price_max,
                          price_plus: s.price_plus,
                          neg_min: s.neg_min,
                          neg_max: s.neg_max,
                          neg_text: s.neg_text,
                          description: "",
                          notes: "",
                          raw_price_normal: s.raw_price_normal,
                          raw_price_negotiation: s.raw_price_negotiation,
                          is_active: true,
                          sort_order: 0,
                        })}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-white/50">{s.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        copyPrice(
                          rowNormalLabel({
                            id: s.id,
                            menu_id: "",
                            spender_tier: "high",
                            level: 1,
                            price_min: s.price_min,
                            price_max: s.price_max,
                            price_plus: s.price_plus,
                            neg_min: null,
                            neg_max: null,
                            neg_text: null,
                            description: "",
                            notes: "",
                            raw_price_normal: s.raw_price_normal,
                            raw_price_negotiation: "",
                            is_active: true,
                            sort_order: 0,
                          })
                        )
                      }
                      className="rounded-lg border border-white/15 p-2 text-white/70"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
