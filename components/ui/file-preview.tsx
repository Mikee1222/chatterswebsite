"use client";

import * as React from "react";
import { ExternalLink, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif"]);

function extensionFromNameOrUrl(name?: string | null, url?: string | null): string {
  const source = (name?.trim() || url?.trim() || "").split("?")[0] ?? "";
  const dot = source.lastIndexOf(".");
  if (dot < 0) return "";
  return source.slice(dot + 1).toLowerCase();
}

export function isPdfFile(name?: string | null, url?: string | null): boolean {
  return extensionFromNameOrUrl(name, url) === "pdf";
}

export function isImageFile(name?: string | null, url?: string | null): boolean {
  const ext = extensionFromNameOrUrl(name, url);
  return ext.length > 0 && IMAGE_EXTENSIONS.has(ext);
}

export function isEmbeddableFile(name?: string | null, url?: string | null): boolean {
  return isPdfFile(name, url) || isImageFile(name, url);
}

type FilePreviewProps = {
  url?: string | null;
  name?: string | null;
  className?: string;
  /** Compact thumbnail for admin upload preview */
  compact?: boolean;
  /** Taller embed for fullscreen SOP reader */
  fullscreen?: boolean;
};

const frameClass =
  "sop-media-frame overflow-hidden rounded-2xl transition-[border-color,box-shadow] duration-300 hover:border-pink-500/20 hover:shadow-[0_0_36px_-10px_hsl(330_80%_55%_/_0.2)]";

export function FilePreview({
  url,
  name,
  className,
  compact = false,
  fullscreen = false,
}: FilePreviewProps) {
  const fileUrl = url?.trim() ?? "";
  const fileName = name?.trim() || "File";

  if (!fileUrl) return null;

  if (isPdfFile(fileName, fileUrl)) {
    return (
      <div className={cn(frameClass, compact ? "max-w-xs" : "w-full", className)}>
        <div
          className={cn("relative w-full", fullscreen && "min-h-[min(80vh,900px)]")}
          style={fullscreen ? undefined : { aspectRatio: "16 / 9" }}
        >
          <iframe
            src={fileUrl}
            title={fileName}
            className={cn(
              "absolute inset-0 h-full w-full bg-black/40",
              fullscreen && "min-h-[min(80vh,900px)]"
            )}
          />
        </div>
      </div>
    );
  }

  if (isImageFile(fileName, fileUrl)) {
    return (
      <div className={cn(frameClass, compact ? "max-w-xs" : "w-full", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fileUrl}
          alt={fileName}
          className={cn(
            "h-auto w-full bg-black/30 object-contain",
            compact ? "max-h-32" : fullscreen ? "max-h-[min(85vh,960px)]" : "max-h-[min(70vh,640px)]"
          )}
        />
      </div>
    );
  }

  return (
    <a
      href={fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "sop-glass-card inline-flex items-center gap-2.5 rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/90 transition hover:border-pink-400/30 hover:bg-white/[0.07] hover:shadow-[0_0_24px_-8px_hsl(330_80%_55%_/_0.2)]",
        className
      )}
    >
      <FileText className="h-4 w-4 shrink-0 text-pink-300/70" />
      <span className="min-w-0 flex-1 truncate">Open / Download {fileName}</span>
      <ExternalLink className="h-4 w-4 shrink-0 text-white/40" />
    </a>
  );
}
