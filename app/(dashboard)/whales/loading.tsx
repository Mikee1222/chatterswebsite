export default function WhalesLoading() {
  return (
    <div className="glass-card overflow-hidden">
      <div className="animate-pulse p-4">
        <div className="mb-4 h-10 w-64 rounded-lg bg-white/10" />
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-12 w-full rounded-lg bg-white/5" />
          ))}
        </div>
      </div>
    </div>
  );
}
