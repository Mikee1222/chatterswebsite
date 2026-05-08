import type { Metadata, Viewport } from "next";
import { ToasterProvider } from "@/components/toaster-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gunzo Partner",
  applicationName: "Gunzo Partner",
  description: "Internal team dashboard – shifts, whales, customs",
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
  appleWebApp: {
    statusBarStyle: "black-translucent",
    title: "Gunzo Partner",
  },
  manifest: "/manifest.webmanifest",
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a0a12",
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
