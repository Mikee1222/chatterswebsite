"use client";

import { extractLoomId } from "@/lib/loom";
import { cn } from "@/lib/utils";
import { Video } from "lucide-react";

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
    <div className={cn("group w-full", className)}>
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-violet-500/25 bg-violet-500/10 shadow-[0_0_12px_-4px_rgba(139,92,246,0.35)]">
          <Video className="h-3.5 w-3.5 text-violet-200" />
        </span>
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/45">Walkthrough</p>
      </div>
      <div
        className={cn(
          "sop-media-frame relative w-full overflow-hidden rounded-2xl transition-[border-color,box-shadow] duration-300",
          "group-hover:border-violet-500/25 group-hover:shadow-[0_0_40px_-10px_rgba(139,92,246,0.25)]"
        )}
      >
        <div className="relative w-full pt-[56.25%]">
          <iframe
            src={`https://www.loom.com/embed/${loomId}`}
            title={title}
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      </div>
    </div>
  );
}
