import type { Metadata, Viewport } from "next";
import { ToasterProvider } from "@/components/toaster-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gunzo Partner",
  applicationName: "Gunzo Partner",
  description: "Gunzo Agency — Διαχείριση βαρδιών, models, whales και περιεχομένου.",
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
    title: "Gunzo Partner",
    statusBarStyle: "black-translucent",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "Gunzo Partner",
    description: "Gunzo Agency — Εσωτερική πλατφόρμα διαχείρισης.",
    siteName: "Gunzo Partner",
    type: "website",
  },
  twitter: {
    title: "Gunzo Partner",
    description: "Gunzo Agency — Εσωτερική πλατφόρμα διαχείρισης.",
  },
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
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon-v2.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192-v2.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512-v2.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="min-h-screen text-[hsl(0,0%,98%)]">
        {children}
        <ToasterProvider />
      </body>
    </html>
  );
}
