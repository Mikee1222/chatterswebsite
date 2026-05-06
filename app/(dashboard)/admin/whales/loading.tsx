import { AdminCardGridSkeleton } from "@/components/admin-list-skeleton";

export default function AdminWhalesLoading() {
  return (
    <div className="space-y-8 p-4 md:p-0">
      <div className="space-y-2">
        <div className="h-8 w-36 animate-pulse rounded-lg bg-white/[0.08]" />
        <div className="h-4 w-full max-w-lg animate-pulse rounded-lg bg-white/[0.06]" />
      </div>
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 w-28 animate-pulse rounded-2xl bg-white/[0.06]" />
        ))}
      </div>
      <div className="h-32 w-full animate-pulse rounded-2xl bg-white/[0.05]" />
      <AdminCardGridSkeleton cards={6} />
    </div>
  );
}
