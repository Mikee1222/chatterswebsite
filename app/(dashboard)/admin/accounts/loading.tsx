import { AdminTableSkeleton } from "@/components/admin-list-skeleton";

export default function AdminAccountsLoading() {
  return (
    <div className="space-y-6 p-4 md:p-0">
      <div className="h-7 w-32 animate-pulse rounded-lg bg-white/[0.08]" />
      <div className="h-11 w-full max-w-md animate-pulse rounded-xl bg-white/[0.06]" />
      <AdminTableSkeleton rows={9} columns={6} />
    </div>
  );
}
