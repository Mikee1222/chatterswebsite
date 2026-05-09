import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gunzo Partner",
    short_name: "Gunzo Partner",
    description: "Gunzo Agency — Εσωτερική πλατφόρμα για chatters, VAs, models και admins.",
    start_url: baseUrl || "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f0f1a",
    theme_color: "#ec4899",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon-192-v2.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-192-v2.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512-v2.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-v2.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    prefer_related_applications: false,
  };
}
