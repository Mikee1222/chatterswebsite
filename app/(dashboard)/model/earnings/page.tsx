import { LineChart } from "lucide-react";

export default function ModelEarningsPlaceholderPage() {
  return (
    <div className="mx-auto max-w-lg space-y-4 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-pink-500/15 text-pink-200">
        <LineChart className="h-7 w-7" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold text-white">My earnings</h1>
      <p className="inline-flex items-center rounded-full border border-pink-400/30 bg-pink-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-pink-200">
        Coming soon
      </p>
      <p className="text-sm leading-relaxed text-white/55">
        Detailed earnings breakdowns and history will appear here. We will let you know when it is ready.
      </p>
    </div>
  );
}
