import { AdminTableSkeleton } from "@/components/admin-list-skeleton";

export default function AdminModelsLoading() {
  return (
    <div className="space-y-6 p-4 md:p-0">
      <div className="space-y-2">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-white/[0.08]" />
        <div className="h-4 w-full max-w-md animate-pulse rounded-lg bg-white/[0.06]" />
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="h-10 w-56 animate-pulse rounded-xl bg-white/[0.06]" />
        <div className="h-10 w-36 animate-pulse rounded-xl bg-white/[0.06]" />
        <div className="h-10 w-36 animate-pulse rounded-xl bg-white/[0.06]" />
      </div>
      <AdminTableSkeleton rows={10} columns={7} />
    </div>
  );
}
