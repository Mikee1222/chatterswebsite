"use client";

import * as React from "react";
import { ImageIcon, PenLine, X } from "lucide-react";
import type { MistakeAttachment } from "@/services/chatter-mistakes";

export function displayShotUrl(shot: MistakeAttachment | undefined, preferAnnotated = true): string | undefined {
  if (!shot?.url) return undefined;
  if (preferAnnotated && shot.annotated_url) return shot.annotated_url;
  return shot.url;
}

type GalleryProps = {
  shots: MistakeAttachment[];
  /** Admin: open annotator for index */
  canAnnotate?: boolean;
  onAnnotate?: (index: number) => void;
  /** Prefer annotated in thumbs (default true for chatter/VA). */
  preferAnnotatedThumbs?: boolean;
  /** Show Original/Annotated toggle in lightbox (admin always; chatter/VA when annotated). */
  allowOriginalToggle?: boolean;
  size?: "sm" | "md" | "lg";
};

export function MistakeScreenshotGallery({
  shots,
  canAnnotate = false,
  onAnnotate,
  preferAnnotatedThumbs = true,
  allowOriginalToggle = true,
  size = "sm",
}: GalleryProps) {
  const list = shots.filter((s) => Boolean(s?.url));
  const [lightbox, setLightbox] = React.useState<{ index: number; showOriginal: boolean } | null>(null);

  if (!list.length) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-white/10 bg-white/5 ${
          size === "lg" ? "h-24 w-full" : size === "md" ? "h-14 w-14" : "h-10 w-10"
        }`}
      >
        <ImageIcon className="h-4 w-4 text-white/25" aria-hidden />
      </div>
    );
  }

  const thumbClass =
    size === "lg" ? "h-28 w-full" : size === "md" ? "h-14 w-14" : "h-10 w-10";

  const lb = lightbox != null ? list[lightbox.index] : null;
  const hasAnnotated = Boolean(lb?.annotated_url);
  const lbUrl =
    lb && lightbox
      ? lightbox.showOriginal || !lb.annotated_url
        ? lb.url
        : lb.annotated_url
      : null;

  return (
    <>
      <div className={`flex flex-wrap gap-2 ${size === "lg" ? "w-full" : ""}`}>
        {list.map((shot, index) => {
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
                className={`block overflow-hidden rounded-lg ring-1 ring-white/10 transition hover:ring-pink-500/40 ${thumbClass}`}
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
              {canAnnotate && onAnnotate ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAnnotate(index);
                  }}
                  className="absolute bottom-1 right-1 inline-flex items-center gap-1 rounded-md border border-white/20 bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white/90 hover:bg-black/90"
                >
                  <PenLine className="h-3 w-3" />
                  Annotate
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {lightbox && lbUrl ? (
        <div
          className="fixed inset-0 z-[350] flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Screenshot preview"
          onClick={() => setLightbox(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setLightbox(null);
          }}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 z-10 rounded-full border border-white/20 bg-black/60 p-2 text-white/80 hover:bg-white/10"
            aria-label="Close screenshot"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
            {allowOriginalToggle && hasAnnotated ? (
              <>
                <button
                  type="button"
                  onClick={() => setLightbox({ ...lightbox, showOriginal: false })}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
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
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    lightbox.showOriginal
                      ? "border-pink-500/40 bg-pink-500/25 text-pink-100"
                      : "border-white/20 bg-black/50 text-white/70"
                  }`}
                >
                  Original
                </button>
              </>
            ) : null}
            {canAnnotate && onAnnotate ? (
              <button
                type="button"
                onClick={() => {
                  const i = lightbox.index;
                  setLightbox(null);
                  onAnnotate(i);
                }}
                className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/60 px-3 py-1 text-xs text-white/80 hover:bg-white/10"
              >
                <PenLine className="h-3.5 w-3.5" />
                Annotate
              </button>
            ) : null}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lbUrl}
            alt="Screenshot full size"
            className="max-h-[90vh] max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
