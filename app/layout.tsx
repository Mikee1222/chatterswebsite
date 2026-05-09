import type { Metadata, Viewport } from "next";
import { ToasterProvider } from "@/components/toaster-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gunzo Partner",
  applicationName: "Gunzo Partner",
  description: "Gunzo Agency — Διαχείριση βαρδιών, models, whales και περιεχομένου.",
  icons: {
    icon: "/icon-192-v2.png",
    apple: "/apple-touch-icon-v2.png",
    shortcut: "/icon-192-v2.png",
  },
  appleWebApp: {
    title: "Gunzo Partner",
    statusBarStyle: "black-translucent",
    startupImage: "/apple-touch-icon-v2.png",
  },
  manifest: "/manifest.webmanifest",
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
      <body className="min-h-screen text-[hsl(0,0%,98%)]">
        {children}
        <ToasterProvider />
      </body>
    </html>
  );
}
