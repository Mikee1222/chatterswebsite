"use client";

import { extractLoomId } from "@/lib/loom";
import { cn } from "@/lib/utils";

export function LoomEmbed({
  url,
  className,
  title = "Loom video",
}: {
  url: string;
  className?: string;
  title?: string;
}) {
  const loomId = extractLoomId(url);
  if (!loomId) return null;

  return (
    <div className={cn("relative w-full overflow-hidden rounded-xl border border-white/10 bg-black/40", className)}>
      <div className="relative w-full pt-[56.25%]">
        <iframe
          src={`https://www.loom.com/embed/${loomId}`}
          title={title}
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    </div>
  );
}
