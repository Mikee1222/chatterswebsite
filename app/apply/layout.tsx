import type { Metadata } from "next";
import { ApplyAmbientBg } from "@/components/application-public-chrome";
import { APPLY_SHELL } from "@/lib/application-ui-tokens";

export const metadata: Metadata = {
  applicationName: undefined,
  manifest: undefined,
  appleWebApp: undefined,
  icons: {
    icon: [
      { url: "/icon-192-v2.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512-v2.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon-v2.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    siteName: undefined,
  },
};

export default function ApplyPublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={APPLY_SHELL}>
      <ApplyAmbientBg />
      <div className="relative flex min-h-dvh flex-col">{children}</div>
    </div>
  );
}
