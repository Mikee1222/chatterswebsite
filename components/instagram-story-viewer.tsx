"use client";

import * as React from "react";
import { X } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { fmtCompact } from "@/lib/instagram-insights-ui";
import { type IgStory, storyMediaKind } from "@/components/instagram-stories-ui";

const IMAGE_STORY_MS = 5000;

function StoryProgressBar({
  total,
  currentIndex,
  progress,
  reduceMotion,
}: {
  total: number;
  currentIndex: number;
  progress: number;
  reduceMotion: boolean;
}) {
  return (
    <div className="flex gap-[3px] px-2">
      {Array.from({ length: total }).map((_, i) => {
        let fill = 0;
        if (i < currentIndex) fill = 100;
        else if (i === currentIndex) fill = progress;
        return (
          <div key={i} className="h-[2px] flex-1 overflow-hidden rounded-full bg-white/30">
            <div
              className={cn(
                "h-full rounded-full bg-white",
                reduceMotion ? "" : "transition-[width] duration-75 ease-linear"
              )}
              style={{ width: `${fill}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

function StorySlide({
  story,
  isActive,
  reduceMotion,
  onDuration,
  onEnded,
  onProgress,
}: {
  story: IgStory;
  isActive: boolean;
  reduceMotion: boolean;
  onDuration: (ms: number) => void;
  onEnded: () => void;
  onProgress: (pct: number) => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const kind = storyMediaKind(story.media_type);
  const isVideo = kind === "video";
  const videoSrc = isVideo ? story.media_url || story.image_url : null;
  const imageSrc = !isVideo ? story.image_url : null;

  React.useEffect(() => {
    if (!isActive) return;
    onProgress(0);

    if (isVideo && videoSrc) {
      const video = videoRef.current;
      if (!video) return;

      const handleLoaded = () => {
        const durMs = Number.isFinite(video.duration) && video.duration > 0
          ? video.duration * 1000
          : IMAGE_STORY_MS;
        onDuration(durMs);
      };

      const handleTimeUpdate = () => {
        if (!Number.isFinite(video.duration) || video.duration <= 0) return;
        onProgress(Math.min(100, (video.currentTime / video.duration) * 100));
      };

      const handleEnded = () => onEnded();

      video.addEventListener("loadedmetadata", handleLoaded);
      video.addEventListener("timeupdate", handleTimeUpdate);
      video.addEventListener("ended", handleEnded);
      void video.play().catch(() => {
        onDuration(IMAGE_STORY_MS);
      });

      return () => {
        video.removeEventListener("loadedmetadata", handleLoaded);
        video.removeEventListener("timeupdate", handleTimeUpdate);
        video.removeEventListener("ended", handleEnded);
        video.pause();
      };
    }

    onDuration(IMAGE_STORY_MS);
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const pct = Math.min(100, (elapsed / IMAGE_STORY_MS) * 100);
      onProgress(pct);
      if (elapsed >= IMAGE_STORY_MS) {
        onEnded();
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    if (reduceMotion) {
      const timeout = window.setTimeout(onEnded, IMAGE_STORY_MS);
      return () => window.clearTimeout(timeout);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isActive, isVideo, videoSrc, imageSrc, onDuration, onEnded, onProgress, reduceMotion]);

  if (isVideo && videoSrc) {
    return (
      <video
        ref={videoRef}
        src={videoSrc}
        poster={story.image_url ?? undefined}
        className={cn(
          "absolute inset-0 h-full w-full object-cover",
          isActive ? "opacity-100" : "pointer-events-none opacity-0",
          reduceMotion ? "" : "transition-opacity duration-150"
        )}
        playsInline
        muted
        preload="metadata"
      />
    );
  }

  if (imageSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageSrc}
        alt=""
        className={cn(
          "absolute inset-0 h-full w-full object-cover",
          isActive ? "opacity-100" : "pointer-events-none opacity-0",
          reduceMotion ? "" : "transition-opacity duration-150"
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center bg-neutral-900 text-white/40",
        isActive ? "opacity-100" : "opacity-0"
      )}
    >
      <span className="text-xs">No preview</span>
    </div>
  );
}

export function InstagramStoryViewer({
  stories,
  username,
  profilePictureUrl,
  hasMetrics,
  onClose,
  className,
}: {
  stories: IgStory[];
  username: string;
  profilePictureUrl: string | null;
  hasMetrics: boolean;
  onClose: () => void;
  className?: string;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const [index, setIndex] = React.useState(0);
  const [progress, setProgress] = React.useState(0);
  const advanceRef = React.useRef<() => void>(() => {});

  const goNext = React.useCallback(() => {
    setIndex((i) => {
      if (i >= stories.length - 1) {
        onClose();
        return i;
      }
      return i + 1;
    });
    setProgress(0);
  }, [stories.length, onClose]);

  const goPrev = React.useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
    setProgress(0);
  }, []);

  advanceRef.current = goNext;

  React.useEffect(() => {
    setIndex(0);
    setProgress(0);
  }, [stories]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goNext, goPrev]);

  const current = stories[index];
  if (!current) return null;

  const showViews = hasMetrics && current.views != null && current.views > 0;
  const showReach = hasMetrics && current.reach != null && current.reach > 0;

  return (
    <div
      className={cn("absolute inset-0 z-40 flex flex-col bg-black text-white", className)}
      role="dialog"
      aria-label={`${username} stories`}
    >
      {/* Slides */}
      <div className="relative min-h-0 flex-1">
        {stories.map((story, i) => (
          <StorySlide
            key={story.id}
            story={story}
            isActive={i === index}
            reduceMotion={reduceMotion}
            onDuration={() => {}}
            onEnded={() => {
              if (i === index) advanceRef.current();
            }}
            onProgress={(pct) => {
              if (i === index) setProgress(pct);
            }}
          />
        ))}

        {/* Tap zones */}
        <div className="absolute inset-0 z-10 flex">
          <button
            type="button"
            aria-label="Previous story"
            className="h-full w-1/3"
            onClick={goPrev}
          />
          <button
            type="button"
            aria-label="Next story"
            className="h-full flex-1"
            onClick={goNext}
          />
        </div>

        {/* Top chrome */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/55 via-black/25 to-transparent pb-8 pt-10">
          <div className="pointer-events-auto px-2">
            <StoryProgressBar
              total={stories.length}
              currentIndex={index}
              progress={progress}
              reduceMotion={reduceMotion}
            />
          </div>

          <div className="pointer-events-auto mt-2.5 flex items-center gap-2 px-3">
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/20 bg-neutral-800">
              {profilePictureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profilePictureUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-white/50">
                  {username.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{username}</span>
            <button
              type="button"
              aria-label="Close stories"
              onClick={onClose}
              className="rounded-full p-1.5 text-white/90 transition hover:bg-white/10 motion-reduce:transition-none"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Metrics overlay */}
        {showViews || showReach ? (
          <div className="pointer-events-none absolute bottom-16 left-0 z-20 px-4">
            <div className="flex flex-wrap gap-2 text-[11px] font-medium text-white/75">
              {showViews ? (
                <span className="rounded-md bg-black/35 px-2 py-1 backdrop-blur-sm">
                  {fmtCompact(current.views)} view{current.views === 1 ? "" : "s"}
                </span>
              ) : null}
              {showReach ? (
                <span className="rounded-md bg-black/35 px-2 py-1 backdrop-blur-sm">
                  {fmtCompact(current.reach)} reach
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
