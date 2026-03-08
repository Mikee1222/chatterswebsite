export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="stat-card animate-pulse">
            <div className="h-4 w-24 rounded bg-white/10" />
            <div className="mt-2 h-8 w-16 rounded bg-white/15" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card h-64 animate-pulse rounded-2xl bg-white/5" />
        <div className="glass-card h-64 animate-pulse rounded-2xl bg-white/5" />
      </div>
    </div>
  );
}
