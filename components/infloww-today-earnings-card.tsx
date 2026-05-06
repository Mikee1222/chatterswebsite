"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { RefreshingIndicator } from "@/components/refreshing-indicator";
import {
  useAdaptiveRefreshInterval,
  useInflowwTodayEarnings,
} from "@/lib/hooks/use-dashboard-data";

/** Must match `INFLOWW_ONLYFANS_NET_MULTIPLIER` in `lib/infloww-api.ts`. */
const OF_NET_MULT = 0.8;

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
}

type TodayPayload = { date: string; gross: number; net: number; agency_cut: number };

export type InflowwTodayEarningsCardProps = {
  /** Larger typography and padding for model home hero. */
  variant?: "default" | "hero";
  className?: string;
};

export function InflowwTodayEarningsCard(props: InflowwTodayEarningsCardProps = {}) {
  const { variant = "default", className } = props;
  const [pulse, setPulse] = React.useState(false);
  const prevGross = React.useRef<number | null>(null);
  const refreshInterval = useAdaptiveRefreshInterval(60_000, 0);
  const query = useInflowwTodayEarnings({ refreshInterval });
  const data: TodayPayload | null = query.data ?? null;
  const error = query.error?.message ?? null;

  React.useEffect(() => {
    if (!data) return;
    if (prevGross.current !== null && prevGross.current !== data.gross) {
      setPulse(true);
      window.setTimeout(() => setPulse(false), 600);
    }
    prevGross.current = data.gross;
  }, [data]);

  const hero = variant === "hero";

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-black/50 shadow-[0_0_32px_-8px_rgba(236,72,153,0.12)] backdrop-blur-xl transition-[transform,box-shadow] duration-500 ease-out",
        hero
          ? "relative overflow-hidden bg-gradient-to-br from-pink-500/15 via-black/60 to-fuchsia-950/25 p-8 md:p-10"
          : "p-6",
        pulse && "scale-[1.01] ring-2 ring-[hsl(330,80%,55%)]/45",
        className
      )}
      style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 0 40px -10px hsl(330 80% 55% / 0.15)" }}
    >
      {hero ? (
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-pink-500/20 blur-3xl"
          aria-hidden
        />
      ) : null}
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className={cn("font-semibold uppercase tracking-wider text-white/50", hero ? "text-sm" : "text-xs")}>
            Today&apos;s earnings
          </p>
          <p className={cn("text-white/40", hero ? "mt-1.5 text-xs md:text-sm" : "mt-1 text-[11px]")}>
            Infloww · Athens calendar day · Loads on visit
          </p>
        </div>
        <RefreshingIndicator isRefreshing={query.isValidating && !query.isLoading} />
      </div>
      {error ? (
        <p className={cn("text-red-300/90", hero ? "relative mt-6 text-sm" : "relative mt-4 text-sm")}>{error}</p>
      ) : (
        <>
          <p
            className={cn(
              "relative font-bold tabular-nums tracking-tight text-white",
              hero ? "mt-6 text-4xl sm:text-5xl md:text-6xl" : "mt-4 text-3xl sm:text-4xl"
            )}
          >
            {data ? money(data.gross) : "—"}
          </p>
          <p className={cn("text-white/55", hero ? "relative mt-2 text-base" : "relative mt-1 text-sm")}>
            Gross (all creators)
          </p>
          {data ? (
            <p className={cn("text-white/45", hero ? "relative mt-4 text-sm" : "relative mt-3 text-xs")}>
              Net after OF ({Math.round(OF_NET_MULT * 100)}%):{" "}
              <span className="font-semibold text-pink-100/90">{money(data.net)}</span>
              {data.agency_cut > 0.001 ? (
                <>
                  {" "}
                  · Agency: <span className="font-medium text-white/75">{money(data.agency_cut)}</span>
                </>
              ) : null}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
