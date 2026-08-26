import type { Metadata } from "next";
import { ApplyAmbientBg } from "@/components/application-public-chrome";
import { APPLY_SHELL } from "@/lib/application-ui-tokens";
import {
  APPLY_SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  absoluteUrl,
  buildOpenGraph,
  buildTwitterCard,
} from "@/lib/site-metadata";

/**
 * Public careers shell — fully overrides root metadata so candidates never inherit
 * internal dashboard / Greek PWA copy from the parent layout or manifest.
 */
export const metadata: Metadata = {
  applicationName: SITE_NAME,
  description: APPLY_SITE_DESCRIPTION,
  // `null` unsets parent values (unlike `undefined`, which inherits).
  manifest: null,
  appleWebApp: null,
  icons: {
    icon: [
      { url: "/icon-192-v2.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512-v2.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon-v2.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: buildOpenGraph({
    title: `Careers — ${SITE_TITLE}`,
    description: APPLY_SITE_DESCRIPTION,
    url: absoluteUrl("/apply"),
  }),
  twitter: buildTwitterCard({
    title: `Careers — ${SITE_TITLE}`,
    description: APPLY_SITE_DESCRIPTION,
  }),
};

export default function ApplyPublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={APPLY_SHELL}>
      <ApplyAmbientBg />
      <div className="relative flex min-h-dvh flex-col">{children}</div>
    </div>
  );
}
