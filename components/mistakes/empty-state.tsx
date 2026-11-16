"use client";

import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-6 py-16 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/35">
        <Inbox className="h-5 w-5" aria-hidden />
      </div>
      <p className="text-sm font-medium text-white/80">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-xs text-white/45">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
