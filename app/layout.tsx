import type { Metadata, Viewport } from "next";
import { ToasterProvider } from "@/components/toaster-provider";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_ORIGIN,
  SITE_TITLE,
  absoluteUrl,
  buildOpenGraph,
  buildTwitterCard,
} from "@/lib/site-metadata";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: SITE_TITLE,
    template: `%s — ${SITE_TITLE}`,
  },
  applicationName: SITE_NAME,
  description: SITE_DESCRIPTION,
  icons: {
    icon: [
      { url: "/icon-192-v2.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512-v2.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon-v2.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/icon-192-v2.png",
  },
  appleWebApp: {
    capable: true,
    title: SITE_TITLE,
    statusBarStyle: "black-translucent",
  },
  manifest: "/manifest.json",
  openGraph: buildOpenGraph({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: absoluteUrl("/"),
  }),
  twitter: buildTwitterCard({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  }),
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#ec4899",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen text-[hsl(0,0%,98%)]">
        {children}
        <ToasterProvider />
      </body>
    </html>
  );
}
