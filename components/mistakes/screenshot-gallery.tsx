"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ExternalLink, ImageIcon, PenLine, X } from "lucide-react";
import type { MistakeAttachment } from "@/services/chatter-mistakes";

export function displayShotUrl(shot: MistakeAttachment | undefined, preferAnnotated = true): string | undefined {
  if (!shot?.url) return undefined;
  if (preferAnnotated && shot.annotated_url) return shot.annotated_url;
  return shot.url;
}

export type ScreenshotGalleryProps = {
  shots: MistakeAttachment[];
  canAnnotate?: boolean;
  onAnnotate?: (index: number) => void;
  preferAnnotatedThumbs?: boolean;
  allowOriginalToggle?: boolean;
  size?: "sm" | "md" | "lg";
  /** Compact list-row thumb: first image +N only */
  compact?: boolean;
  className?: string;
};

export function ScreenshotGallery({
  shots,
  canAnnotate = false,
  onAnnotate,
  preferAnnotatedThumbs = true,
  allowOriginalToggle = true,
  size = "sm",
  compact = false,
  className = "",
}: ScreenshotGalleryProps) {
  const list = React.useMemo(() => shots.filter((s) => Boolean(s?.url)), [shots]);
  const [lightbox, setLightbox] = React.useState<{ index: number; showOriginal: boolean } | null>(null);
  const closeBtnRef = React.useRef<HTMLButtonElement>(null);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!lightbox) return;
    const prev = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setLightbox(null);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setLightbox((lb) =>
          lb ? { ...lb, index: (lb.index - 1 + list.length) % list.length, showOriginal: false } : lb
        );
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setLightbox((lb) =>
          lb ? { ...lb, index: (lb.index + 1) % list.length, showOriginal: false } : lb
        );
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [lightbox, list.length]);

  if (!list.length) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-white/10 bg-white/5 ${
          size === "lg" ? "h-24 w-full" : size === "md" ? "h-14 w-14" : "h-10 w-10"
        } ${className}`}
      >
        <ImageIcon className="h-4 w-4 text-white/25" aria-hidden />
      </div>
    );
  }

  const thumbClass =
    size === "lg" ? "h-28 w-full" : size === "md" ? "h-14 w-14" : "h-10 w-10";

  const displayList = compact ? list.slice(0, 1) : list;
  const extra = compact && list.length > 1 ? list.length - 1 : 0;

  const lb = lightbox != null ? list[lightbox.index] : null;
  const hasAnnotated = Boolean(lb?.annotated_url);
  const lbUrl =
    lb && lightbox
      ? lightbox.showOriginal || !lb.annotated_url
        ? lb.url
        : lb.annotated_url!
      : null;

  const lightboxNode =
    mounted && lightbox && lbUrl
      ? createPortal(
          <div
            ref={dialogRef}
            className="fixed inset-0 z-[350] flex items-center justify-center bg-black/92 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Screenshot preview"
            onClick={() => setLightbox(null)}
          >
            <button
              ref={closeBtnRef}
              type="button"
              onClick={() => setLightbox(null)}
              className="absolute right-4 top-4 z-10 rounded-full border border-white/20 bg-black/60 p-2 text-white/80 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60"
              aria-label="Close screenshot"
            >
              <X className="h-5 w-5" />
            </button>

            <div
              className="absolute left-4 top-4 z-10 flex max-w-[min(100%,28rem)] flex-wrap gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              {allowOriginalToggle && hasAnnotated ? (
                <>
                  <button
                    type="button"
                    onClick={() => setLightbox({ ...lightbox, showOriginal: false })}
                    className={`rounded-full border px-3 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60 ${
                      !lightbox.showOriginal
                        ? "border-pink-500/40 bg-pink-500/25 text-pink-100"
                        : "border-white/20 bg-black/50 text-white/70"
                    }`}
                  >
                    Annotated
                  </button>
                  <button
                    type="button"
                    onClick={() => setLightbox({ ...lightbox, showOriginal: true })}
                    className={`rounded-full border px-3 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60 ${
                      lightbox.showOriginal
                        ? "border-pink-500/40 bg-pink-500/25 text-pink-100"
                        : "border-white/20 bg-black/50 text-white/70"
                    }`}
                  >
                    Original
                  </button>
                </>
              ) : null}
              <a
                href={lb?.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/60 px-3 py-1 text-xs text-white/80 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open original
              </a>
              {canAnnotate && onAnnotate ? (
                <button
                  type="button"
                  onClick={() => {
                    const i = lightbox.index;
                    setLightbox(null);
                    onAnnotate(i);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/60 px-3 py-1 text-xs text-white/80 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60"
                >
                  <PenLine className="h-3.5 w-3.5" />
                  Annotate
                </button>
              ) : null}
              <span className="self-center text-xs text-white/40">
                {lightbox.index + 1} / {list.length}
              </span>
            </div>

            {list.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label="Previous screenshot"
                  className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 p-2 text-white/80 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightbox({
                      ...lightbox,
                      index: (lightbox.index - 1 + list.length) % list.length,
                      showOriginal: false,
                    });
                  }}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label="Next screenshot"
                  className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 p-2 text-white/80 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightbox({
                      ...lightbox,
                      index: (lightbox.index + 1) % list.length,
                      showOriginal: false,
                    });
                  }}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            ) : null}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lbUrl}
              alt={`Screenshot ${lightbox.index + 1} of ${list.length}`}
              className="max-h-[90vh] max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className={`flex flex-wrap items-end gap-2 ${size === "lg" ? "w-full" : ""} ${className}`}>
        {displayList.map((shot, index) => {
          const url = preferAnnotatedThumbs ? displayShotUrl(shot, true) : shot.url;
          const annotated = Boolean(shot.annotated_url);
          return (
            <div key={`${shot.url}-${index}`} className={`relative ${size === "lg" ? "w-full" : "shrink-0"}`}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox({ index, showOriginal: false });
                }}
                className={`block overflow-hidden rounded-lg ring-1 ring-white/10 transition hover:ring-pink-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60 ${thumbClass}`}
                aria-label={`View screenshot ${index + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
              {annotated ? (
                <span className="pointer-events-none absolute left-1 top-1 rounded bg-pink-500/90 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                  Annotated
                </span>
              ) : null}
              {extra > 0 && index === 0 ? (
                <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  +{extra}
                </span>
              ) : null}
              {!compact && canAnnotate && onAnnotate ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAnnotate(index);
                  }}
                  className="absolute bottom-1 right-1 inline-flex items-center gap-1 rounded-md border border-white/20 bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white/90 hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60"
                >
                  <PenLine className="h-3 w-3" />
                  Annotate
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {lightboxNode}
    </>
  );
}

/** @deprecated Prefer ScreenshotGallery — kept for annotator / chatter callers */
export function MistakeScreenshotGallery(props: ScreenshotGalleryProps) {
  return <ScreenshotGallery {...props} />;
}
