import { AdminWeeklyProgramSkeleton } from "@/components/admin-list-skeleton";

export default function AdminWeeklyProgramLoading() {
  return (
    <div className="space-y-6 p-4 md:p-0">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-white/[0.08]" />
      <AdminWeeklyProgramSkeleton />
    </div>
  );
}
