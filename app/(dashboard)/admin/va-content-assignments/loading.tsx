export default function AdminVaContentAssignmentsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
      <div className="animate-pulse space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="h-8 w-64 rounded-lg bg-white/10" />
            <div className="h-4 w-full max-w-md rounded bg-white/[0.06]" />
          </div>
          <div className="h-11 w-44 rounded-xl bg-pink-500/20" />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl md:p-5">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-11 rounded-xl bg-white/[0.06]" />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <div className="h-10 w-36 rounded-xl bg-white/[0.06]" />
            <div className="h-10 w-36 rounded-xl bg-white/[0.06]" />
          </div>
          <div className="mt-4 h-4 w-48 rounded bg-white/[0.06]" />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
          <div className="space-y-0">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex gap-4 border-b border-white/[0.06] py-4 last:border-0">
                <div className="h-4 flex-1 rounded bg-white/[0.06]" />
                <div className="h-4 w-24 rounded bg-white/[0.06]" />
                <div className="h-4 w-20 rounded bg-white/[0.06]" />
                <div className="h-6 w-16 rounded-full bg-white/[0.08]" />
                <div className="h-8 w-28 rounded-lg bg-white/[0.06]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
