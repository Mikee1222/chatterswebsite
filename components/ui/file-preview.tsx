"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";
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
};

export function FilePreview({ url, name, className, compact = false }: FilePreviewProps) {
  const fileUrl = url?.trim() ?? "";
  const fileName = name?.trim() || "File";

  if (!fileUrl) return null;

  if (isPdfFile(fileName, fileUrl)) {
    return (
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-white/10 bg-black/20",
          compact ? "max-w-xs" : "w-full",
          className
        )}
      >
        <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
          <iframe
            src={fileUrl}
            title={fileName}
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>
    );
  }

  if (isImageFile(fileName, fileUrl)) {
    return (
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-white/10 bg-black/20",
          compact ? "max-w-xs" : "w-full",
          className
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fileUrl}
          alt={fileName}
          className={cn(
            "h-auto w-full object-contain",
            compact ? "max-h-32" : "max-h-[min(70vh,640px)]"
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
        "inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 transition hover:border-pink-400/30 hover:bg-white/10",
        className
      )}
    >
      <ExternalLink className="h-4 w-4 shrink-0 text-pink-300/80" />
      Open / Download {fileName}
    </a>
  );
}
