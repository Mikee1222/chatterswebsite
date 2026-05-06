"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Catches runtime errors in the app segment tree (below root layout).
 * Surfaces `error.message` in production instead of only a digest in the shell.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-zinc-900/80 p-6 shadow-xl backdrop-blur">
        <h1 className="text-xl font-semibold text-white">Something went wrong</h1>
        <p className="text-sm leading-relaxed text-white/60">
          {error.message?.trim() ? error.message : "An unexpected error occurred while loading this page."}
        </p>
        {error.digest ? (
          <p className="font-mono text-xs text-white/40">Reference: {error.digest}</p>
        ) : null}
        <div className="flex flex-col gap-2 pt-2 sm:flex-row">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95"
          >
            Try again
          </button>
          <Link
            href="/login"
            className="rounded-xl border border-white/15 px-4 py-3 text-center text-sm font-medium text-white/80 transition hover:bg-white/5"
          >
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
