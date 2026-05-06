import { cn } from "@/lib/utils";

export function ModelRouteLoadingSkeleton({ blocks = 3 }: { blocks?: number }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-44 animate-pulse rounded-lg bg-white/[0.08]" />
        <div className="h-4 w-full max-w-lg animate-pulse rounded-lg bg-white/[0.06]" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: blocks }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="h-4 w-36 animate-pulse rounded-lg bg-white/[0.08]" />
            <div className="mt-3 h-4 w-full animate-pulse rounded-lg bg-white/[0.06]" />
            <div className="mt-2 h-4 w-3/4 animate-pulse rounded-lg bg-white/[0.06]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ModelRouteEmptyState({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-white/10 bg-white/[0.03] p-6", className)}>
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-white/65">{description}</p>
    </section>
  );
}
