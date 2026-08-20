import type { Metadata } from "next";
import { ApplyAmbientBg } from "@/components/application-public-chrome";
import { APPLY_SHELL } from "@/lib/application-ui-tokens";
import { SITE_NAME } from "@/lib/site-metadata";

export const metadata: Metadata = {
  applicationName: SITE_NAME,
  manifest: undefined,
  appleWebApp: undefined,
  icons: {
    icon: [
      { url: "/icon-192-v2.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512-v2.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon-v2.png", sizes: "180x180", type: "image/png" }],
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
