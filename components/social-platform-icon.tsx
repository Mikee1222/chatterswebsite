"use client";

import * as React from "react";
import type { IconType } from "react-icons";
import { FaGlobe, FaLink } from "react-icons/fa";
import {
  SiFacebook,
  SiInstagram,
  SiSnapchat,
  SiTelegram,
  SiTiktok,
  SiX,
  SiYoutube,
} from "react-icons/si";
import { getPlatformAccentGlow, getSocialColor } from "@/lib/social-platform-config";
import { cn } from "@/lib/utils";

const ICON_BY_PLATFORM: Record<string, IconType> = {
  Instagram: SiInstagram,
  Facebook: SiFacebook,
  TikTok: SiTiktok,
  Twitter: SiX,
  YouTube: SiYoutube,
  Snapchat: SiSnapchat,
  Telegram: SiTelegram,
  GetMyLinks: FaLink,
  Other: FaGlobe,
};

function resolveIcon(platform: string): IconType {
  const key = platform.trim();
  return ICON_BY_PLATFORM[key] ?? FaGlobe;
}

export function SocialPlatformIcon({
  platform,
  className,
  style,
}: {
  platform: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Icon = resolveIcon(platform);
  const color = getSocialColor(platform);
  return <Icon className={className} style={{ color, ...style }} aria-hidden />;
}

export function PlatformIconBadge({
  platform,
  size = "md",
  className,
}: {
  platform: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const plat = platform.trim() || "Other";
  const color = getSocialColor(plat);
  const dim =
    size === "sm" ? "h-7 w-7 text-sm" : size === "lg" ? "h-11 w-11 text-xl" : "h-9 w-9 text-base";

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-xl border",
        dim,
        getPlatformAccentGlow(plat),
        "max-md:shadow-none",
        className,
      )}
      style={{ backgroundColor: `${color}18`, borderColor: `${color}40` }}
      aria-hidden
    >
      <SocialPlatformIcon platform={plat} className={size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4"} />
    </span>
  );
}
