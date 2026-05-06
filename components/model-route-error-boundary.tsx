"use client";

type ModelRouteErrorBoundaryProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export function ModelRouteErrorBoundary({ error, reset }: ModelRouteErrorBoundaryProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-100">
      <h1 className="text-xl font-semibold text-white">Something went wrong</h1>
      <p className="text-sm leading-relaxed text-rose-100/90">
        We could not load this model page right now. Please try again.
      </p>
      {error.message ? <p className="text-xs text-rose-200/80">{error.message}</p> : null}
      <button
        type="button"
        onClick={reset}
        className="inline-flex items-center rounded-lg border border-rose-300/30 bg-rose-400/20 px-3 py-2 text-sm font-medium text-rose-50 transition hover:bg-rose-400/30"
      >
        Retry
      </button>
    </div>
  );
}
