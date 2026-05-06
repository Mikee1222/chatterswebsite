import { cn } from "@/lib/utils";

function Shimmer({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "block animate-pulse rounded-lg bg-gradient-to-r from-white/[0.07] via-white/[0.12] to-white/[0.07] bg-[length:200%_100%]",
        className
      )}
      aria-hidden
    />
  );
}

/** Table-style skeleton for admin models / accounts lists. */
export function AdminTableSkeleton({
  rows = 8,
  columns = 6,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("glass-card overflow-hidden p-4 md:p-0", className)}>
      <div className="hidden md:block">
        <div className="border-b border-white/10 bg-black/40 px-3 py-3">
          <div className="flex gap-3">
            {Array.from({ length: columns }).map((_, i) => (
              <Shimmer key={i} className="h-3 flex-1 max-w-[120px]" />
            ))}
          </div>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="flex items-center gap-3 px-3 py-3">
              <Shimmer className="h-9 w-9 shrink-0 rounded-xl" />
              <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                {Array.from({ length: columns - 1 }).map((__, c) => (
                  <Shimmer key={c} className="h-4 flex-1 basis-[100px] max-w-[160px]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3 md:hidden">
        {Array.from({ length: Math.min(rows, 5) }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <Shimmer className="h-4 w-full max-w-[200px]" />
            <Shimmer className="mt-3 h-3 w-full max-w-[280px]" />
            <Shimmer className="mt-2 h-3 w-1/2 max-w-[140px]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Card grid skeleton (e.g. admin whales). */
export function AdminCardGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="glass-card p-4 md:p-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          >
            <Shimmer className="h-5 w-full max-w-[180px]" />
            <Shimmer className="mt-4 h-3 w-full" />
            <Shimmer className="mt-2 h-3 w-4/5" />
            <div className="mt-4 flex gap-2">
              <Shimmer className="h-9 flex-1 rounded-xl" />
              <Shimmer className="h-9 w-20 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Weekly program: coverage tables + day columns. */
export function AdminWeeklyProgramSkeleton() {
  return (
    <div className="space-y-6">
      <Shimmer className="h-12 w-full max-w-xl rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map((k) => (
          <div key={k} className="glass-card overflow-hidden">
            <div className="border-b border-white/10 bg-black/40 px-4 py-3">
              <Shimmer className="h-4 w-24" />
            </div>
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-2">
                  <Shimmer className="h-4 w-28 shrink-0" />
                  <Shimmer className="h-4 flex-1" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="hidden md:flex gap-4 overflow-hidden pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card h-[420px] w-[260px] shrink-0 p-4">
            <Shimmer className="h-5 w-24" />
            <Shimmer className="mt-3 h-3 w-32" />
            <Shimmer className="mt-6 h-24 w-full rounded-xl" />
            <Shimmer className="mt-3 h-24 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
