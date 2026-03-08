import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chatter Dashboard",
    short_name: "Chatter",
    description: "Internal team dashboard – shifts, whales, customs",
    start_url: baseUrl || "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0a0a0a",
    theme_color: "#1a0a12",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "192x192 512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon.svg",
        sizes: "192x192 512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    prefer_related_applications: false,
  };
}
